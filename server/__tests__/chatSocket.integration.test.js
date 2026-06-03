// @vitest-environment node
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { signToken } from '../../workers/auth/jwt.js';
import { attachChatSocket } from '../chatSocket.js';
import { createChatHub } from '../chatHub.js';

const SECRET = 'test-secret-123';
const ORIGIN = 'http://localhost:5173';
let server, port;

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.ALLOWED_ORIGIN = ORIGIN;
  const hub = createChatHub({
    persist: async (f, t, b, c) => ({ id: 99, createdAt: c }),
    getFriends: async (uid) => new Set(uid === 1 ? [2] : [1]),
  });
  server = createServer((_, res) => res.end('ok'));
  attachChatSocket(server, { hub, skipSelfTest: true });
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});

afterAll(() => new Promise((r) => server.close(r)));

async function connect(userId) {
  const tok = await signToken({ sub: userId, username: `u${userId}`, email: `u${userId}@x` }, SECRET);
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', tok], { headers: { Origin: ORIGIN } });
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

describe('chatSocket integration (two clients, subprotocol auth)', () => {
  it('delivers A→B message and acks A', async () => {
    const a = await connect(1);
    const b = await connect(2);
    const bGot = waitFor(b, (m) => m.type === 'chat:message');
    const aAck = waitFor(a, (m) => m.type === 'chat:ack');
    a.send(JSON.stringify({ type: 'chat:message', to: 2, body: 'yo', clientMsgId: 'x1' }));
    const got = await bGot;
    const ack = await aAck;
    expect(got).toMatchObject({ type: 'chat:message', from: 1, to: 2, body: 'yo', id: 99 });
    expect(ack).toMatchObject({ type: 'chat:ack', clientMsgId: 'x1', id: 99 });
    a.close(); b.close();
  });

  it('rejects a connection with a bad token (no open)', async () => {
    await expect(new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', 'garbage.token.here'], { headers: { Origin: ORIGIN } });
      ws.on('open', () => { ws.close(); resolve('opened'); });
      ws.on('error', () => reject(new Error('refused')));
      ws.on('unexpected-response', () => reject(new Error('refused')));
    })).rejects.toThrow('refused');
  });

  it('rejects a connection from a disallowed Origin', async () => {
    const tok = await signToken({ sub: 1, username: 'u1', email: 'u1@x' }, SECRET);
    await expect(new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat`, ['bearer', tok], { headers: { Origin: 'http://evil.example.com' } });
      ws.on('open', () => { ws.close(); resolve('opened'); });
      ws.on('error', () => reject(new Error('refused')));
      ws.on('unexpected-response', () => reject(new Error('refused')));
    })).rejects.toThrow('refused');
  });
});
