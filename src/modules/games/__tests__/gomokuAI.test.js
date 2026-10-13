import { describe, it, expect } from 'vitest';
import { chooseMove, LEVELS } from '../gomoku/gomokuAI';
import { createGomoku, applyGomoku, GOMOKU_SIZE } from '../../../../server/games/gomoku.js';

const N = GOMOKU_SIZE;
const at = (r, c) => r * N + c;
function boardWith(black, white) {
  const b = new Array(N * N).fill(0);
  black.forEach(([r, c]) => { b[at(r, c)] = 1; });
  white.forEach(([r, c]) => { b[at(r, c)] = 2; });
  return b;
}

describe('gomokuAI', () => {
  for (const level of Object.keys(LEVELS)) {
    it(`${level}: 有一步成五就直接赢`, () => {
      const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[0, 0], [0, 1], [0, 2], [9, 9]]);
      expect([at(7, 2), at(7, 7)]).toContain(chooseMove(b, 1, level));
    });

    it(`${level}: 对方冲四必须堵`, () => {
      // 白 (2) 有冲四 5,3..5,6，左端被黑堵，只剩 5,7
      const b = boardWith([[5, 2], [9, 9], [10, 10]], [[5, 3], [5, 4], [5, 5], [5, 6]]);
      expect(chooseMove(b, 1, level)).toBe(at(5, 7));
    });
  }

  for (const level of ['medium', 'hard']) {
    it(`${level}: 对方活三要应（堵在两端之一）`, () => {
      const b = boardWith([[2, 2], [12, 12]], [[7, 5], [7, 6], [7, 7]]);
      const m = chooseMove(b, 1, level);
      expect([at(7, 4), at(7, 8), at(7, 3), at(7, 9)]).toContain(m);
    });
  }

  it('hard: VCF 找到双四杀', () => {
    // 黑：横 6,4..6,6 + 竖 4,7 5,7 —— 黑下 6,7 形成横冲四+竖三……这里构造一个 7,7 双四点：
    // 横 7,3 7,4 7,5（右侧空）和 竖 3,7 4,7 5,7（下方空）
    const b = boardWith(
      [[7, 4], [7, 5], [7, 6], [4, 7], [5, 7], [6, 7]],
      [[7, 3], [3, 7], [0, 0], [0, 14], [14, 0], [14, 14]],
    );
    // 7,7：横 7,4-7,7 冲四（左被堵）+ 竖 4,7-7,7 冲四（上被堵）= 双四
    expect(chooseMove(b, 1, 'hard')).toBe(at(7, 7));
  });

  it('每手都在时间预算内（困难 < 2.5s）', () => {
    let s = createGomoku();
    const seq = [at(7, 7), at(7, 8), at(8, 8), at(6, 6), at(8, 7)];
    seq.forEach((i) => { s = applyGomoku(s, s.turn, { type: 'place', i }).state; });
    const t0 = Date.now();
    const m = chooseMove(s.board, s.turn, 'hard');
    expect(Date.now() - t0).toBeLessThan(2500);
    expect(s.board[m]).toBe(0);
  });

  it('困难对简单：自对弈 4 局困难至少赢 3 局', () => {
    let hardWins = 0;
    for (let g = 0; g < 4; g++) {
      let s = createGomoku();
      const hardColor = g % 2 === 0 ? 1 : 2;
      let seed = g + 1;
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      while (!s.winner && !s.draw && s.moves.length < 120) {
        const level = s.turn === hardColor ? 'hard' : 'easy';
        const m = chooseMove(s.board, s.turn, level, rand);
        s = applyGomoku(s, s.turn, { type: 'place', i: m }).state;
      }
      if (s.winner === hardColor) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(3);
  }, 120000);
});
