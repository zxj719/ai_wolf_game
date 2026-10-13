/**
 * banqi.js — 中国象棋翻翻棋（暗棋）规则（纯函数，服务端裁判与前端共用）。
 *
 * 棋盘 4 行 × 8 列，32 枚棋子背面朝上随机摆放。
 *   - 每回合三选一：翻开一枚暗子 / 己方明子走一步（上下左右）到空格 / 吃子。
 *   - 首个翻子的玩家执该棋子的颜色，对方执另一色。
 *   - 等级：帅将 7 > 仕士 6 > 相象 5 > 车 4 > 马 3 > 炮 2 > 兵卒 1。
 *     大吃小、同级互吃；例外：兵卒可吃帅将，帅将不能吃兵卒。
 *   - 炮：走法同其它子（一步）；吃子须隔且只隔一枚棋子（明暗皆可作炮架），
 *     沿直线吃任意距离、任意等级的对方明子；炮不能直接吃相邻的子。
 *   - 只能吃对方「明子」，暗子不能被吃。
 *   - 胜负：轮到某方时其已无棋子、或无任何合法操作 → 该方负。
 *     连续 50 步（双方合计）无翻子无吃子 → 和棋。
 *
 * 隐藏信息：完整局面只在服务端；banqiView 把暗子投影成 { up: false }，
 * 不泄露颜色与兵种。前端只拿视图算可走点（合法性只依赖明面信息）。
 */

export const BANQI_ROWS = 4;
export const BANQI_COLS = 8;
export const QUIET_LIMIT = 50;

export const RANK = { K: 7, A: 6, E: 5, R: 4, N: 3, C: 2, P: 1 };
const COUNTS = { K: 1, A: 2, E: 2, R: 2, N: 2, C: 2, P: 5 };
export const PIECE_NAMES = {
  r: { K: '帥', A: '仕', E: '相', R: '俥', N: '傌', C: '炮', P: '兵' },
  b: { K: '將', A: '士', E: '象', R: '車', N: '馬', C: '砲', P: '卒' },
};

export function createBanqi(rand = Math.random) {
  const pieces = [];
  for (const c of ['r', 'b']) {
    for (const [t, n] of Object.entries(COUNTS)) for (let k = 0; k < n; k++) pieces.push({ c, t, up: false });
  }
  for (let k = pieces.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [pieces[k], pieces[j]] = [pieces[j], pieces[k]];
  }
  return {
    cells: pieces,              // 下标 = 行 * 8 + 列
    turn: 1,                    // seat 1 先手
    colors: { 1: null, 2: null },
    quiet: 0,
    winner: 0,
    draw: false,
    last: null,                 // { type, from?, to?, i? }
    captured: { r: [], b: [] }, // 被吃掉的子（按颜色）
  };
}

export function canCapture(attacker, defender) {
  if (attacker.t === 'P' && defender.t === 'K') return true;
  if (attacker.t === 'K' && defender.t === 'P') return false;
  return RANK[attacker.t] >= RANK[defender.t];
}

function rc(i) { return [Math.floor(i / BANQI_COLS), i % BANQI_COLS]; }
function idx(r, c) { return r * BANQI_COLS + c; }
function inside(r, c) { return r >= 0 && r < BANQI_ROWS && c >= 0 && c < BANQI_COLS; }

/**
 * 某明子的所有目标格（走或吃）。cells 可以是完整局面或视图（只读明面信息）。
 */
export function targetsFrom(cells, from) {
  const p = cells[from];
  if (!p || !p.up) return [];
  const [r0, c0] = rc(from);
  const out = [];
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    // 一步：空格可走；非炮可吃相邻的对方明子
    const r1 = r0 + dr;
    const c1 = c0 + dc;
    if (inside(r1, c1)) {
      const q = cells[idx(r1, c1)];
      if (!q) out.push(idx(r1, c1));
      else if (p.t !== 'C' && q.up && q.c !== p.c && canCapture(p, q)) out.push(idx(r1, c1));
    }
    // 炮：隔一子打
    if (p.t === 'C') {
      let r = r1;
      let c = c1;
      let screens = 0;
      while (inside(r, c)) {
        const q = cells[idx(r, c)];
        if (q) {
          if (screens === 1) {
            if (q.up && q.c !== p.c) out.push(idx(r, c));
            break;
          }
          screens++;
        }
        r += dr;
        c += dc;
      }
    }
  }
  return out;
}

/** seat 当前是否有任何合法操作 */
export function hasAnyAction(state, seat) {
  const color = state.colors[seat];
  if (state.cells.some((p) => p && !p.up)) return true; // 还能翻子
  if (!color) return false;
  return state.cells.some((p, i) => p && p.up && p.c === color && targetsFrom(state.cells, i).length > 0);
}

function remaining(state, color) {
  return state.cells.filter((p) => p && p.c === color).length;
}

/**
 * action = { type: 'flip', i } | { type: 'move', from, to }
 * @returns {{ ok: true, state, revealed? } | { ok: false, error }}
 */
export function applyBanqi(state, seat, action) {
  if (state.winner || state.draw) return { ok: false, error: '对局已结束' };
  if (seat !== state.turn) return { ok: false, error: '还没轮到你' };
  if (!action || typeof action !== 'object') return { ok: false, error: '无效操作' };

  const cells = state.cells.slice();
  const colors = { ...state.colors };
  const captured = { r: state.captured.r.slice(), b: state.captured.b.slice() };
  let quiet = state.quiet + 1;
  let last;
  const valid = (i) => Number.isInteger(i) && i >= 0 && i < cells.length;

  if (action.type === 'flip') {
    const { i } = action;
    if (!valid(i) || !cells[i] || cells[i].up) return { ok: false, error: '只能翻开暗子' };
    cells[i] = { ...cells[i], up: true };
    if (!colors[1]) {
      colors[seat] = cells[i].c;
      colors[seat === 1 ? 2 : 1] = cells[i].c === 'r' ? 'b' : 'r';
    }
    quiet = 0;
    last = { type: 'flip', i };
  } else if (action.type === 'move') {
    const { from, to } = action;
    if (!valid(from) || !valid(to)) return { ok: false, error: '无效位置' };
    const p = cells[from];
    if (!colors[seat] || !p || !p.up || p.c !== colors[seat]) return { ok: false, error: '只能走自己的明子' };
    if (!targetsFrom(cells, from).includes(to)) return { ok: false, error: '这步棋不合规则' };
    if (cells[to]) {
      captured[cells[to].c].push(cells[to].t);
      quiet = 0;
    }
    cells[to] = p;
    cells[from] = null;
    last = { type: 'move', from, to, capture: quiet === 0 };
  } else {
    return { ok: false, error: '无效操作' };
  }

  const next = { ...state, cells, colors, captured, quiet, last, turn: seat === 1 ? 2 : 1 };
  const oppSeat = next.turn;
  const oppColor = colors[oppSeat];
  if (oppColor && (remaining(next, oppColor) === 0 || !hasAnyAction(next, oppSeat))) next.winner = seat;
  else if (quiet >= QUIET_LIMIT) next.draw = true;
  return { ok: true, state: next };
}

/** 给某一方的视图：暗子不透露颜色与兵种 */
export function banqiView(state) {
  return { ...state, cells: state.cells.map((p) => (p && !p.up ? { up: false } : p)) };
}
