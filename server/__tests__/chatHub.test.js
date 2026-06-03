import { describe, expect, it, vi } from 'vitest';
import { createChatHub } from '../chatHub.js';

function fakeConn(userId, token = 't') {
  const sent = [];
  let closed = false;
  return { userId, token, sent, send: (o) => sent.push(o), close: () => { closed = true; }, get closed() { return closed; } };
}
function has(conn, pred) { return conn.sent.some(pred); }

describe('chatHub message relay', () => {
  it('relays a chat:message between friends + persists + acks sender', async () => {
    const persist = vi.fn(async (f, t, b, c) => ({ id: 42, createdAt: c }));
    const hub = createChatHub({ persist, getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const a = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 2, body: 'hi', clientMsgId: 'c1' }));
    expect(persist).toHaveBeenCalledWith(1, 2, 'hi', 1000);
    expect(has(b, (m) => m.type === 'chat:message' && m.id === 42 && m.from === 1 && m.body === 'hi')).toBe(true);
    expect(has(a, (m) => m.type === 'chat:ack' && m.clientMsgId === 'c1' && m.id === 42)).toBe(true);
  });

  it('rejects + does NOT persist a message to a non-friend', async () => {
    const persist = vi.fn();
    const hub = createChatHub({ persist, getFriends: async () => new Set(), now: () => 1000 });
    const a = fakeConn(1);
    await hub.addConnection(a);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 3, body: 'hi', clientMsgId: 'c2' }));
    expect(persist).not.toHaveBeenCalled();
    expect(has(a, (m) => m.type === 'chat:error' && m.error === 'not friends')).toBe(true);
  });

  it('echoes the message to the sender OTHER tabs (multi-tab)', async () => {
    const hub = createChatHub({ persist: async (f, t, b, c) => ({ id: 7, createdAt: c }), getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const a1 = fakeConn(1), a2 = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a1); await hub.addConnection(a2); await hub.addConnection(b);
    await hub.handleMessage(a1, JSON.stringify({ type: 'chat:message', to: 2, body: 'yo', clientMsgId: 'c3' }));
    // a2 (other tab of same user) should receive the message echo
    expect(has(a2, (m) => m.type === 'chat:message' && m.id === 7 && m.from === 1)).toBe(true);
    // a1 (sender) gets ack, NOT a duplicate message echo
    expect(has(a1, (m) => m.type === 'chat:ack')).toBe(true);
    expect(a1.sent.filter((m) => m.type === 'chat:message').length).toBe(0);
  });
});

describe('chatHub presence', () => {
  it('broadcasts presence on connect/disconnect to online friends', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const a = fakeConn(1); await hub.addConnection(a);
    const b = fakeConn(2); await hub.addConnection(b);
    expect(has(a, (m) => m.type === 'presence' && m.userId === 2 && m.online === true)).toBe(true);
    expect(has(b, (m) => m.type === 'presence:init')).toBe(true);
    await hub.removeConnection(b);
    expect(has(a, (m) => m.type === 'presence' && m.userId === 2 && m.online === false)).toBe(true);
  });

  it('does not re-broadcast online on a second tab of the same user', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const a = fakeConn(1); await hub.addConnection(a);
    const b1 = fakeConn(2); await hub.addConnection(b1);
    const beforeCount = a.sent.filter((m) => m.type === 'presence' && m.userId === 2 && m.online).length;
    const b2 = fakeConn(2); await hub.addConnection(b2);   // second tab
    const afterCount = a.sent.filter((m) => m.type === 'presence' && m.userId === 2 && m.online).length;
    expect(afterCount).toBe(beforeCount);                  // no duplicate online ping
  });
});

describe('chatHub rate limiting + caps', () => {
  it('rate-limits chat:message beyond capacity (10) when no time passes', async () => {
    const hub = createChatHub({ persist: async (f, t, b, c) => ({ id: 1, createdAt: c }), getFriends: async () => new Set([1, 2]), now: () => 5000 });
    const a = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    for (let i = 0; i < 12; i++) {
      await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 2, body: 'x', clientMsgId: `c${i}` }));
    }
    const acks = a.sent.filter((m) => m.type === 'chat:ack').length;
    const limited = a.sent.filter((m) => m.type === 'chat:error' && m.error === 'rate limited').length;
    expect(acks).toBe(10);
    expect(limited).toBe(2);
  });

  it('caps connections per user at 5, closing the oldest', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set(), now: () => 1000 });
    const conns = [];
    for (let i = 0; i < 6; i++) { const c = fakeConn(1); conns.push(c); await hub.addConnection(c); }
    expect(hub._connections.get(1).size).toBe(5);
    expect(conns[0].closed).toBe(true);                    // oldest evicted
  });
});

describe('chatHub friend cache refetch-on-miss', () => {
  it('allows a newly-added friend by refetching when the cached set misses', async () => {
    let call = 0;
    const getFriends = vi.fn(async () => { call += 1; return call === 1 ? new Set() : new Set([2]); });
    const persist = vi.fn(async (f, t, b, c) => ({ id: 1, createdAt: c }));
    const hub = createChatHub({ persist, getFriends, now: () => 1000 });
    const a = fakeConn(1); await hub.addConnection(a);     // first getFriends → empty
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:message', to: 2, body: 'hi', clientMsgId: 'c1' }));
    expect(getFriends.mock.calls.length).toBeGreaterThanOrEqual(2);  // refetched on miss
    expect(persist).toHaveBeenCalled();                    // and allowed
  });
});

describe('chatHub typing', () => {
  it('relays typing to a friend, keeping from + to', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const a = fakeConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'chat:typing', to: 2, typing: true }));
    expect(has(b, (m) => m.type === 'chat:typing' && m.from === 1 && m.typing === true)).toBe(true);
  });
});
