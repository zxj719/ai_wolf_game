/**
 * chatSocket — 把 chatHub 接到真实 ws + http.upgrade + CF Worker 回调。
 *
 * 安全要点：
 *   - token 走 Sec-WebSocket-Protocol 子协议（不进 URL/nginx 日志），不用 ?token=
 *   - maxPayload 16KB + 关闭压缩：协议层拦超大帧，避免内存耗尽 DoS
 *   - 握手验签 + 验 Origin（cors 中间件不覆盖 upgrade）
 *   - sub 必须为正整数；启动 JWT 自检大声失败
 */
import { WebSocketServer } from 'ws';
import { verifyToken, signToken } from '../workers/auth/jwt.js';
import { createChatHub } from './chatHub.js';

const WS_PATH = '/ws/chat';

function workerBase() {
  return (process.env.CHAT_WORKER_URL || 'https://zhaxiaoji.com').replace(/\/+$/, '');
}

// 动态读 env（兼容 pm2 --update-env / 测试在 import 后设置）
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

/** 启动自检：签发+验签一个 token，失败大声告警（仿 checkProviderConfig） */
export async function jwtSelfTest() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('━'.repeat(80));
    console.error('[chatSocket] FATAL: JWT_SECRET 未设置，WS 将拒绝所有连接');
    console.error('━'.repeat(80));
    return false;
  }
  try {
    const t = await signToken({ sub: 999999, username: '_selftest', email: 'x@x' }, secret);
    const ok = await verifyToken(t, secret);
    if (!ok || Number(ok.sub) !== 999999) throw new Error('verify mismatch');
    console.log('[chatSocket] JWT self-test OK');
    return true;
  } catch (e) {
    console.error('━'.repeat(80));
    console.error(`[chatSocket] FATAL JWT self-test failed: ${e.message}`);
    console.error('━'.repeat(80));
    return false;
  }
}

export function attachChatSocket(httpServer, opts = {}) {
  const hub = opts.hub || createChatHub({ persist: persistToWorker, getFriends: getFriendsFromWorker });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
    handleProtocols: (protocols) => (protocols.has('bearer') ? 'bearer' : false),
  });

  if (!opts.skipSelfTest) jwtSelfTest();

  httpServer.on('upgrade', async (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { socket.destroy(); return; }
    if (url.pathname !== WS_PATH) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }
    if (!originAllowed(req.headers.origin)) { socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }

    const token = tokenFromProtocols(req.headers['sec-websocket-protocol']);
    const payload = token ? await verifyToken(token, process.env.JWT_SECRET) : null;
    const sub = payload ? Number(payload.sub) : NaN;
    if (!payload || !Number.isInteger(sub) || sub <= 0) { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, async (ws) => {
      const conn = {
        userId: sub,
        token,
        send: (obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* closed */ } },
        close: () => { try { ws.close(); } catch { /* noop */ } },
      };
      await hub.addConnection(conn);                       // 先注册再接 close，避免半初始化竞态
      ws.on('message', (data) => hub.handleMessage(conn, data.toString()));
      ws.on('close', () => hub.removeConnection(conn));
      ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
    });
  });

  return { wss, hub };
}
