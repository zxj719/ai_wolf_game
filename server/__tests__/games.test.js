import { describe, expect, it } from 'vitest';
import { createGomoku, applyGomoku, takeBack, GOMOKU_SIZE } from '../games/gomoku.js';
import { createBanqi, applyBanqi, banqiView, targetsFrom, canCapture, BANQI_COLS, PIECE_SCORE } from '../games/banqi.js';
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

  it('悔棋：对方同意后退回，次数 -1；拒绝不扣次数', () => {
    let s = createGomoku();
    s = applyGomoku(s, 1, { type: 'place', i: 0 }).state;
    s = applyGomoku(s, 2, { type: 'place', i: 1 }).state;
    // 轮到黑，黑请求悔棋 → 退两手（白的和自己的）
    s = applyGomoku(s, 1, { type: 'undo-request' }).state;
    expect(s.undoRequest).toEqual({ seat: 1, count: 2 });
    expect(applyGomoku(s, 1, { type: 'undo-request' }).ok).toBe(false); // 不能重复请求
    const declined = applyGomoku(s, 2, { type: 'undo-respond', accept: false }).state;
    expect(declined.undos[1]).toBe(3);
    expect(declined.undoEvent).toMatchObject({ seat: 1, accepted: false });
    const accepted = applyGomoku(s, 2, { type: 'undo-respond', accept: true }).state;
    expect(accepted.moves).toEqual([]);
    expect(accepted.board[0]).toBe(0);
    expect(accepted.turn).toBe(1);
    expect(accepted.undos[1]).toBe(2);
  });

  it('悔棋：刚下完只退自己一手；用完 3 次后被拒；对方落子视为拒绝', () => {
    let s = createGomoku();
    s = applyGomoku(s, 1, { type: 'place', i: 0 }).state;
    s = applyGomoku(s, 1, { type: 'undo-request' }).state;
    expect(s.undoRequest.count).toBe(1);
    const ignored = applyGomoku(s, 2, { type: 'place', i: 5 }).state;
    expect(ignored.undoRequest).toBeNull();
    expect(ignored.undoEvent).toMatchObject({ seat: 1, accepted: false });
    for (let k = 0; k < 3; k++) {
      s = applyGomoku(s, 2, { type: 'undo-respond', accept: true }).state;
      s = applyGomoku(s, 1, { type: 'place', i: 0 }).state;
      if (k < 2) s = applyGomoku(s, 1, { type: 'undo-request' }).state;
    }
    expect(s.undos[1]).toBe(0);
    expect(applyGomoku(s, 1, { type: 'undo-request' }).error).toBe('悔棋次数已用完');
    // 白还没下过子
    expect(applyGomoku(createGomoku(), 2, { type: 'undo-request' }).ok).toBe(false);
  });

  it('单人悔棋 takeBack 立即生效并轮回自己', () => {
    let s = createGomoku();
    s = applyGomoku(s, 1, { type: 'place', i: 0 }).state;
    s = applyGomoku(s, 2, { type: 'place', i: 1 }).state;
    const r = takeBack(s, 1);
    expect(r.ok).toBe(true);
    expect(r.state.moves).toEqual([]);
    expect(r.state.turn).toBe(1);
    expect(r.state.undos[1]).toBe(2);
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

  it('炮隔一子打：暗子可作炮架也可被打，不能吃相邻', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 2)]: '?bK', [bq(0, 4)]: 'bK', [bq(1, 0)]: 'bA', [bq(2, 0)]: '?rP', [bq(3, 0)]: '?bN' });
    const t = targetsFrom(s.cells, bq(0, 0));
    expect(t).toContain(bq(0, 4));         // 隔暗子打远处的明将
    expect(t).toContain(bq(0, 1));         // 空格照常走一步
    expect(t).not.toContain(bq(1, 0));     // 相邻不能吃
    expect(t).not.toContain(bq(0, 2));     // 与炮之间没有炮架：打不到
    expect(t).toContain(bq(2, 0));         // 隔 1,0 打暗子（是自己的红兵也能打）
    expect(t).not.toContain(bq(3, 0));     // 隔了两个子

    // 两个炮架：打不到
    const s2 = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 1)]: 'bP', [bq(0, 2)]: '?bK', [bq(0, 4)]: 'bK' });
    expect(targetsFrom(s2.cells, bq(0, 0))).not.toContain(bq(0, 4));
  });

  it('炮打暗子：揭晓并移除，打到自己的子算自己损失', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 1)]: 'bP', [bq(0, 2)]: '?rN', [bq(3, 7)]: 'bR', [bq(2, 7)]: 'rK' });
    const r = applyBanqi(s, 1, { type: 'move', from: bq(0, 0), to: bq(0, 2) });
    expect(r.ok).toBe(true);
    expect(r.state.cells[bq(0, 2)]).toMatchObject({ c: 'r', t: 'C', up: true });
    expect(r.state.captured.r).toEqual(['N']);
    expect(r.state.last.hidden).toEqual({ c: 'r', t: 'N' });
    expect(r.state.quiet).toBe(0);
  });

  it('炮的目标在前端视图（暗子无颜色信息）上同样成立', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 1)]: '?bP', [bq(0, 2)]: '?rN', [bq(2, 0)]: 'bA', [bq(3, 0)]: '?bK' });
    const view = banqiView(s);
    const t = targetsFrom(view.cells, bq(0, 0));
    expect(t).toEqual(expect.arrayContaining([bq(0, 2), bq(3, 0)]));
    expect(t).toEqual(targetsFrom(s.cells, bq(0, 0)).sort((a, b) => a - b).filter((x) => t.includes(x)));
  });

  it('分数：吃子得分、以小博大、炮轰暗子、连杀、误伤友军', () => {
    // 兵吃将：50 + 10
    let s = banqiWith({ [bq(1, 1)]: 'rP', [bq(1, 2)]: 'bK', [bq(3, 7)]: 'bR', [bq(0, 0)]: 'rC', [bq(0, 2)]: 'bN', [bq(0, 3)]: '?bA', [bq(2, 0)]: 'rN', [bq(2, 4)]: '?rE' });
    s = { ...s, cells: s.cells.map((p, i) => (i === bq(0, 1) ? { c: 'b', t: 'P', up: true } : p)) };
    let r = applyBanqi(s, 1, { type: 'move', from: bq(1, 1), to: bq(1, 2) });
    expect(r.state.last.kill).toMatchObject({ points: PIECE_SCORE.K + 10, labels: ['斩将', '以小博大'], combo: 1 });
    expect(r.state.scores[1]).toBe(60);
    // 黑走一步，红再吃：炮隔 0,1 打 0,2 的黑马 → 炮(2)打马(3) 以小博大 + 连杀 ×2（10 + 10 + 5）
    r = applyBanqi(r.state, 2, { type: 'move', from: bq(3, 7), to: bq(3, 6) });
    r = applyBanqi(r.state, 1, { type: 'move', from: bq(0, 0), to: bq(0, 2) });
    expect(r.state.last.kill).toMatchObject({ points: PIECE_SCORE.N + 10 + 5, combo: 2 });
    expect(r.state.last.kill.labels).toEqual(['以小博大', '连杀 ×2']);
    expect(r.state.scores[1]).toBe(85);
    // 翻子会中断连杀
    r = applyBanqi(r.state, 2, { type: 'move', from: bq(3, 6), to: bq(3, 5) });
    r = applyBanqi(r.state, 1, { type: 'flip', i: bq(2, 4) });
    expect(r.state.streak[1]).toBe(0);
    expect(r.state.ply).toBe(5);
  });

  it('误伤友军：炮打到自己的暗子不得分', () => {
    const s = banqiWith({ [bq(0, 0)]: 'rC', [bq(0, 1)]: 'bP', [bq(0, 2)]: '?rN', [bq(3, 7)]: 'bR', [bq(2, 7)]: 'rK' });
    const r = applyBanqi(s, 1, { type: 'move', from: bq(0, 0), to: bq(0, 2) });
    expect(r.state.last.kill).toMatchObject({ points: 0, own: true, labels: ['误伤友军'] });
    expect(r.state.scores[1]).toBe(0);
  });

  it('非炮的子不能吃暗子', () => {
    const s = banqiWith({ [bq(1, 1)]: 'rK', [bq(1, 2)]: '?bP' });
    expect(targetsFrom(s.cells, bq(1, 1))).not.toContain(bq(1, 2));
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

// ---------- 双人合作扫雷 ----------
import { createCoopMines, applyCoopMines, coopMinesView } from '../games/coopMines.js';

describe('coopMines', () => {
  const start = (difficulty = 'beginner') => {
    const s = createCoopMines(() => 0.42, { difficulty });
    const center = Math.floor(s.rows / 2) * s.cols + Math.floor(s.cols / 2);
    return { s, center };
  };

  it('首击生成无猜雷区并翻开一片，回合交给队友', () => {
    const { s, center } = start();
    const r = applyCoopMines(s, 1, { type: 'reveal', i: center });
    expect(r.ok).toBe(true);
    expect(r.state.mines.filter(Boolean)).toHaveLength(10);
    expect(r.state.revealed[center]).toBe(1);
    expect(r.state.turn).toBe(2);
    expect(r.state.revealedBy[1]).toBeGreaterThan(0);
    expect(applyCoopMines(r.state, 1, { type: 'reveal', i: 0 }).error).toBe('还没轮到你');
  });

  it('插旗不占回合、谁都能插；插了旗的格子不能直接翻', () => {
    const { s, center } = start();
    let st = applyCoopMines(s, 1, { type: 'reveal', i: center }).state;
    const mine = st.mines.findIndex(Boolean);
    st = applyCoopMines(st, 1, { type: 'flag', i: mine }).state; // 不是 seat 1 的回合也能插
    expect(st.flags[mine]).toBe(1);
    expect(st.turn).toBe(2);
    expect(applyCoopMines(st, 2, { type: 'reveal', i: mine }).ok).toBe(false);
  });

  it('踩雷一起输，记录是谁踩的；结束后视图才公开雷位', () => {
    const { s, center } = start();
    const st = applyCoopMines(s, 1, { type: 'reveal', i: center }).state;
    const mine = st.mines.findIndex(Boolean);
    expect(coopMinesView(st).mineList).toBeNull();
    const r = applyCoopMines(st, 2, { type: 'reveal', i: mine });
    expect(r.state.coopResult).toBe('lost');
    expect(r.state.explodedBy).toBe(2);
    expect(coopMinesView(r.state).mineList).toContain(mine);
  });

  it('视图不泄露雷区与种子', () => {
    const { s, center } = start('intermediate');
    const st = applyCoopMines(s, 1, { type: 'reveal', i: center }).state;
    const v = coopMinesView(st);
    expect(v.mines).toBeUndefined();
    expect(v.nums).toBeUndefined();
    expect(v.seed).toBeUndefined();
    expect(v.cells.filter((c) => c === -1).length).toBe(v.revealed.filter((x) => !x).length);
  });

  it('两人轮流只翻安全格可以一起通关（逐格翻开所有非雷格）', () => {
    const { s, center } = start();
    let st = applyCoopMines(s, 1, { type: 'reveal', i: center }).state;
    for (let i = 0; i < st.mines.length && !st.coopResult; i++) {
      if (st.mines[i] || st.revealed[i]) continue;
      st = applyCoopMines(st, st.turn, { type: 'reveal', i }).state;
    }
    expect(st.coopResult).toBe('won');
    expect(st.revealedBy[1] + st.revealedBy[2]).toBe(81 - 10);
  });

  it('chord：旗数等于数字时翻开周围（算一回合）', () => {
    const { s, center } = start();
    let st = applyCoopMines(s, 1, { type: 'reveal', i: center }).state;
    // 找一个已翻开、周围有未翻开格子的数字，插满它周围的雷再 chord
    const nb = (i) => { const r = Math.floor(i / 9); const c = i % 9; const o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr; const cc = c + dc; if ((dr || dc) && rr >= 0 && rr < 9 && cc >= 0 && cc < 9) o.push(rr * 9 + cc); } return o; };
    const k = st.revealed.findIndex((v, i) => v && st.nums[i] > 0 && nb(i).some((j) => !st.revealed[j] && !st.mines[j]));
    expect(k).toBeGreaterThanOrEqual(0);
    for (const j of nb(k)) if (st.mines[j]) st = applyCoopMines(st, 1, { type: 'flag', i: j }).state;
    const before = st.revealed.filter(Boolean).length;
    const r = applyCoopMines(st, 2, { type: 'reveal', i: k });
    expect(r.ok).toBe(true);
    expect(r.state.revealed.filter(Boolean).length).toBeGreaterThan(before);
    expect(r.state.turn).toBe(1);
  });
});

describe('gameRooms：双人合作扫雷', () => {
  it('邀请带难度、合作通关以 coop-won 结束、再来一局沿用难度', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'coopmines', options: { difficulty: 'beginner' } });
    const inv = h.last(2, 'game:invited').invite;
    expect(inv.options).toEqual({ difficulty: 'beginner' });
    await h.rooms.handle(h.conn(2), { type: 'game:respond', inviteId: inv.id, accept: true });
    let room = h.last(1, 'game:room').room;
    expect(room.state.rows).toBe(9);
    expect(room.state.cells.every((c) => c === -1)).toBe(true);

    const internal = h.rooms._rooms.get(room.id);
    await h.rooms.handle(h.conn(room.players[0]), { type: 'game:action', roomId: room.id, action: { type: 'reveal', i: 40 } });
    while (internal.status === 'playing') {
      const st = internal.state;
      const i = st.mines.findIndex((m, k) => !m && !st.revealed[k]);
      await h.rooms.handle(h.conn(internal.players[st.turn - 1]), { type: 'game:action', roomId: room.id, action: { type: 'reveal', i } });
    }
    room = h.last(1, 'game:room').room;
    expect(room.result).toEqual({ winner: 0, reason: 'coop-won' });
    expect(room.state.mineList).toHaveLength(10);

    await h.rooms.handle(h.conn(1), { type: 'game:rematch', roomId: room.id });
    await h.rooms.handle(h.conn(2), { type: 'game:rematch', roomId: room.id });
    const next = h.last(1, 'game:room').room;
    expect(next.id).not.toBe(room.id);
    expect(next.state.difficulty).toBe('beginner');
    expect(next.players).toEqual([...room.players].reverse());
  });

  it('非法难度回落到中级；未知游戏被拒', async () => {
    const h = harness();
    await h.rooms.handle(h.conn(1), { type: 'game:invite', to: 2, game: 'coopmines', options: { difficulty: '__proto__' } });
    expect(h.last(2, 'game:invited').invite.options).toEqual({ difficulty: 'intermediate' });
  });
});
