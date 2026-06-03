/**
 * chatSocket — 把 chatHub 接到真实 ws + http.upgrade + CF Worker 回调。
 *
 * 鉴权策略（重要）：ECS **不持有 JWT_SECRET**。握手时把 token 交给 CF Worker
 * 的 GET /api/me 验证（Worker 持有密钥）。好处：ECS 无需知道/匹配任何密钥，
 * 消除"两边 secret 必须字节一致"的脆弱耦合；/api/me 还顺带返回 isAdmin（Phase 3 视频用）。
 *
 * 其它安全要点：
 *   - token 走 Sec-WebSocket-Protocol 子协议（不进 URL/nginx 日志），不用 ?token=
 *   - maxPayload 16KB + 关压缩：协议层拦超大帧
 *   - 验 Origin（cors 中间件不覆盖 upgrade）
 */
import { WebSocketServer } from 'ws';
import { createChatHub } from './chatHub.js';

const WS_PATH = '/ws/chat';

function workerBase() {
  return (process.env.CHAT_WORKER_URL || 'https://zhaxiaoji.com').replace(/\/+$/, '');
}

function originAllowed(origin) {
  if (!origin) return false;                              // 浏览器 WS 必带 Origin
  const list = (process.env.ALLOWED_ORIGIN || 'https://zhaxiaoji.com').split(',').map((o) => o.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  if (process.env.WS_ALLOW_LOCAL_ORIGIN === '1' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

/** 从 "bearer, <jwt>" 子协议头取 token */
function tokenFromProtocols(header) {
  if (!header) return null;
  const parts = header.split(',').map((s) => s.trim()).filter(Boolean);
  const idx = parts.indexOf('bearer');
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
}

/** 委托 CF Worker 验 token：GET /api/me。返回 {userId, isAdmin} 或 null。 */
async function authenticateViaWorker(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${workerBase()}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (!data.user || data.user.id == null) return null;
    const userId = Number(data.user.id);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return { userId, isAdmin: !!data.isAdmin };
  } catch {
    return null;
  }
}

async function persistToWorker(fromUser, toUser, body, createdAt) {
  const res = await fetch(`${workerBase()}/api/internal/chat/persist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Service-Token': process.env.CHAT_SERVICE_TOKEN || '' },
    body: JSON.stringify({ fromUser, toUser, body, createdAt }),
  });
  if (!res.ok) throw new Error(`persist ${res.status}`);
  return res.json();
}

async function getFriendsFromWorker(userId, token) {
  const res = await fetch(`${workerBase()}/api/friends`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return new Set();
  const data = await res.json().catch(() => ({}));
  return new Set((data.friends || []).map((f) => Number(f.id)));
}

/** 启动检查：Worker 可达性（鉴权已委托给 Worker，无需 JWT 自检）。 */
export async function workerReachabilityCheck() {
  try {
    const res = await fetch(`${workerBase()}/api/health`);
    console.log(`[chatSocket] worker ${workerBase()} reachable (HTTP ${res.status})`);
    return res.ok;
  } catch (e) {
    console.error('━'.repeat(80));
    console.error(`[chatSocket] WARN: worker ${workerBase()} unreachable: ${e.message} — WS auth/persist will fail until reachable`);
    console.error('━'.repeat(80));
    return false;
  }
}

export function attachChatSocket(httpServer, opts = {}) {
  const hub = opts.hub || createChatHub({ persist: persistToWorker, getFriends: getFriendsFromWorker });
  const authenticate = opts.authenticate || authenticateViaWorker;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has('bearer') ? 'bearer' : false),
  });

  if (!opts.skipSelfTest) workerReachabilityCheck();

  httpServer.on('upgrade', async (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { socket.destroy(); return; }
    if (url.pathname !== WS_PATH) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }
    if (!originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }

    const token = tokenFromProtocols(req.headers['sec-websocket-protocol']);
    const auth = await authenticate(token);
    if (!auth) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = {
        userId: auth.userId,
        isAdmin: auth.isAdmin,                             // Phase 3 视频鉴权用
        token,
        send: (obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } },
        close: () => { try { ws.close(); } catch { /* noop */ } },
      };
      // 同步挂监听器：避免 client 'open' 后立刻发的帧在 addConnection 的 await 窗口里被丢。
      ws.on('message', (data) => hub.handleMessage(conn, data.toString()));
      ws.on('close', () => hub.removeConnection(conn));
      ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
      Promise.resolve(hub.addConnection(conn)).catch(() => { /* presence best-effort */ });
    });
  });

  return { wss, hub };
}
