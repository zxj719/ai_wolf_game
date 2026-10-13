/**
 * mineEngine.js — 无猜扫雷（no-guess）生成器 + 纯逻辑求解器。
 *
 * 目标：雷的分布不是纯随机，而是保证「从首次点击开始，只靠逻辑推理就能翻开全部安全格」，
 * 不会出现被雷完全隔断、只能五五开去猜的局面。
 *
 * 做法：随机布雷（首击 3×3 必为空）→ 用逻辑求解器模拟一局 → 卡住时把边界上
 * 推不出的雷挪到未探索的内部区域（扰动）→ 重新求解，直到整盘可解。
 *
 * 求解器只用人类可复现的确定性推理：
 *   1. 单格规则（剩余雷数 = 0 → 全安全；= 未知格数 → 全是雷）
 *   2. 子集规则（A ⊆ B → B\A 的雷数 = B − A）
 *   3. 边界连通块穷举（≤ MAX_ENUM 格），所有可行解里恒安全 / 恒为雷的格
 *   4. 全局雷数（残局：剩余雷数与未知格数的关系）
 */

export const DIFFICULTIES = {
  beginner:     { key: 'beginner',     label: '初级', rows: 9,  cols: 9,  mines: 10 },
  intermediate: { key: 'intermediate', label: '中级', rows: 16, cols: 16, mines: 40 },
  expert:       { key: 'expert',       label: '高级', rows: 16, cols: 30, mines: 99 },
};

const MAX_ENUM = 22;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 预计算每格的邻居下标 */
export function buildNeighbors(rows, cols) {
  const nb = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) list.push(rr * cols + cc);
        }
      }
      nb[r * cols + c] = list;
    }
  }
  return nb;
}

export function computeNumbers(mines, neighbors) {
  const nums = new Int8Array(mines.length);
  for (let i = 0; i < mines.length; i++) {
    if (mines[i]) { nums[i] = -1; continue; }
    let n = 0;
    for (const j of neighbors[i]) n += mines[j];
    nums[i] = n;
  }
  return nums;
}

/**
 * 逻辑求解：从 start 开始只用确定性推理推进。
 * @returns {{ solved: boolean, revealed: Uint8Array, flagged: Uint8Array }}
 */
