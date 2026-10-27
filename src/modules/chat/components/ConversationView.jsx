import { useCallback, useEffect, useRef, useState } from 'react';
import { friendService } from '../../../services/friendService';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Video } from 'lucide-react';
import { Avatar } from '../../../components/Personal/Avatar';

let _cid = 0;
const nextClientId = () => `c${Date.now()}_${_cid++}`;

function sortMsgs(list) {
  return list.slice().sort((a, b) => (a.createdAt - b.createdAt) || ((a.id ?? Infinity) - (b.id ?? Infinity)));
}

/** 合并服务端消息列表进现有 messages：按 id 去重/更新，保留无 id 的 pending，整体重排。 */
function mergeServer(prev, incoming) {
  const byId = new Map();
  const pending = [];
  for (const m of prev) { if (m.id != null) byId.set(m.id, m); else pending.push(m); }
  for (const m of incoming) {
    if (m.id != null) byId.set(m.id, { ...(byId.get(m.id) || {}), ...m, pending: false, failed: false });
  }
  return sortMsgs([...byId.values(), ...pending]);
}

/**
 * ConversationView — 与某个好友的会话。
 * props: api, meId, friend{id,username}, chat(useChatSocket 返回值)
 */
export function ConversationView({ api, meId, friend, chat, onStartCall }) {
  const { subscribe, send, sendTyping, status, onlineFriends, reconnectNonce } = chat;
  const friendId = Number(friend.id);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const pendingIds = useRef(new Set());                   // clientMsgId 集合（本会话未确认的）
  const endRef = useRef(null);
  const typingTimer = useRef(null);

  // 初次/切换好友：拉历史，合并而非覆盖（避免冲掉拉取期间到达的实时消息）
  useEffect(() => {
    let alive = true;
    setMessages([]);
    setError(null);
    pendingIds.current = new Set();
    friendService.getHistory(api, friendId)
      .then((r) => { if (alive) setMessages((prev) => mergeServer(prev, r.messages || [])); })
      .catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [api, friendId]);

  // 断线重连后补拉最近一页（reconnectNonce 自增触发），合并去重
  useEffect(() => {
    if (reconnectNonce === 0) return;
    let alive = true;
    friendService.getHistory(api, friendId)
      .then((r) => { if (alive) setMessages((prev) => mergeServer(prev, r.messages || [])); })
      .catch(() => { /* 静默；下次重连再试 */ });
    return () => { alive = false; };
  }, [reconnectNonce, api, friendId]);

  // 订阅实时消息（依赖稳定的 subscribe + friendId，不依赖整个 chat 字面量）
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'chat:message') {
        const involved = Number(msg.from) === friendId || Number(msg.to) === friendId;
        if (!involved) return;
        setMessages((prev) => {
          // 自己乐观消息的跨标签/回执对账：clientMsgId 命中 pending → 原地替换
          if (msg.clientMsgId) {
            const i = prev.findIndex((m) => m.clientMsgId === msg.clientMsgId);
            if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], id: msg.id, createdAt: msg.createdAt, pending: false, failed: false }; return sortMsgs(c); }
          }
          if (msg.id != null && prev.some((m) => m.id === msg.id)) return prev;   // 去重
          return sortMsgs([...prev, { id: msg.id, fromUser: msg.from, body: msg.body, createdAt: msg.createdAt }]);
        });
      } else if (msg.type === 'chat:ack') {
        if (!pendingIds.current.has(msg.clientMsgId)) return;
        pendingIds.current.delete(msg.clientMsgId);
        setMessages((prev) => prev.map((m) => m.clientMsgId === msg.clientMsgId ? { ...m, id: msg.id, createdAt: msg.createdAt, pending: false } : m));
      } else if (msg.type === 'chat:error') {
        pendingIds.current.delete(msg.clientMsgId);
        setMessages((prev) => prev.map((m) => m.clientMsgId === msg.clientMsgId ? { ...m, pending: false, failed: true } : m));
      } else if (msg.type === 'chat:typing') {
        if (Number(msg.from) !== friendId) return;
        setPeerTyping(!!msg.typing);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (msg.typing) typingTimer.current = setTimeout(() => setPeerTyping(false), 4000);
      }
    });
  }, [subscribe, friendId]);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); }, []);

  // 自动滚到底
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, peerTyping]);

  const onSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    const clientMsgId = nextClientId();
    pendingIds.current.add(clientMsgId);
    setMessages((prev) => [...prev, { clientMsgId, fromUser: meId, body, createdAt: Date.now(), pending: true }]);
    setDraft('');
    const ok = send(friendId, body, clientMsgId);
    if (!ok) {
      pendingIds.current.delete(clientMsgId);
      setMessages((prev) => prev.map((m) => m.clientMsgId === clientMsgId ? { ...m, pending: false, failed: true } : m));
    }
  }, [draft, send, friendId, meId]);

  return (
    <div className="conversation-view">
      <div className="conversation-header">
        <Avatar name={friend.displayName || friend.username} color={friend.avatarColor} />
        <div><strong>{friend.displayName || friend.username}</strong><small>{status !== 'open' ? '正在连接…' : onlineFriends.has(friendId) ? '在线 · 可以聊聊' : '当前离线'}{friend.bio ? ` · ${friend.bio}` : ''}</small></div>
        {onStartCall && (
          <button type="button" onClick={onStartCall} disabled={status !== 'open'} aria-label="视频通话"><Video size={17} /><span>视频通话</span></button>
        )}
      </div>
      <div className="conversation-messages">
        {error && <p className="text-sm text-danger">{error}</p>}
        <MessageList meId={meId} messages={messages} />
        {peerTyping && <p className="text-xs text-ink-muted mt-2">对方正在输入…</p>}
        <div ref={endRef} />
      </div>
      <div className="conversation-compose">
        <MessageInput
          value={draft}
          disabled={status !== 'open'}
          onChange={setDraft}
          onSend={onSend}
          onTyping={(t) => sendTyping(friendId, t)}
        />
      </div>
    </div>
  );
}

export default ConversationView;
