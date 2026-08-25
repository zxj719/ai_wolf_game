/**
 * 数独求解引擎 — 从原始 sudoku_solver_visualizer.html 原样移植的纯函数部分。
 *
 * 不碰 DOM，只操作 9x9 grid/candidates 数组，因此可以整段复制过来，
 * 唯一的改动是从 IIFE 脚本变成带 export 的 ES module。
 */

function buildUnits() {
  const units = [];
  for (let r = 0; r < 9; r++) {
    const cells = [];
    for (let c = 0; c < 9; c++) cells.push({ row: r, col: c });
    units.push({ type: 'row', index: r, cells });
  }
  for (let c = 0; c < 9; c++) {
    const cells = [];
    for (let r = 0; r < 9; r++) cells.push({ row: r, col: c });
    units.push({ type: 'col', index: c, cells });
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells = [];
      for (let r = br * 3; r < br * 3 + 3; r++) for (let c = bc * 3; c < bc * 3 + 3; c++) cells.push({ row: r, col: c });
      units.push({ type: 'box', index: br * 3 + bc, cells });
    }
  }
  return units;
}
const ALL_UNITS = buildUnits();

const PEERS_CACHE = {};
export function getPeers(row, col) {
  const key = row * 9 + col;
  if (PEERS_CACHE[key]) return PEERS_CACHE[key];
  const s = new Set();
  for (let i = 0; i < 9; i++) {
    if (i !== col) s.add(row * 9 + i);
    if (i !== row) s.add(i * 9 + col);
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) if (r !== row || c !== col) s.add(r * 9 + c);
  const result = [...s].map((idx) => ({ row: Math.floor(idx / 9), col: idx % 9 }));
  PEERS_CACHE[key] = result;
  return result;
}

export function isValidPlacement(grid, row, col, value) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }
  const br = Math.floor(row / 3) * 3, bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) if (grid[r][c] === value) return false;
  return true;
}

export function validateGivens(grid) {
  for (const unit of ALL_UNITS) {
    const seen = new Set();
    for (const { row, col } of unit.cells) {
      const v = grid[row][col];
      if (v !== 0) {
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
  }
  return true;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateFullGrid() {
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  function fill() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) {
          for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (isValidPlacement(grid, r, c, v)) {
              grid[r][c] = v;
              if (fill()) return true;
              grid[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }
  fill();
  return grid;
}

export function countSolutions(grid, limit) {
  const g = grid.map((row) => [...row]);
  let count = 0;
  function backtrack() {
    if (count >= limit) return;
    let best = null, bestCount = 10;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          let cnt = 0;
          for (let v = 1; v <= 9; v++) if (isValidPlacement(g, r, c, v)) cnt++;
          if (cnt < bestCount) { bestCount = cnt; best = { row: r, col: c }; }
          if (cnt === 0) { best = { row: r, col: c }; bestCount = 0; r = 9; break; }
        }
      }
    }
    if (!best) { count++; return; }
    if (bestCount === 0) return;
    for (let v = 1; v <= 9; v++) {
      if (isValidPlacement(g, best.row, best.col, v)) {
        g[best.row][best.col] = v;
        backtrack();
        g[best.row][best.col] = 0;
        if (count >= limit) return;
      }
    }
  }
  backtrack();
  return count;
}

function carvePuzzle(fullGrid, targetClues) {
  const grid = fullGrid.map((row) => [...row]);
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => ({ row: Math.floor(i / 9), col: i % 9 })));
  let clues = 81;
  for (const { row, col } of cells) {
    if (clues <= targetClues) break;
    const backup = grid[row][col];
    grid[row][col] = 0;
    if (countSolutions(grid, 2) !== 1) {
      grid[row][col] = backup;
    } else {
      clues--;
    }
  }
  return grid;
}

export function generatePuzzle(difficulty) {
  const targets = { easy: 40, medium: 32, hard: 26, evil: 22 };
  const target = targets[difficulty] ?? 26;
  if (difficulty !== 'evil') {
    const full = generateFullGrid();
    const puzzle = carvePuzzle(full, target);
    return { puzzle, solution: full };
  }
  let best = null;
  for (let i = 0; i < 6; i++) {
    const full = generateFullGrid();
    const puzzle = carvePuzzle(full, target);
    const result = solveWithTrace(puzzle);
    const backtracks = result.trace.filter((s) => s.meta.type === 'backtrack').length;
    if (!best || backtracks > best.backtracks) best = { puzzle, solution: full, backtracks };
    if (backtracks >= 4) break;
  }
  return { puzzle: best.puzzle, solution: best.solution };
}

function deepCopyCandidates(c) { return c.map((row) => row.map((s) => new Set(s))); }
function deepCopyGrid(g) { return g.map((row) => [...row]); }
function deepCopyOrigins(o) { return o.map((row) => row.map((cell) => (cell ? { ...cell } : null))); }
function restoreInto(target, saved) { for (let i = 0; i < 9; i++) target[i] = saved[i]; }

function snapshot(candidates, solved, origins, meta) {
  return {
    candidates: candidates.map((row) => row.map((s) => [...s].sort((a, b) => a - b))),
    solved: solved.map((row) => [...row]),
    origins: origins.map((row) => row.map((cell) => (cell ? { ...cell } : null))),
    meta,
  };
}

function initCandidates(grid) {
  const candidates = grid.map((row) => row.map((v) => (v !== 0 ? new Set([v]) : new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))));
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) {
        for (const p of getPeers(r, c)) {
          if (grid[p.row][p.col] === 0) candidates[p.row][p.col].delete(grid[r][c]);
        }
      }
    }
  }
  return candidates;
}

function isFullySolved(solved) {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!solved[r][c]) return false;
  return true;
}

