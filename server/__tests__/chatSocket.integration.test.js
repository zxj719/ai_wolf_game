// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachChatSocket } from '../chatSocket.js';
import { createChatHub } from '../chatHub.js';

const ORIGIN = 'http://localhost:5173';
let server, port;

// 注入鉴权：token 直接当作 userId（避免测试依赖真实 Worker /api/me）。
// 真实 /api/me 委托路径由跨服务烟测覆盖。
async function fakeAuth(token) {
  const id = Number(token);
  return Number.isInteger(id) && id > 0 ? { userId: id, isAdmin: false } : null;
}

beforeAll(async () => {
  process.env.ALLOWED_ORIGIN = ORIGIN;
  const hub = createChatHub({
    persist: async (f, t, b, c) => ({ id: 99, createdAt: c }),
    getFriends: async (uid) => new Set(uid === 1 ? [2] : [1]),
  });
  server = createServer((_, res) => res.end('ok'));
  attachChatSocket(server, { hub, authenticate: fakeAuth, skipSelfTest: true });
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

afterAll(() => new Promise((r) => server.close(r)));

function connect(userId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', String(userId)], { headers: { Origin: ORIGIN } });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('unexpected-response', () => reject(new Error('unexpected-response')));
  });
}
function waitFor(ws, pred) {
  return new Promise((resolve) => {
    const on = (d) => { const m = JSON.parse(d.toString()); if (pred(m)) { ws.off('message', on); resolve(m); } };
    ws.on('message', on);
  });
}

describe('chatSocket integration (two clients, delegated auth)', () => {
  it('delivers A→B message and acks A', async () => {
    const a = await connect(1);
    const b = await connect(2);
    await new Promise((r) => setTimeout(r, 200));          // let addConnection settle
    const bGot = waitFor(b, (m) => m.type === 'chat:message');
    const aAck = waitFor(a, (m) => m.type === 'chat:ack');
    a.send(JSON.stringify({ type: 'chat:message', to: 2, body: 'yo', clientMsgId: 'x1' }));
    const got = await bGot;
    const ack = await aAck;
    expect(got).toMatchObject({ type: 'chat:message', from: 1, to: 2, body: 'yo', id: 99 });
    expect(ack).toMatchObject({ type: 'chat:ack', clientMsgId: 'x1', id: 99 });
    a.close(); b.close();
  });

  it('rejects a connection with an unauthenticated token (no open)', async () => {
    await expect(new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', 'not-a-user'], { headers: { Origin: ORIGIN } });
      ws.on('open', () => { ws.close(); resolve('opened'); });
      ws.on('error', () => reject(new Error('refused')));
      ws.on('unexpected-response', () => reject(new Error('refused')));
    })).rejects.toThrow('refused');
  });

  it('rejects a connection from a disallowed Origin', async () => {
    await expect(new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', '1'], { headers: { Origin: 'http://evil.example.com' } });
      ws.on('open', () => { ws.close(); resolve('opened'); });
      ws.on('error', () => reject(new Error('refused')));
      ws.on('unexpected-response', () => reject(new Error('refused')));
    })).rejects.toThrow('refused');
  });
});
