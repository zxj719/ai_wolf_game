import { describe, expect, it } from 'vitest';
import { createGomoku, applyGomoku, GOMOKU_SIZE } from '../games/gomoku.js';
import { createBanqi, applyBanqi, banqiView, targetsFrom, canCapture, BANQI_COLS } from '../games/banqi.js';
import { createGameRooms, RECONNECT_GRACE_MS } from '../games/gameRooms.js';
import { createChatHub } from '../chatHub.js';

const at = (r, c) => r * GOMOKU_SIZE + c;

describe('gomoku', () => {
  it('横向连五获胜，返回连线', () => {
    let s = createGomoku();
    const black = [at(7, 3), at(7, 4), at(7, 5), at(7, 6), at(7, 7)];
    const white = [at(0, 0), at(0, 1), at(0, 2), at(0, 3)];
    for (let k = 0; k < 5; k++) {
      s = applyGomoku(s, 1, { type: 'place', i: black[k] }).state;
      if (k < 4) s = applyGomoku(s, 2, { type: 'place', i: white[k] }).state;
    }
    expect(s.winner).toBe(1);
    expect(s.winLine).toEqual(black);
  });

  it('斜向连五、长连也算胜', () => {
    const s0 = createGomoku();
    const board = s0.board.slice();
    [at(2, 2), at(3, 3), at(5, 5), at(6, 6), at(7, 7)].forEach((i) => { board[i] = 1; });
    const r = applyGomoku({ ...s0, board }, 1, { type: 'place', i: at(4, 4) });
    expect(r.state.winner).toBe(1);
    expect(r.state.winLine).toHaveLength(6);
  });

  it('拒绝非本方回合、重复落子、越界', () => {
    const s = createGomoku();
    expect(applyGomoku(s, 2, { type: 'place', i: 0 }).ok).toBe(false);
    const s1 = applyGomoku(s, 1, { type: 'place', i: 0 }).state;
    expect(applyGomoku(s1, 2, { type: 'place', i: 0 }).ok).toBe(false);
    expect(applyGomoku(s1, 2, { type: 'place', i: 999 }).ok).toBe(false);
  });
});

/** 构造翻翻棋局面：cells 用简写 'rK' 'bP' 'rC'，'?x'=暗子 */
function banqiWith(layout, extra = {}) {
  const s = createBanqi(() => 0.5);
  const cells = new Array(32).fill(null);
  for (const [i, code] of Object.entries(layout)) {
    const up = code[0] !== '?';
    const c = up ? code[0] : code[1];
    const t = up ? code[1] : code[2];
    cells[i] = { c, t, up };
  }
  return { ...s, cells, colors: { 1: 'r', 2: 'b' }, captured: { r: [], b: [] }, ...extra };
}
const bq = (r, c) => r * BANQI_COLS + c;

