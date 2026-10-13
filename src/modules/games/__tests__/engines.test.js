import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES, generateNoGuessBoard, solveLogically, buildNeighbors, computeNumbers,
} from '../minesweeper/mineEngine';
import {
  LAYOUTS, validateLayout, dealSolvable, reshuffleSolvable, buildGeometry, isFree, matchKey, findMoves,
} from '../mahjong/mahjongEngine';

describe('mineEngine', () => {
  for (const d of Object.values(DIFFICULTIES)) {
    it(`${d.key}: 生成的棋盘雷数正确、首击 3×3 为空、纯逻辑可解`, () => {
      for (let s = 1; s <= 8; s++) {
        const start = (s * 37) % (d.rows * d.cols);
        const { mines, noGuess } = generateNoGuessBoard({ ...d, start, seed: s * 101 });
        expect(noGuess).toBe(true);
        expect(mines.reduce((a, b) => a + b, 0)).toBe(d.mines);
        const nb = buildNeighbors(d.rows, d.cols);
        expect(mines[start]).toBe(0);
        expect(computeNumbers(mines, nb)[start]).toBe(0);
        expect(solveLogically(mines, d.rows, d.cols, start, nb).solved).toBe(true);
      }
    });
  }

  it('求解器遇到真正的五五开不会乱猜', () => {
    // 2×2 角落：两颗雷对称分布在 1×2 通道里，只能猜
    // 布局 (3 行 × 4 列)，雷在 (0,3)：从 (2,0) 起，(0,3)/(1,3) 无法区分
    const rows = 2; const cols = 3;
    const mines = new Uint8Array([0, 0, 1, 0, 0, 0]);
    // 翻开 (1,0) → 0？(1,0) 邻居 (0,0)(0,1)(1,1) 无雷 → 展开到 (0,1)=1,(1,1)=1
    // (0,2) 与 (1,2) 都只被 (0,1)(1,1) 看到且对称 → 不可解
    const res = solveLogically(mines, rows, cols, 3);
    expect(res.solved).toBe(false);
  });
});

describe('mahjongEngine', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.id}: 布局合法（偶数张、同层无重叠）`, () => {
      expect(validateLayout(layout.positions)).toBeNull();
    });

    it(`${layout.id}: 每一局都存在无需洗牌的完整解`, () => {
      const geo = buildGeometry(layout.positions);
      for (let s = 1; s <= 25; s++) {
        const { faces, solution } = dealSolvable(layout, s * 7);
        const present = new Uint8Array(faces.length).fill(1);
        expect(solution.length * 2).toBe(faces.length);
        for (const [a, b] of solution) {
          expect(isFree(a, present, geo)).toBe(true);
          expect(isFree(b, present, geo)).toBe(true);
          expect(matchKey(faces[a])).toBe(matchKey(faces[b]));
          present[a] = 0;
          present[b] = 0;
        }
        expect(present.every((v) => v === 0)).toBe(true);
      }
    });
  }

  it('开局至少有一步可走', () => {
    const layout = LAYOUTS.find((l) => l.id === 'turtle');
    const geo = buildGeometry(layout.positions);
    const { faces } = dealSolvable(layout, 42);
    expect(findMoves(faces, new Uint8Array(faces.length).fill(1), geo).length).toBeGreaterThan(0);
  });

  it('龟布局正好 144 张', () => {
    expect(LAYOUTS.find((l) => l.id === 'turtle').positions.length).toBe(144);
  });
});


describe('mahjong reshuffle', () => {
  for (const layout of LAYOUTS) {
    it(`${layout.id}: 打到一半洗牌，剩余牌不变且仍有完整解`, () => {
      const geo = buildGeometry(layout.positions);
      for (let s = 1; s <= 10; s++) {
        const { faces, solution } = dealSolvable(layout, s * 13);
        const present = new Uint8Array(faces.length).fill(1);
        // 按解走掉前 40%
        solution.slice(0, Math.floor(solution.length * 0.4)).forEach(([a, b]) => { present[a] = 0; present[b] = 0; });
        const before = faces.filter((_, i) => present[i]).sort();
        const r = reshuffleSolvable(layout, faces, present, s * 31);
        expect(r).not.toBeNull();
        expect(r.faces.filter((_, i) => present[i]).sort()).toEqual(before);   // 牌没变，只是换了位置
        faces.forEach((f, i) => { if (!present[i]) expect(r.faces[i]).toBe(f); }); // 已消除位置不动（撤销仍成立）
        const p = Uint8Array.from(present);
        for (const [a, b] of r.solution) {
          expect(isFree(a, p, geo) && isFree(b, p, geo)).toBe(true);
          expect(matchKey(r.faces[a])).toBe(matchKey(r.faces[b]));
          p[a] = 0; p[b] = 0;
        }
        expect(p.every((v) => v === 0)).toBe(true);
      }
    });
  }

  it('两张上下叠着时怎么洗都无解 → 返回 null', () => {
    const layout = { id: 'stack', positions: [[0, 0, 0], [0, 0, 1]] };
    expect(reshuffleSolvable(layout, ['m1', 'm1'], new Uint8Array([1, 1]), 7)).toBeNull();
  });
});
