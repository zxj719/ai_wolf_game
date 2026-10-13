/**
 * gomokuAI.js — 单人模式电脑对手。
 *
 * 算法：「五元组窗口」估值 + Alpha-Beta 极小化极大（Negamax）+ 迭代加深；困难档先跑 VCF。
 *
 * 1. 窗口估值：棋盘上所有连续 5 格（共 572 个）都是潜在的五连。只含一方棋子的窗口按子数计分
 *    WINDOW[k]，双方都有子的窗口是死窗口记 0。活三比眠三落在更多活窗口里，开放性自然体现。
 *    落一子只影响经过它的 ≤20 个窗口，估值 O(20) 增量更新。
 * 2. 走法生成：只考虑已有棋子两格内的空点，按「进攻增益 + 防守增益」排序后截取前 K 个；
 *    有一步成五直接走，对方有成五点必须先堵（强制着法剪枝）。
 * 3. Negamax + Alpha-Beta + 迭代加深，按难度限深度与时间。
 * 4. VCF（连续冲四取胜）：冲四只有唯一应手，搜索树很窄，可以算到 12+ 手深，
 *    困难档每步先找一遍己方 VCF，找到就直接执行必胜序列。
 */

import { GOMOKU_SIZE } from '../../../../server/games/gomoku.js';

const N = GOMOKU_SIZE;
const CELLS = N * N;
const WIN = 1e9;
const WINDOW = [0, 1, 12, 150, 2500, 1e7];

// ---- 预计算窗口 ----
const WINDOWS = [];
for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const er = r + dr * 4;
      const ec = c + dc * 4;
      if (er < 0 || er >= N || ec < 0 || ec >= N) continue;
      const cells = [];
      for (let k = 0; k < 5; k++) cells.push((r + dr * k) * N + (c + dc * k));
      WINDOWS.push(cells);
    }
  }
}
const CELL_WINDOWS = Array.from({ length: CELLS }, () => []);
WINDOWS.forEach((cells, w) => cells.forEach((i) => CELL_WINDOWS[i].push(w)));
const NEAR = Array.from({ length: CELLS }, (_, i) => {
  const r = Math.floor(i / N);
  const c = i % N;
  const out = [];
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  }
  return out;
});

export const LEVELS = {
  easy: { label: '简单', depth: 2, timeMs: 300, width: 8, vcf: false, noise: 0.35 },
  medium: { label: '中等', depth: 4, timeMs: 700, width: 10, vcf: false, noise: 0 },
  hard: { label: '困难', depth: 8, timeMs: 1600, width: 12, vcf: true, noise: 0 },
};

/** 搜索用的可变局面 */
class Position {
  constructor(board) {
    this.board = Int8Array.from(board);
    this.cnt = [null, new Int8Array(WINDOWS.length), new Int8Array(WINDOWS.length)];
    this.evalBlack = 0;
    this.stones = 0;
    this.won = 0;
    for (let i = 0; i < CELLS; i++) {
      if (this.board[i]) {
        const c = this.board[i];
        this.board[i] = 0;
        this.place(i, c);
      }
    }
  }

  contrib(w) {
    const b = this.cnt[1][w];
    const wh = this.cnt[2][w];
    if (b && !wh) return WINDOW[b];
    if (wh && !b) return -WINDOW[wh];
    return 0;
  }

  place(i, c) {
    this.board[i] = c;
    this.stones++;
    for (const w of CELL_WINDOWS[i]) {
      const before = this.contrib(w);
      this.cnt[c][w]++;
      this.evalBlack += this.contrib(w) - before;
      if (this.cnt[c][w] === 5) this.won = c;
    }
  }

  unplace(i) {
    const c = this.board[i];
    for (const w of CELL_WINDOWS[i]) {
      const before = this.contrib(w);
      this.cnt[c][w]--;
      this.evalBlack += this.contrib(w) - before;
    }
    this.board[i] = 0;
    this.stones--;
    this.won = 0;
  }

  evaluate(c) {
    return c === 1 ? this.evalBlack : -this.evalBlack;
  }

  /** c 方一步成五的点 */
  fivePoints(c) {
    const o = 3 - c;
    const pts = new Set();
    for (let w = 0; w < WINDOWS.length; w++) {
      if (this.cnt[c][w] === 4 && this.cnt[o][w] === 0) {
        for (const i of WINDOWS[w]) if (!this.board[i]) pts.add(i);
      }
    }
    return pts;
  }

  /** 走 i 后 c 方的局部增益（进攻 + 防守），用于排序 */
  gain(i, c) {
    const o = 3 - c;
    let g = 0;
    for (const w of CELL_WINDOWS[i]) {
      const own = this.cnt[c][w];
      const opp = this.cnt[o][w];
      if (!opp) g += WINDOW[own + 1] - WINDOW[own];
      if (!own && opp) g += WINDOW[opp] * 0.9;
    }
    return g;
  }

