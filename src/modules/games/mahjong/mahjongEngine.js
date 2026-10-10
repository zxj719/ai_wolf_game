/**
 * mahjongEngine.js — 麻将消除（Mahjong Solitaire）布局 + 必有解发牌器。
 *
 * 坐标系：半格单位。一张牌占 2×2 半格，(x, y) 是左上角，z 是层。
 * 自由牌：上方没有任何牌压住（z+1 且 |dx|<2 && |dy|<2），且左侧或右侧至少一侧空着。
 *
 * 必有解：先定消除顺序、后填牌面。从满盘出发，每次挑两张「此刻都自由」的位置拿掉，
 * 再给每一步分配一对可配对的牌面。按拿掉的顺序玩就是一条完整解，
 * 因此每一局都能一次通关，无需洗牌。
 */

import { mulberry32 } from '../minesweeper/mineEngine';

// ===== 牌面 =====
// m=万 p=筒 s=条 w=风(E S W N) d=箭(C 中 F 發 P 白) f=花(梅兰竹菊) j=季(春夏秋冬)
const BASE_FACES = [];
for (const suit of ['m', 'p', 's']) for (let n = 1; n <= 9; n++) BASE_FACES.push(`${suit}${n}`);
for (const w of ['E', 'S', 'W', 'N']) BASE_FACES.push(`w${w}`);
for (const d of ['C', 'F', 'P']) BASE_FACES.push(`d${d}`);

/** 配对键：花牌之间、季牌之间可互配，其余必须完全相同 */
export function matchKey(face) {
  if (face[0] === 'f') return 'f';
  if (face[0] === 'j') return 'j';
  return face;
}

/** 全套 144 张 = 72 对 */
export function allPairs() {
  const pairs = [];
  for (const f of BASE_FACES) { pairs.push([f, f]); pairs.push([f, f]); }
  pairs.push(['f1', 'f2'], ['f3', 'f4'], ['j1', 'j2'], ['j3', 'j4']);
  return pairs;
}

// ===== 布局 =====
/** 以「整格」为单位的矩形块（可用 .5 做半格错位） */
function block(x0, y0, cols, rows, z) {
  const out = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) out.push([Math.round((x0 + i) * 2), Math.round((y0 + j) * 2), z]);
  }
  return out;
}

function turtle() {
  const p = [];
  const rows = [[1, 12], [3, 8], [2, 10], [1, 12], [1, 12], [2, 10], [3, 8], [1, 12]];
  rows.forEach(([x0, cols], y) => p.push(...block(x0, y, cols, 1, 0)));
  p.push(...block(0, 3.5, 1, 1, 0), ...block(13, 3.5, 2, 1, 0));
  p.push(...block(4, 1, 6, 6, 1), ...block(5, 2, 4, 4, 2), ...block(6, 3, 2, 2, 3));
  p.push(...block(6.5, 3.5, 1, 1, 4));
  return p;
}

function pyramid() {
  return [
    ...block(0, 0, 8, 8, 0), ...block(1, 1, 6, 6, 1),
    ...block(2, 2, 4, 4, 2), ...block(3, 3, 2, 2, 3),
  ];
}

function fortress() {
  const p = [];
  // 外城墙 10×8 一圈 + 内院 6×4
  for (let x = 0; x < 10; x++) { p.push(...block(x, 0, 1, 1, 0), ...block(x, 7, 1, 1, 0)); }
  for (let y = 1; y < 7; y++) { p.push(...block(0, y, 1, 1, 0), ...block(9, y, 1, 1, 0)); }
  p.push(...block(2, 2, 6, 4, 0));
  // 四角塔楼
  for (const [x, y] of [[0, 0], [8, 0], [0, 6], [8, 6]]) p.push(...block(x, y, 2, 2, 1));
  p.push(...block(3, 3, 4, 2, 1));
  for (const [x, y] of [[0.5, 0.5], [8.5, 0.5], [0.5, 6.5], [8.5, 6.5]]) p.push(...block(x, y, 1, 1, 2));
  p.push(...block(4, 3.5, 2, 1, 2));
  return p;
}

function cross() {
  return [
    ...block(0, 3, 12, 2, 0), ...block(5, 0, 2, 3, 0), ...block(5, 5, 2, 3, 0),
    ...block(1, 3, 10, 2, 1), ...block(5, 1, 2, 2, 1), ...block(5, 5, 2, 2, 1),
    ...block(3, 3, 6, 2, 2), ...block(5, 3, 2, 2, 3),
  ];
}

function ziggurat() {
  return [
    ...block(0, 0, 10, 6, 0), ...block(1, 0.5, 8, 5, 1), ...block(1.5, 1, 7, 4, 2),
    ...block(3, 1.5, 4, 3, 3), ...block(4, 2, 2, 2, 4),
  ];
}

