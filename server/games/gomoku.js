/**
 * gomoku.js — 五子棋规则（纯函数，服务端裁判与前端共用）。
 *
 * 15×15，黑先（seat 1 执黑），横竖斜连成 ≥5 子即胜（自由规则，不设禁手）。
 * 棋盘下满无人连五判和。
 *
 * 悔棋：每方每局 UNDO_LIMIT 次。
 *   - 好友对战：'undo-request' → 对方 'undo-respond' { accept }；被拒绝不扣次数；
 *     对方在请求未决时落子视为拒绝。
 *   - 单人模式：takeBack() 立即生效（无需同意）。
 *   悔棋步数：最后一手是自己下的 → 退 1 手；否则（对方刚下）→ 退 2 手，轮回自己。
 */

export const GOMOKU_SIZE = 15;
export const UNDO_LIMIT = 3;

export function createGomoku() {
  return {
    board: new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0), // 0 空 / 1 黑 / 2 白
    turn: 1,
    moves: [],
    winner: 0,      // 0 未分 / 1 / 2
    draw: false,
    winLine: null,  // 连五的格子下标
    undos: { 1: UNDO_LIMIT, 2: UNDO_LIMIT },
    undoRequest: null,  // { seat, count }
    undoEvent: null,    // { seat, accepted, n }：最近一次悔棋请求的结果，n 递增供前端提示
  };
}

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function lineThrough(board, i, seat) {
  const r0 = Math.floor(i / GOMOKU_SIZE);
  const c0 = i % GOMOKU_SIZE;
  for (const [dr, dc] of DIRS) {
    const line = [i];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < GOMOKU_SIZE && c >= 0 && c < GOMOKU_SIZE && board[r * GOMOKU_SIZE + c] === seat) {
        line.push(r * GOMOKU_SIZE + c);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/** 第 k 手（0 起）是谁下的：黑先 */
const moverOf = (k) => (k % 2 === 0 ? 1 : 2);

/** seat 现在悔棋要退几手；0 表示不能悔（自己还没下过子） */
export function undoCount(state, seat) {
  const n = state.moves.length;
  if (n === 0) return 0;
  if (moverOf(n - 1) === seat) return 1;
  return n >= 2 ? 2 : 0;
}

function rollback(state, seat, count) {
  const board = state.board.slice();
  const moves = state.moves.slice(0, state.moves.length - count);
  for (const i of state.moves.slice(state.moves.length - count)) board[i] = 0;
  return {
    ...state,
    board,
    moves,
    turn: moves.length % 2 === 0 ? 1 : 2,
    undos: { ...state.undos, [seat]: state.undos[seat] - 1 },
    undoRequest: null,
  };
}

function checkCanUndo(state, seat) {
  if (state.winner || state.draw) return '对局已结束';
  if (state.undos[seat] <= 0) return '悔棋次数已用完';
  if (!undoCount(state, seat)) return '你还没有落子';
  return null;
}

/** 单人模式：立即悔棋 */
export function takeBack(state, seat) {
  const error = checkCanUndo(state, seat);
  if (error) return { ok: false, error };
  return { ok: true, state: rollback(state, seat, undoCount(state, seat)) };
}

/**
 * action = { type: 'place', i } | { type: 'undo-request' } | { type: 'undo-respond', accept }
 * @returns {{ ok: true, state } | { ok: false, error }}
 */
export function applyGomoku(state, seat, action) {
  if (state.winner || state.draw) return { ok: false, error: '对局已结束' };
  if (!action || typeof action !== 'object') return { ok: false, error: '无效操作' };
  const other = seat === 1 ? 2 : 1;
  const prevN = state.undoEvent?.n ?? 0;

  if (action.type === 'undo-request') {
    if (state.undoRequest) return { ok: false, error: '已有一个悔棋请求在等待回应' };
    const error = checkCanUndo(state, seat);
    if (error) return { ok: false, error };
    return { ok: true, state: { ...state, undoRequest: { seat, count: undoCount(state, seat) } } };
  }

  if (action.type === 'undo-respond') {
    const req = state.undoRequest;
    if (!req || req.seat !== other) return { ok: false, error: '没有待回应的悔棋请求' };
    const undoEvent = { seat: req.seat, accepted: !!action.accept, n: prevN + 1 };
    if (!action.accept) return { ok: true, state: { ...state, undoRequest: null, undoEvent } };
    return { ok: true, state: { ...rollback(state, req.seat, req.count), undoEvent } };
  }

  if (action.type !== 'place') return { ok: false, error: '无效操作' };
  if (seat !== state.turn) return { ok: false, error: '还没轮到你' };
  const { i } = action;
  if (!Number.isInteger(i) || i < 0 || i >= state.board.length) return { ok: false, error: '无效位置' };
  if (state.board[i]) return { ok: false, error: '这里已经有子了' };

  const board = state.board.slice();
  board[i] = seat;
  const winLine = lineThrough(board, i, seat);
  const moves = [...state.moves, i];
  // 请求未决时：对方落子 = 拒绝；请求者自己落子 = 撤回请求（不发拒绝提示）
  const req = state.undoRequest;
  const undoEvent = req && req.seat !== seat ? { seat: req.seat, accepted: false, n: prevN + 1 } : state.undoEvent;
  return {
    ok: true,
    state: {
      ...state,
      board,
      moves,
      turn: other,
      winner: winLine ? seat : 0,
      draw: !winLine && moves.length === board.length,
      winLine,
      undoRequest: null,
      undoEvent,
    },
  };
}

/** 五子棋无隐藏信息，双方视图相同 */
export function gomokuView(state) {
  return state;
}