describe('banqi', () => {
  it('32 子：每方 16 枚，全部暗置', () => {
    const s = createBanqi();
    expect(s.cells.filter((p) => p.c === 'r')).toHaveLength(16);
    expect(s.cells.every((p) => !p.up)).toBe(true);
  });

  it('首翻定色：翻到黑子的一方执黑', () => {
    const s = createBanqi(() => 0.3);
    const i = s.cells.findIndex((p) => p.c === 'b');
    const r = applyBanqi(s, 1, { type: 'flip', i });
    expect(r.state.colors).toEqual({ 1: 'b', 2: 'r' });
    expect(r.state.turn).toBe(2);
  });

  it('等级克制：兵吃将、将不能吃兵、同级互吃', () => {
    const K = { t: 'K' }; const P = { t: 'P' }; const R = { t: 'R' }; const N = { t: 'N' };
    expect(canCapture(P, K)).toBe(true);
    expect(canCapture(K, P)).toBe(false);
    expect(canCapture(R, R)).toBe(true);
    expect(canCapture(N, R)).toBe(false);
  });

  it('炮隔一子打：暗子可作炮架，只能打明子，不能吃相邻', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 2)]: '?bK', [bq(0, 4)]: 'bK', [bq(1, 0)]: 'bA', [bq(2, 0)]: '?rP', [bq(3, 0)]: '?bN' });
    const t = targetsFrom(s.cells, bq(0, 0));
    expect(t).toContain(bq(0, 4));         // 隔暗子打远处的明将
    expect(t).toContain(bq(0, 1));         // 空格照常走一步
    expect(t).not.toContain(bq(1, 0));     // 相邻不能吃
    expect(t).not.toContain(bq(0, 2));     // 暗子不能被打
    expect(t).not.toContain(bq(3, 0));     // 隔子后是暗子：不能打

    // 两个炮架：打不到
    const s2 = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 1)]: 'bP', [bq(0, 2)]: '?bK', [bq(0, 4)]: 'bK' });
    expect(targetsFrom(s2.cells, bq(0, 0))).not.toContain(bq(0, 4));
  });

  it('吃光对方即胜', () => {
    const s = banqiWith({ [bq(1, 1)]: 'rR', [bq(1, 2)]: 'bN' });
    const r = applyBanqi(s, 1, { type: 'move', from: bq(1, 1), to: bq(1, 2) });
    expect(r.ok).toBe(true);
    expect(r.state.winner).toBe(1);
    expect(r.state.captured.b).toEqual(['N']);
  });

  it('不能走对方的子、不能斜走、不能吃暗子', () => {
    const s = banqiWith({ [bq(1, 1)]: 'rR', [bq(2, 2)]: 'bN', [bq(1, 2)]: '?bP' });
    expect(applyBanqi(s, 1, { type: 'move', from: bq(2, 2), to: bq(2, 3) }).ok).toBe(false);
    expect(applyBanqi(s, 1, { type: 'move', from: bq(1, 1), to: bq(2, 2) }).ok).toBe(false);
    expect(applyBanqi(s, 1, { type: 'move', from: bq(1, 1), to: bq(1, 2) }).ok).toBe(false);
  });

  it('连续 50 步无翻无吃判和', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rR', [bq(3, 7)]: 'bR' }, { quiet: 49 });
    const r = applyBanqi(s, 1, { type: 'move', from: bq(0, 0), to: bq(0, 1) });
    expect(r.state.draw).toBe(true);
  });

  it('视图不泄露暗子的颜色和兵种', () => {
    const view = banqiView(createBanqi());
    expect(view.cells.every((p) => Object.keys(p).join() === 'up')).toBe(true);
  });
});

// ---------- 房间 ----------
function harness({ friends = [[1, 2]], onlineSet = new Set([1, 2]), rand = () => 0.1 } = {}) {
  const inbox = new Map();
  const timers = [];
  const sendTo = (u, m) => { if (!inbox.has(u)) inbox.set(u, []); inbox.get(u).push(m); };
  const isFriend = (a, b) => friends.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const rooms = createGameRooms({
    sendTo,
    online: (u) => onlineSet.has(u),
    isFriendOf: async (conn, u) => isFriend(conn.userId, u),
    rand, // 默认 0.1：邀请者为 seat 1
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; },
    clearTimer: (id) => { if (timers[id]) timers[id].fn = null; },
  });
  const conn = (userId) => ({ userId, send: (m) => sendTo(userId, m) });
  const last = (u, type) => [...(inbox.get(u) || [])].reverse().find((m) => m.type === type);
  const fire = (ms) => timers.filter((t) => t.ms === ms && t.fn).forEach((t) => { const f = t.fn; t.fn = null; f(); });
  return { rooms, conn, last, fire, onlineSet, inbox };
}