function pickMRV(candidates, solved) {
  let best = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!solved[r][c]) {
        if (!best || candidates[r][c].size < candidates[best.row][best.col].size) best = { row: r, col: c };
      }
    }
  }
  return best;
}

const STEP_CAP = 50000;

// 消去单元格里的一个候选值，若把它逼到空集就返回 true——把这个判断收在消去
// 那一刻做，一条注定失败的分支能立刻死掉，不用等整轮 naked/hidden single
// 扫描跑完（此时已经没有意义）。
function eliminateAndDetect(candidates, solved, row, col, value) {
  if (solved[row][col]) return false;
  if (!candidates[row][col].has(value)) return false;
  candidates[row][col].delete(value);
  return candidates[row][col].size === 0;
}
function eliminatePeersAndCheck(candidates, solved, row, col, value) {
  for (const p of getPeers(row, col)) {
    if (eliminateAndDetect(candidates, solved, p.row, p.col, value)) return p;
  }
  return null;
}

function propagate(candidates, solved, origins, trace, counter) {
  let progress = true;
  while (progress) {
    progress = false;
    if (counter.n++ > STEP_CAP) throw new Error('step cap exceeded');

    for (let r = 0; r < 9 && !progress; r++) {
      for (let c = 0; c < 9 && !progress; c++) {
        if (!solved[r][c] && candidates[r][c].size === 1) {
          const value = [...candidates[r][c]][0];
          solved[r][c] = true;
          origins[r][c] = { type: 'naked_single', value };
          const dead = eliminatePeersAndCheck(candidates, solved, r, c, value);
          trace.push(snapshot(candidates, solved, origins, { type: 'naked_single', row: r, col: c, value }));
          if (dead) { trace.push(snapshot(candidates, solved, origins, { type: 'contradiction', row: dead.row, col: dead.col })); return false; }
          progress = true;
        }
      }
    }
    if (progress) continue;

    for (const unit of ALL_UNITS) {
      if (progress) break;
      for (let value = 1; value <= 9 && !progress; value++) {
        const cells = unit.cells.filter(({ row, col }) => !solved[row][col] && candidates[row][col].has(value));
        if (cells.length === 1) {
          const { row, col } = cells[0];
          solved[row][col] = true;
          candidates[row][col] = new Set([value]);
          origins[row][col] = { type: 'hidden_single', value, unitType: unit.type, unitIndex: unit.index };
          const dead = eliminatePeersAndCheck(candidates, solved, row, col, value);
          trace.push(snapshot(candidates, solved, origins, { type: 'hidden_single', row, col, value, unitType: unit.type, unitIndex: unit.index }));
          if (dead) { trace.push(snapshot(candidates, solved, origins, { type: 'contradiction', row: dead.row, col: dead.col })); return false; }
          progress = true;
        }
      }
    }
    // 不需要整棋盘重扫：每一处候选值可能消失的地方（上面 + search() 里的猜测）
    // 都在发生的当下立刻检查了。
  }
  return true;
}

function search(candidates, solved, origins, depth, trace, counter) {
  if (!propagate(candidates, solved, origins, trace, counter)) return false;
  if (isFullySolved(solved)) { trace.push(snapshot(candidates, solved, origins, { type: 'solved' })); return true; }
  const cell = pickMRV(candidates, solved);
  const options = [...candidates[cell.row][cell.col]].sort((a, b) => a - b);

  for (const guess of options) {
    if (counter.n++ > STEP_CAP) throw new Error('step cap exceeded');
    const savedC = deepCopyCandidates(candidates);
    const savedS = deepCopyGrid(solved);
    const savedO = deepCopyOrigins(origins);

    solved[cell.row][cell.col] = true;
    candidates[cell.row][cell.col] = new Set([guess]);
    origins[cell.row][cell.col] = { type: 'guess', value: guess, depth };
    const dead = eliminatePeersAndCheck(candidates, solved, cell.row, cell.col, guess);
    trace.push(snapshot(candidates, solved, origins, { type: 'guess', row: cell.row, col: cell.col, value: guess, depth, optionsCount: options.length }));

    let ok = false;
    if (dead) { trace.push(snapshot(candidates, solved, origins, { type: 'contradiction', row: dead.row, col: dead.col })); }
    else { ok = search(candidates, solved, origins, depth + 1, trace, counter); }
    if (ok) return true;

    restoreInto(candidates, savedC);
    restoreInto(solved, savedS);
    restoreInto(origins, savedO);
    trace.push(snapshot(candidates, solved, origins, { type: 'backtrack', row: cell.row, col: cell.col, value: guess, depth }));
  }
  return false;
}

export function solveWithTrace(grid) {
  const candidates = initCandidates(grid);
  const solved = grid.map((row) => row.map((v) => v !== 0));
  const origins = grid.map((row) => row.map((v) => (v !== 0 ? { type: 'given', value: v } : null)));
  const initial = snapshot(candidates, solved, origins, { type: 'start' });
  const trace = [];
  const counter = { n: 0 };

  // 一次性预检：给数密集时，传播还没跑，空格可能已经被剥夺了所有候选值
  // （validateGivens 只检查 given 之间是否冲突，不检查 given 对空格全部
  // peer 集合的影响）
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (!solved[r][c] && candidates[r][c].size === 0) {
        trace.push(snapshot(candidates, solved, origins, { type: 'contradiction', row: r, col: c }));
        return { initial, trace, success: false, aborted: false };
      }
    }
  }

  let success = false, aborted = false;
  try { success = search(candidates, solved, origins, 0, trace, counter); }
  catch (e) { aborted = true; }
  return { initial, trace, success, aborted };
}

export function totalDoF(snap) {
  let sum = 0;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (!snap.solved[r][c]) sum += snap.candidates[r][c].length;
  return sum;
}

export function emptyGrid() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}