export function solveLogically(mines, rows, cols, start, neighbors = buildNeighbors(rows, cols)) {
  const n = rows * cols;
  const total = mines.reduce((a, b) => a + b, 0);
  const nums = computeNumbers(mines, neighbors);
  const revealed = new Uint8Array(n);
  const flagged = new Uint8Array(n);
  let safeLeft = n - total;

  const reveal = (i) => {
    if (revealed[i] || flagged[i]) return;
    if (mines[i]) throw new Error('solver revealed a mine'); // 推理错误 = bug
    const stack = [i];
    revealed[i] = 1;
    safeLeft--;
    while (stack.length) {
      const k = stack.pop();
      if (nums[k] !== 0) continue;
      for (const j of neighbors[k]) {
        if (!revealed[j] && !flagged[j]) {
          revealed[j] = 1;
          safeLeft--;
          stack.push(j);
        }
      }
    }
  };

  reveal(start);

  const buildConstraints = () => {
    const cons = [];
    for (let i = 0; i < n; i++) {
      if (!revealed[i] || nums[i] <= 0) continue;
      const cells = [];
      let count = nums[i];
      for (const j of neighbors[i]) {
        if (flagged[j]) count--;
        else if (!revealed[j]) cells.push(j);
      }
      if (cells.length) cons.push({ cells, count });
    }
    return cons;
  };

  // 返回是否有进展
  const applyKnown = (safe, mine) => {
    let progress = false;
    for (const i of mine) if (!flagged[i]) { flagged[i] = 1; progress = true; }
    for (const i of safe) if (!revealed[i]) { reveal(i); progress = true; }
    return progress;
  };

  const trivialPass = (cons) => {
    const safe = [];
    const mine = [];
    for (const { cells, count } of cons) {
      if (count === 0) safe.push(...cells);
      else if (count === cells.length) mine.push(...cells);
    }
    return applyKnown(safe, mine);
  };

  const subsetPass = (cons) => {
    const byCell = new Map();
    cons.forEach((c, idx) => {
      c.set = new Set(c.cells);
      for (const cell of c.cells) {
        if (!byCell.has(cell)) byCell.set(cell, []);
        byCell.get(cell).push(idx);
      }
    });
    const safe = [];
    const mine = [];
    for (let a = 0; a < cons.length; a++) {
      const A = cons[a];
      const seen = new Set();
      for (const cell of A.cells) {
        for (const b of byCell.get(cell)) {
          if (b === a || seen.has(b)) continue;
          seen.add(b);
          const B = cons[b];
          if (A.cells.length >= B.cells.length) continue;
          if (!A.cells.every((x) => B.set.has(x))) continue;
          const diff = B.cells.filter((x) => !A.set.has(x));
          const dc = B.count - A.count;
          if (dc === 0) safe.push(...diff);
          else if (dc === diff.length) mine.push(...diff);
        }
      }
    }
    return applyKnown(safe, mine);
  };

  // 边界穷举（含全局雷数）
  const enumPass = (cons) => {
    const unknownAll = [];
    for (let i = 0; i < n; i++) if (!revealed[i] && !flagged[i]) unknownAll.push(i);
    const flagsCount = flagged.reduce((a, b) => a + b, 0);
    const minesLeft = total - flagsCount;

    const frontier = new Set();
    for (const c of cons) for (const x of c.cells) frontier.add(x);
    const interior = unknownAll.filter((x) => !frontier.has(x));

    // 连通块
    const cellCons = new Map();
    cons.forEach((c, idx) => c.cells.forEach((x) => {
      if (!cellCons.has(x)) cellCons.set(x, []);
      cellCons.get(x).push(idx);
    }));
    const visited = new Set();
    const comps = [];
    for (const start of frontier) {
      if (visited.has(start)) continue;
      const cells = [];
      const consIdx = new Set();
      const q = [start];
      visited.add(start);
      while (q.length) {
        const x = q.pop();
        cells.push(x);
        for (const ci of cellCons.get(x)) {
          if (consIdx.has(ci)) continue;
          consIdx.add(ci);
          for (const y of cons[ci].cells) if (!visited.has(y)) { visited.add(y); q.push(y); }
        }
      }
      comps.push({ cells, cons: [...consIdx].map((i) => cons[i]) });
    }

    // 对每个连通块穷举：记录每个雷数 k 下每格为雷的次数
    const compResults = [];
    for (const comp of comps) {
      if (comp.cells.length > MAX_ENUM) { compResults.push(null); continue; }
      const idxOf = new Map(comp.cells.map((x, i) => [x, i]));
      const cs = comp.cons.map((c) => ({ idx: c.cells.map((x) => idxOf.get(x)), count: c.count }));
      const cellToCons = comp.cells.map(() => []);
      cs.forEach((c, ci) => c.idx.forEach((i) => cellToCons[i].push(ci)));
      const m = comp.cells.length;
      const assign = new Int8Array(m).fill(-1);
      const assigned = new Int32Array(cs.length);
      const placed = new Int32Array(cs.length);
      const byK = new Map(); // k -> { count, mineCounts: Int32Array }

      const rec = (i, k) => {
        if (k > minesLeft) return;
        if (i === m) {
          let entry = byK.get(k);
          if (!entry) { entry = { count: 0, mineCounts: new Int32Array(m) }; byK.set(k, entry); }
          entry.count++;
          for (let t = 0; t < m; t++) if (assign[t] === 1) entry.mineCounts[t]++;
          return;
        }
        for (const v of [0, 1]) {
          let ok = true;
          for (const ci of cellToCons[i]) {
            const c = cs[ci];
            const p = placed[ci] + v;
            const left = c.idx.length - (assigned[ci] + 1);
            if (p > c.count || p + left < c.count) { ok = false; break; }
          }
          if (!ok) continue;
          assign[i] = v;
          for (const ci of cellToCons[i]) { assigned[ci]++; placed[ci] += v; }
          rec(i + 1, k + v);
          for (const ci of cellToCons[i]) { assigned[ci]--; placed[ci] -= v; }
          assign[i] = -1;
        }
      };
      rec(0, 0);
      compResults.push({ comp, byK });
    }

    const allEnumerated = compResults.every(Boolean);
    const safe = [];
    const mine = [];

    // 全局雷数约束：只有全部块都穷举过才能精确耦合
    let feasibleKs = null; // 每个块可行的 k 集合（经全局约束过滤后）
    if (allEnumerated && compResults.length) {
      // 用卷积求每块在全局约束下可行的 k
      const lists = compResults.map((r) => [...r.byK.keys()]);
      // 前缀/后缀可达和
      const reach = (arrs) => {
        const out = [new Set([0])];
        for (const ks of arrs) {
          const next = new Set();
          for (const s of out[out.length - 1]) for (const k of ks) next.add(s + k);
          out.push(next);
        }
        return out;
      };
      const pre = reach(lists);
      const suf = reach([...lists].reverse()).reverse();
      const okTotal = (s) => minesLeft - s >= 0 && minesLeft - s <= interior.length;
      feasibleKs = lists.map((ks, bi) => new Set(ks.filter((k) => {
        for (const a of pre[bi]) for (const b of suf[bi + 1]) if (okTotal(a + b + k)) return true;
        return false;
      })));
      // 内部格：所有可行总和下 interior 雷数恒为 0 或恒满
      const totals = pre[pre.length - 1];
      const feasibleTotals = [...totals].filter(okTotal);
      if (interior.length && feasibleTotals.length) {
        if (feasibleTotals.every((s) => minesLeft - s === 0)) safe.push(...interior);
        else if (feasibleTotals.every((s) => minesLeft - s === interior.length)) mine.push(...interior);
      }
    }

    compResults.forEach((res, bi) => {
      if (!res) return;
      const { comp, byK } = res;
      const m = comp.cells.length;
      let sols = 0;
      const mc = new Int32Array(m);
      for (const [k, entry] of byK) {
        if (feasibleKs && !feasibleKs[bi].has(k)) continue;
        sols += entry.count;
        for (let t = 0; t < m; t++) mc[t] += entry.mineCounts[t];
      }
      if (!sols) return;
      for (let t = 0; t < m; t++) {
        if (mc[t] === 0) safe.push(comp.cells[t]);
        else if (mc[t] === sols) mine.push(comp.cells[t]);
      }
    });

    // 没有边界时的纯全局情况（例如被翻开区域全封住）
    if (!frontier.size && interior.length) {
      if (minesLeft === 0) safe.push(...interior);
      else if (minesLeft === interior.length) mine.push(...interior);
    }

    return applyKnown(safe, mine);
  };

  for (let guard = 0; guard < n * 4 && safeLeft > 0; guard++) {
    const cons = buildConstraints();
    if (trivialPass(cons)) continue;
    if (subsetPass(cons)) continue;
    if (enumPass(cons)) continue;
    break;
  }

  return { solved: safeLeft === 0, revealed, flagged };
}