function garden() {
  return [
    ...block(0, 0, 6, 4, 0), ...block(1, 1, 4, 2, 1), ...block(2, 1, 2, 2, 2),
  ];
}

export const LAYOUTS = [
  { id: 'garden',   name: '小花园', en: 'Garden',   positions: garden() },
  { id: 'cross',    name: '十字',   en: 'Cross',    positions: cross() },
  { id: 'fortress', name: '堡垒',   en: 'Fortress', positions: fortress() },
  { id: 'pyramid',  name: '金字塔', en: 'Pyramid',  positions: pyramid() },
  { id: 'turtle',   name: '龟',     en: 'Turtle',   positions: turtle() },
  { id: 'ziggurat', name: '阶梯塔', en: 'Ziggurat', positions: ziggurat() },
];

export const LAYOUT_MAP = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));

// ===== 几何关系 =====
/** 预计算每个位置：压在它上面的位置、左邻、右邻 */
export function buildGeometry(positions) {
  const n = positions.length;
  const above = Array.from({ length: n }, () => []);
  const left = Array.from({ length: n }, () => []);
  const right = Array.from({ length: n }, () => []);
  for (let a = 0; a < n; a++) {
    const [ax, ay, az] = positions[a];
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const [bx, by, bz] = positions[b];
      const dy = Math.abs(by - ay);
      if (bz === az + 1 && Math.abs(bx - ax) < 2 && dy < 2) above[a].push(b);
      if (bz === az && dy < 2) {
        if (bx === ax - 2) left[a].push(b);
        if (bx === ax + 2) right[a].push(b);
      }
    }
  }
  return { above, left, right };
}

export function isFree(i, present, geo) {
  if (!present[i]) return false;
  if (geo.above[i].some((b) => present[b])) return false;
  const leftBlocked = geo.left[i].some((b) => present[b]);
  const rightBlocked = geo.right[i].some((b) => present[b]);
  return !leftBlocked || !rightBlocked;
}

/** 校验布局：张数为偶数且同层无重叠 */
export function validateLayout(positions) {
  if (positions.length % 2 !== 0) return 'odd tile count';
  if (positions.length > 144) return 'too many tiles';
  for (let a = 0; a < positions.length; a++) {
    for (let b = a + 1; b < positions.length; b++) {
      const [ax, ay, az] = positions[a];
      const [bx, by, bz] = positions[b];
      if (az === bz && Math.abs(ax - bx) < 2 && Math.abs(ay - by) < 2) return `overlap ${a}/${b}`;
    }
  }
  return null;
}

/**
 * 发牌：返回 { faces: string[], solution: [i, j][] }，faces[i] 对应 positions[i]。
 * solution 是一条从满盘到清空的合法消除序列。
 */
export function dealSolvable(layout, seed = Date.now(), maxTries = 500) {
  const rand = mulberry32(seed);
  const { positions } = layout;
  const n = positions.length;
  const geo = buildGeometry(positions);

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const present = new Uint8Array(n).fill(1);
    const order = [];
    let ok = true;
    for (let step = 0; step < n / 2; step++) {
      const free = [];
      for (let i = 0; i < n; i++) if (isFree(i, present, geo)) free.push(i);
      if (free.length < 2) { ok = false; break; }
      // 优先拿高层：越往后越难挖出被压住的底层，按 z 加权能显著降低死局重试率
      const pick = () => {
        let best = -1;
        let bestScore = -Infinity;
        for (const i of free) {
          const s = positions[i][2] + rand() * 2.5;
          if (s > bestScore) { bestScore = s; best = i; }
        }
        return best;
      };
      const a = pick();
      free.splice(free.indexOf(a), 1);
      const b = pick();
      present[a] = 0;
      present[b] = 0;
      order.push([a, b]);
    }
    if (!ok) continue;

    // 分配牌面：洗牌后的对子依次给每一步
    const pairs = allPairs();
    for (let k = pairs.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [pairs[k], pairs[j]] = [pairs[j], pairs[k]];
    }
    const faces = new Array(n);
    order.forEach(([a, b], k) => {
      faces[a] = pairs[k][0];
      faces[b] = pairs[k][1];
    });
    // 从满盘按 order 依次消除，每一步两张都自由且牌面相配 —— order 本身就是正向解
    return { faces, solution: order };
  }
  throw new Error(`failed to deal layout ${layout.id}`);
}

/** 当前局面所有可消除的对子 */
export function findMoves(faces, present, geo) {
  const free = [];
  for (let i = 0; i < faces.length; i++) if (isFree(i, present, geo)) free.push(i);
  const moves = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (matchKey(faces[free[a]]) === matchKey(faces[free[b]])) moves.push([free[a], free[b]]);
    }
  }
  return moves;
}
