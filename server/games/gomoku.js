/**
 * gomoku.js — 五子棋规则（纯函数，服务端裁判与前端共用）。
 *
 * 15×15，黑先（seat 1 执黑），横竖斜连成 ≥5 子即胜（自由规则，不设禁手）。
 * 棋盘下满无人连五判和。
 */

export const GOMOKU_SIZE = 15;

export function createGomoku() {
  return {
    board: new Array(GOMOKU_SIZE * GOMOKU_SIZE).fill(0), // 0 空 / 1 黑 / 2 白
    turn: 1,
    moves: [],
    winner: 0,      // 0 未分 / 1 / 2
    draw: false,
    winLine: null,  // 连五的格子下标
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

/**
 * 落子。action = { type: 'place', i }
 * @returns {{ ok: true, state } | { ok: false, error }}
 */
export function applyGomoku(state, seat, action) {
  if (state.winner || state.draw) return { ok: false, error: '对局已结束' };
  if (seat !== state.turn) return { ok: false, error: '还没轮到你' };
  if (!action || action.type !== 'place') return { ok: false, error: '无效操作' };
  const { i } = action;
  if (!Number.isInteger(i) || i < 0 || i >= state.board.length) return { ok: false, error: '无效位置' };
  if (state.board[i]) return { ok: false, error: '这里已经有子了' };

  const board = state.board.slice();
  board[i] = seat;
  const winLine = lineThrough(board, i, seat);
  const moves = [...state.moves, i];
  return {
    ok: true,
    state: {
      board,
      moves,
      turn: seat === 1 ? 2 : 1,
      winner: winLine ? seat : 0,
      draw: !winLine && moves.length === board.length,
      winLine,
    },
  };
}

/** 五子棋无隐藏信息，双方视图相同 */
export function gomokuView(state) {
  return state;
}