function safeZone(rows, cols, start) {
  const r0 = Math.floor(start / cols);
  const c0 = start % cols;
  const zone = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) zone.add(r * cols + c);
    }
  }
  return zone;
}

/**
 * 生成无猜棋盘。
 * @returns {{ mines: Uint8Array, noGuess: boolean, attempts: number }}
 */
export function generateNoGuessBoard({ rows, cols, mines: mineCount, start, seed = Date.now(), timeBudgetMs = 4000 }) {
  const rand = mulberry32(seed);
  const n = rows * cols;
  const neighbors = buildNeighbors(rows, cols);
  const zone = safeZone(rows, cols, start);
  const candidates = [];
  for (let i = 0; i < n; i++) if (!zone.has(i)) candidates.push(i);
  if (mineCount > candidates.length) throw new Error('too many mines');

  const t0 = Date.now();
  let attempts = 0;
  let last = null;

  while (Date.now() - t0 < timeBudgetMs) {
    attempts++;
    // 随机布雷
    const mines = new Uint8Array(n);
    const pool = candidates.slice();
    for (let k = 0; k < mineCount; k++) {
      const j = k + Math.floor(rand() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
      mines[pool[k]] = 1;
    }
    last = mines;

    // 扰动修复：每次卡住把一个推不出的边界雷挪进未探索区
    for (let fix = 0; fix < mineCount * 3; fix++) {
      const res = solveLogically(mines, rows, cols, start, neighbors);
      if (res.solved) return { mines, noGuess: true, attempts };
      if (Date.now() - t0 > timeBudgetMs) break;

      const frontierMines = [];
      const interior = [];
      for (let i = 0; i < n; i++) {
        if (res.revealed[i] || res.flagged[i] || zone.has(i)) continue;
        const touches = neighbors[i].some((j) => res.revealed[j]);
        if (touches) { if (mines[i]) frontierMines.push(i); }
        else if (!mines[i]) interior.push(i);
      }
      if (!frontierMines.length || !interior.length) break; // 无法修复 → 重新布雷
      const from = frontierMines[Math.floor(rand() * frontierMines.length)];
      const to = interior[Math.floor(rand() * interior.length)];
      mines[from] = 0;
      mines[to] = 1;
    }
  }
  return { mines: last, noGuess: false, attempts };
}