  candidates() {
    if (!this.stones) return [Math.floor(CELLS / 2)];
    const seen = new Uint8Array(CELLS);
    const out = [];
    for (let i = 0; i < CELLS; i++) {
      if (!this.board[i]) continue;
      for (const j of NEAR[i]) {
        if (!this.board[j] && !seen[j]) { seen[j] = 1; out.push(j); }
      }
    }
    return out;
  }

  /** 排好序、带强制剪枝的走法 */
  orderedMoves(c, width) {
    const mine = this.fivePoints(c);
    if (mine.size) return [mine.values().next().value];
    const theirs = this.fivePoints(3 - c);
    if (theirs.size) return [...theirs].slice(0, 2); // 必须堵（两个以上已无解）
    const scored = this.candidates().map((i) => [i, this.gain(i, c)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, width).map((x) => x[0]);
  }
}

class Timeout extends Error {}

function negamax(pos, depth, alpha, beta, c, ctx, ply) {
  if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new Timeout();
  if (depth === 0) return pos.evaluate(c);
  const moves = pos.orderedMoves(c, ctx.width);
  if (!moves.length) return 0;
  let best = -Infinity;
  for (const m of moves) {
    pos.place(m, c);
    const score = pos.won === c ? WIN - ply : -negamax(pos, depth - 1, -beta, -alpha, 3 - c, ctx, ply + 1);
    pos.unplace(m);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** VCF：c 方连续冲四能否取胜，返回第一手或 -1 */
export function findVCF(pos, c, depth = 14, budget = { nodes: 0, max: 40000 }) {
  if (depth <= 0 || ++budget.nodes > budget.max) return -1;
  const o = 3 - c;
  const threats = pos.fivePoints(o);
  if (threats.size > 1) return -1;
  const fours = new Set();
  for (let w = 0; w < WINDOWS.length; w++) {
    if (pos.cnt[c][w] === 3 && pos.cnt[o][w] === 0) {
      for (const i of WINDOWS[w]) if (!pos.board[i]) fours.add(i);
    }
  }
  for (const m of fours) {
    if (threats.size && !threats.has(m)) continue; // 对方有冲四时，这手必须同时堵住
    pos.place(m, c);
    const pts = pos.fivePoints(c);
    let result = -1;
    if (pts.size >= 2) {
      result = m; // 双四 / 活四：对方堵不过来
    } else if (pts.size === 1) {
      const block = pts.values().next().value;
      pos.place(block, o);
      const oppWins = pos.won === o;
      if (!oppWins && findVCF(pos, c, depth - 1, budget) >= 0) result = m;
      pos.unplace(block);
    }
    pos.unplace(m);
    if (result >= 0) return result;
  }
  return -1;
}

/**
 * 计算电脑的下一手。
 * @param {number[]} board 0 空 / 1 黑 / 2 白
 * @param {1|2} color 电脑执的颜色
 * @param {'easy'|'medium'|'hard'} level
 */
export function chooseMove(board, color, level = 'medium', rand = Math.random) {
  const cfg = LEVELS[level] ?? LEVELS.medium;
  const pos = new Position(board);
  if (!pos.stones) return Math.floor(CELLS / 2);

  const forced = pos.orderedMoves(color, cfg.width);
  if (forced.length === 1 && (pos.fivePoints(color).size || pos.fivePoints(3 - color).size)) return forced[0];

  if (cfg.vcf) {
    const v = findVCF(pos, color);
    if (v >= 0) return v;
  }

  // 简单档：只看一层并加噪声，像个会犯错的新手
  if (cfg.noise) {
    const opts = pos.candidates().map((i) => [i, pos.gain(i, color) * (1 + (rand() - 0.5) * 2 * cfg.noise)]);
    opts.sort((a, b) => b[1] - a[1]);
    return opts[0][0];
  }

  const ctx = { nodes: 0, deadline: Date.now() + cfg.timeMs, width: cfg.width };
  const rootMoves = pos.orderedMoves(color, cfg.width + 4);
  let best = rootMoves[0];
  for (let depth = 2; depth <= cfg.depth; depth += 2) {
    try {
      let bestScore = -Infinity;
      let bestMove = best;
      let alpha = -Infinity;
      // 上一轮的最佳着法先搜，剪枝更多
      const order = [best, ...rootMoves.filter((m) => m !== best)];
      for (const m of order) {
        pos.place(m, color);
        const score = pos.won === color ? WIN : -negamax(pos, depth - 1, -Infinity, -alpha, 3 - color, ctx, 1);
        pos.unplace(m);
        if (score > bestScore) { bestScore = score; bestMove = m; }
        if (score > alpha) alpha = score;
      }
      best = bestMove;
      if (bestScore >= WIN - 100) break; // 已找到必胜
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break; // 超时：用上一轮完整搜索的结果
    }
  }
  return best;
}
