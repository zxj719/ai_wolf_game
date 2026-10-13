/**
 * coopMines.js — 双人合作扫雷（纯函数；服务端保管雷区，前端只拿视图）。
 *
 *   - 两人轮流行动：每回合一次「翻开」（点未翻开的格子，或点数字做 chord）。
 *   - 插旗不占回合：任何人任何时候都能插 / 拔共享的旗子，给队友标雷。
 *   - 雷区在第一次翻开时用无猜生成器生成（首击 3×3 必空、全盘可推理）。
 *   - 共同胜负：翻开所有安全格一起赢；任何人踩雷一起输（结果里记录是谁踩的）。
 *
 * 隐藏信息：mines 只在服务端；coopMinesView 只给已翻开格子的数字，结束后才公开雷位。
 */

import { DIFFICULTIES, buildNeighbors, computeNumbers, generateNoGuessBoard } from './mineEngine.js';

export const COOP_DIFFICULTIES = DIFFICULTIES;
const DEFAULT_DIFFICULTY = 'intermediate';

export function normalizeCoopOptions(options) {
  const d = options && typeof options.difficulty === 'string' && Object.hasOwn(DIFFICULTIES, options.difficulty)
    ? options.difficulty : DEFAULT_DIFFICULTY;
  return { difficulty: d };
}

export function createCoopMines(rand = Math.random, options = {}) {
  const { difficulty } = normalizeCoopOptions(options);
  const d = DIFFICULTIES[difficulty];
  const n = d.rows * d.cols;
  return {
    difficulty,
    rows: d.rows,
    cols: d.cols,
    mineCount: d.mines,
    seed: Math.floor(rand() * 2 ** 32) >>> 0,
    mines: null,               // 首次翻开后生成（仅服务端）
    nums: null,
    revealed: new Array(n).fill(0),
    flags: new Array(n).fill(0),
    turn: 1,
    revealedBy: { 1: 0, 2: 0 },
    lastI: -1,                 // 最近一次翻开的格子（前端做波纹动画）
    lastBy: 0,
    exploded: -1,
    explodedBy: 0,
    coopResult: null,          // 'won' | 'lost'
    winner: 0,
    draw: false,
    ply: 0,
  };
}

function flood(state, neighbors, i, seat, revealed) {
  let opened = 0;
  const stack = [i];
  if (!revealed[i]) { revealed[i] = 1; opened++; }
  while (stack.length) {
    const k = stack.pop();
    if (state.nums[k] !== 0) continue;
    for (const j of neighbors[k]) {
      if (!revealed[j] && !state.flags[j]) { revealed[j] = 1; opened++; stack.push(j); }
    }
  }
  return opened;
}

/**
 * action = { type: 'reveal', i } | { type: 'flag', i }
 */
export function applyCoopMines(state, seat, action) {
  if (state.coopResult) return { ok: false, error: '对局已结束' };
  if (!action || typeof action !== 'object') return { ok: false, error: '无效操作' };
  const n = state.rows * state.cols;
  const { i } = action;
  if (!Number.isInteger(i) || i < 0 || i >= n) return { ok: false, error: '无效位置' };

  if (action.type === 'flag') {
    if (!state.mines) return { ok: false, error: '先翻开第一格再插旗' };
    if (state.revealed[i]) return { ok: false, error: '这格已经翻开了' };
    const flags = state.flags.slice();
    flags[i] = flags[i] ? 0 : seat; // 记录是谁插的旗
    return { ok: true, state: { ...state, flags } };
  }

  if (action.type !== 'reveal') return { ok: false, error: '无效操作' };
  if (seat !== state.turn) return { ok: false, error: '还没轮到你' };
  if (state.flags[i]) return { ok: false, error: '这格插了旗，先拔掉再翻' };

  let { mines, nums } = state;
  const neighbors = buildNeighbors(state.rows, state.cols);
  if (!mines) {
    const gen = generateNoGuessBoard({
      rows: state.rows, cols: state.cols, mines: state.mineCount, start: i, seed: state.seed,
    });
    mines = Array.from(gen.mines);
    nums = Array.from(computeNumbers(gen.mines, neighbors));
  }
  const work = { ...state, mines, nums };
  const revealed = state.revealed.slice();

  // 要翻开的格子：未翻开 → 自己；已翻开的数字 → chord（旗数相符时翻开周围）
  let targets;
  if (revealed[i]) {
    const num = nums[i];
    const around = neighbors[i];
    const flagged = around.filter((j) => state.flags[j]).length;
    const closed = around.filter((j) => !revealed[j] && !state.flags[j]);
    if (num <= 0 || flagged !== num || !closed.length) return { ok: false, error: '这里没有可以翻开的格子' };
    targets = closed;
  } else {
    targets = [i];
  }

  let exploded = -1;
  let opened = 0;
  for (const t of targets) {
    if (mines[t]) { exploded = t; continue; }
    opened += flood(work, neighbors, t, seat, revealed);
  }

  const next = {
    ...work,
    revealed,
    revealedBy: { ...state.revealedBy, [seat]: state.revealedBy[seat] + opened },
    lastI: i,
    lastBy: seat,
    turn: seat === 1 ? 2 : 1,
    ply: state.ply + 1,
  };
  if (exploded >= 0) {
    next.exploded = exploded;
    next.explodedBy = seat;
    next.coopResult = 'lost';
  } else if (revealed.reduce((a, b) => a + b, 0) === n - state.mineCount) {
    next.coopResult = 'won';
  }
  return { ok: true, state: next };
}

/** 视图：未翻开格子不透露任何信息；结束后公开雷位 */
export function coopMinesView(state) {
  const n = state.rows * state.cols;
  const over = !!state.coopResult;
  const cells = new Array(n);
  for (let i = 0; i < n; i++) cells[i] = state.revealed[i] ? state.nums[i] : -1;
  const { mines, nums, seed, ...rest } = state; // 雷区、种子都不下发
  return {
    ...rest,
    started: !!mines,
    cells,
    mineList: over && mines ? mines.map((m, i) => (m ? i : -1)).filter((i) => i >= 0) : null,
  };
}
