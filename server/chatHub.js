/**
 * chatHub — 私聊实时核心（无 ws / 无 fetch 依赖，便于单测）。
 *
 * 注入：
 *   - persist(fromUser, toUser, body, createdAt) -> Promise<{id, createdAt}>
 *   - getFriends(userId, token) -> Promise<Set<number>>
 *   - now() -> number
 *
 * 连接对象 conn = { userId, token, send(obj), close() }
 *
 * 词汇：WS 线协议用 from/to；持久化/历史/前端用 fromUser/toUser（ConversationView 翻译）。
 */

const FRIEND_CACHE_TTL_MS = 30_000;
const MAX_SOCKETS_PER_USER = 5;
const MAX_BODY_CHARS = 4000;
const MAX_BODY_BYTES = 8192;
const RATE_MSG = { capacity: 10, refillPerSec: 5 };       // chat:message 令牌桶
const RATE_TYPING = { capacity: 30, refillPerSec: 30 };   // chat:typing 令牌桶
const RATE_CALL = { capacity: 50, refillPerSec: 25 };     // call:* 令牌桶（吸收 trickle-ICE 突发）
const CALL_TYPES = new Set(['call:offer', 'call:answer', 'call:ice', 'call:hangup', 'call:screenshare']);

export function createChatHub({ persist, getFriends, now = () => Date.now() }) {
  const connections = new Map();   // userId -> Set<conn>
  const friendCache = new Map();   // userId -> { set:Set<number>, fetchedAt:number }

  function online(userId) { const s = connections.get(userId); return !!s && s.size > 0; }

  function sendTo(userId, obj) {
    const s = connections.get(userId);
    if (!s) return false;
    let any = false;
    for (const c of s) { try { c.send(obj); any = true; } catch { /* drop */ } }
    return any;
  }

  // 令牌桶：超额返回 false
  function takeToken(conn, key, cfg) {
    if (!conn._buckets) conn._buckets = {};
    let b = conn._buckets[key];
    const t = now();
    if (!b) { b = { tokens: cfg.capacity, last: t }; conn._buckets[key] = b; }
    const elapsed = Math.max(0, (t - b.last) / 1000);
    b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
    b.last = t;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  async function fetchFriends(userId, token) {
    const set = await getFriends(userId, token);
    friendCache.set(userId, { set, fetchedAt: now() });
    return set;
  }
  async function friendsOf(conn) {
    const cached = friendCache.get(conn.userId);
    if (cached && (now() - cached.fetchedAt) < FRIEND_CACHE_TTL_MS) return cached.set;
    return fetchFriends(conn.userId, conn.token);
  }
  // 授权目标：缓存命中即可；未命中且可能是"刚加的好友"→ 强制重取一次再判
  async function isFriendOf(conn, targetId) {
    const set = await friendsOf(conn);
    if (set.has(targetId)) return true;
    const fresh = await fetchFriends(conn.userId, conn.token);
    return fresh.has(targetId);
  }

  async function addConnection(conn) {
    if (!connections.has(conn.userId)) connections.set(conn.userId, new Set());
    const set = connections.get(conn.userId);
    if (set.size >= MAX_SOCKETS_PER_USER) {                // 连接数上限：踢最旧
      const oldest = set.values().next().value;
      try { oldest.close(); } catch { /* noop */ }
      set.delete(oldest);
    }
    set.add(conn);
    const wasFirst = set.size === 1;

    const friends = await friendsOf(conn);
    const onlineFriends = [...friends].filter(online);
    conn.send({ type: 'presence:init', online: onlineFriends });
    if (wasFirst) {                                        // 多标签不重复广播上线
      for (const fid of onlineFriends) sendTo(fid, { type: 'presence', userId: conn.userId, online: true });
    }
  }

  async function removeConnection(conn) {
    const set = connections.get(conn.userId);
    if (set) { set.delete(conn); if (set.size === 0) connections.delete(conn.userId); }
    if (!online(conn.userId)) {
      const cached = friendCache.get(conn.userId);
      const friends = cached ? cached.set : await getFriends(conn.userId, conn.token).catch(() => new Set());
      for (const fid of friends) if (online(fid)) sendTo(fid, { type: 'presence', userId: conn.userId, online: false });
    }
  }

  function bodyTooLong(text) {
    return text.length > MAX_BODY_CHARS || Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES;
  }

  async function handleMessage(conn, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'chat:typing') {
      if (!takeToken(conn, 'typing', RATE_TYPING)) return;
      const to = Number(msg.to);
      if (!Number.isFinite(to)) return;
      if (!(await isFriendOf(conn, to))) return;
      sendTo(to, { type: 'chat:typing', from: conn.userId, to, typing: !!msg.typing });
      return;
    }

    if (msg.type === 'chat:message') {
      if (!takeToken(conn, 'msg', RATE_MSG)) { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'rate limited' }); return; }
      const to = Number(msg.to);
      const text = typeof msg.body === 'string' ? msg.body.trim() : '';
      if (!Number.isFinite(to) || !text) return;
      if (bodyTooLong(text)) { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'too long' }); return; }
      if (!(await isFriendOf(conn, to))) { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'not friends' }); return; }

      const createdAt = now();
      let saved;
      try { saved = await persist(conn.userId, to, text, createdAt); }
      catch { conn.send({ type: 'chat:error', clientMsgId: msg.clientMsgId, error: 'persist failed' }); return; }

      const finalCreatedAt = saved.createdAt ?? createdAt;
      const out = { type: 'chat:message', id: saved.id, from: conn.userId, to, body: text, createdAt: finalCreatedAt };
      sendTo(to, out);                                     // 转发给对方
      const myset = connections.get(conn.userId);          // 回显给发送者的其它标签
      if (myset) for (const c of myset) if (c !== conn) { try { c.send(out); } catch { /* noop */ } }
      conn.send({ type: 'chat:ack', clientMsgId: msg.clientMsgId, id: saved.id, createdAt: finalCreatedAt });
      return;
    }
    // call:* (Phase 3 视频信令中继)
    if (CALL_TYPES.has(msg.type)) {
      if (!takeToken(conn, 'call', RATE_CALL)) return;     // 限流（先于好友查，防 ICE flood 放大）
      const to = Number(msg.to);
      if (!Number.isFinite(to)) return;
      if (msg.type === 'call:offer' && !conn.isAdmin) {     // 仅管理员可发起（前端隐藏不算边界）
        conn.send({ type: 'call:error', error: 'not allowed' });
        return;
      }
      // 好友校验用 TTL 缓存集（不强制 refetch；mid-call 的 flood 全命中缓存，不放大成 Worker fetch）
      const friends = await friendsOf(conn);
      if (!friends.has(to)) return;
      const out = { type: msg.type, from: conn.userId, to };
      if (msg.sdp != null) out.sdp = msg.sdp;
      if (msg.candidate != null) out.candidate = msg.candidate;
      if (msg.reason != null) out.reason = msg.reason;
      if (msg.on != null) out.on = msg.on;                 // call:screenshare 开关
      sendTo(to, out);
      return;
    }
  }

  return { addConnection, removeConnection, handleMessage, online, _connections: connections, _friendCache: friendCache };
}
