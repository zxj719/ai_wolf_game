import {
  buildNeighbors,
  mulberry32,
  solveLogically,
} from "../minesweeper/mineEngine";

// Solve on the actual floor graph: void tiles must not act as free information.
export function generateRoomBoard(w, start) {
  const nb = buildNeighbors(w.size, w.size);
  const cells = w.floor.flatMap((v, i) => (v ? [i] : []));
  const local = new Map(cells.map((i, j) => [i, j]));
  const graph = cells.map((i) =>
    nb[i].filter((j) => local.has(j)).map((j) => local.get(j)),
  );
  const excluded = new Set([
    start,
    ...nb[start],
    ...Object.keys(w.nodes).map(Number),
  ]);
  const candidates = cells.filter((i) => !excluded.has(i));
  const density = Math.min(
    0.2,
    0.12 + (w.danger || 0) * 0.015 + (w.depth - 1) * 0.01,
  );
  const count = Math.min(
    candidates.length,
    Math.max(2, Math.round(cells.length * density)),
  );
  const random = mulberry32((w.seed + start * 7919 + w.depth * 9173) >>> 0);
  let mines,
    solved = false;
  const started = Date.now();
  for (
    let attempt = 0;
    attempt < 60 && (attempt === 0 || Date.now() - started < 180);
    attempt++
  ) {
    mines = Array(w.size ** 2).fill(0);
    const pool = candidates.slice();
    for (let k = 0; k < count; k++) {
      const j = k + Math.floor(random() * (pool.length - k));
      [pool[k], pool[j]] = [pool[j], pool[k]];
      mines[pool[k]] = 1;
    }
    solved = solveLogically(
      cells.map((i) => mines[i]),
      1,
      cells.length,
      local.get(start),
      graph,
    ).solved;
    if (solved) break;
  }
  return { mines, solved };
}