describe('gameRooms', () => {
  it('邀请 → 接受 → 开局，双方收到各自视图', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    const inv = h.last(2, 'game:invited').invite;
    expect(inv.game).toBe('gomoku');
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: inv.id, accept: true });
    const r1 = h.last(1, 'game:room').room;
    const r2 = h.last(2, 'game:room').room;
    expect(r1.id).toBe(r2.id);
    expect([r1.seat, r2.seat].sort()).toEqual([1, 2]);
    expect(r1.status).toBe('playing');
  });

  it('只能邀请在线好友', async () => {
    const h = harness({ friends: [] });
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    expect(h.last(1, 'game:error').error).toBe('只能邀请好友');
    const h2 = harness({ onlineSet: new Set([1]) });
    await h2.rooms.handle(h2.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    expect(h2.last(1, 'game:error').error).toBe('好友当前不在线');
  });

  it('非本方回合的落子被拒，合法落子推送给双方', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: h.last(2, 'game:invited').invite.id, accept: true });
    const room = h.last(1, 'game:room').room;
    const firstUser = room.players[0];
    const secondUser = room.players[1];
    await h.rooms.handle(h.conn(secondUser), { type: 'game:action', roomId: room.id, action: { type: 'place', i: 0 } });
    expect(h.last(secondUser, 'game:error').error).toBe('还没轮到你');
    await h.rooms.handle(h.conn(firstUser), { type: 'game:action', roomId: room.id, action: { type: 'place', i: 112 } });
    expect(h.last(secondUser, 'game:room').room.state.board[112]).toBe(1);
  });

  it('翻翻棋：客户端收到的局面不含暗子信息', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'banqi' });
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: h.last(2, 'game:invited').invite.id, accept: true });
    for (const u of [1, 2]) {
      const json = JSON.stringify(h.last(u, 'game:room').room.state.cells);
      expect(json).not.toMatch(/"t":|"c":/);
    }
  });

  it('掉线 60s 未回判负；期间重连则继续', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: h.last(2, 'game:invited').invite.id, accept: true });
    h.onlineSet.delete(2);
    h.rooms.onOffline(2);
    expect(h.last(1, 'game:room').room.opponentOnline).toBe(false);
    h.onlineSet.add(2);
    h.rooms.onOnline(2);
    h.fire(RECONNECT_GRACE_MS);
    expect(h.last(1, 'game:room').room.status).toBe('playing');

    h.onlineSet.delete(2);
    h.rooms.onOffline(2);
    h.fire(RECONNECT_GRACE_MS);
    const room = h.last(1, 'game:room').room;
    expect(room.status).toBe('over');
    expect(room.result.reason).toBe('disconnect');
    expect(room.players[room.result.winner - 1]).toBe(1);
  });

  it('认输后双方都点再来一局 → 换先后手开新局；结束的房间不再算忙', async () => {
    // 用会变化的随机数：确保交换先后手不是依赖固定 rand 碰巧成立
    const seq = [0.1, 0.9, 0.9, 0.9];
    const h = harness({ rand: () => seq.shift() ?? 0.9 });
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'gomoku' });
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: h.last(2, 'game:invited').invite.id, accept: true });
    const room = h.last(1, 'game:room').room;
    await h.rooms.handle(h.conn(1), { type: 'game:resign', roomId: room.id });
    expect(h.last(2, 'game:room').room.result).toEqual({ winner: 2, reason: 'resign' });
    await h.rooms.handle(h.conn(1), { type: 'game:rematch', roomId: room.id });
    await h.rooms.handle(h.conn(2), { type: 'game:rematch', roomId: room.id });
    const next = h.last(1, 'game:room').room;
    expect(next.id).not.toBe(room.id);
    expect(next.players).toEqual([...room.players].reverse());
  });
});

describe('chatHub 接入 game:*', () => {
  it('通过 hub 的好友校验发出邀请', async () => {
    const hub = createChatHub({ persist: async () => ({ id: 1 }), getFriends: async () => new Set([1, 2]), now: () => 1000 });
    const sent = { 1: [], 2: [] };
    const mk = (u) => ({ userId: u, token: 't', send: (m) => sent[u].push(m), close() {} });
    await hub.addConnection(mk(1));
    await hub.addConnection(mk(2));
    await hub.handleMessage(mk(1), JSON.stringify({ type: 'game:invite', to: 2, game: 'banqi' }));
    expect(sent[2].some((m) => m.type === 'game:invited' && m.invite.from === 1)).toBe(true);
  });
});
