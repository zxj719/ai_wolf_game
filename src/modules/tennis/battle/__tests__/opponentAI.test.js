import { describe, it, expect } from 'vitest';
import { TEMPERAMENTS, pickOpponentMove, makeTell, TELLS } from '../opponentAI';
import { CHAR_BUILDS, MOVES } from '../moves';

describe('TEMPERAMENTS 性格权重', () => {
  it('七人都有 4 权重且与配招对齐、和为 1', () => {
    for (const [name, build] of Object.entries(CHAR_BUILDS)) {
      const w = TEMPERAMENTS[name];
      expect(w).toHaveLength(build.moves.length);
      expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    }
  });

  it('诚的首招（重炮）权重最高（重炮流人设）', () => {
    const w = TEMPERAMENTS['诚'];
    expect(Math.max(...w)).toBe(w[0]);
  });
});

describe('pickOpponentMove', () => {
  it('rngRoll=0 取第一个可用招', () => {
    const m = pickOpponentMove({ charName: '诚', energy: 100, rngRoll: 0 });
    expect(m).toBe('flatDrive');
  });

  it('rngRoll 接近 1 取最后一个可用招', () => {
    const m = pickOpponentMove({ charName: '诚', energy: 100, rngRoll: 0.9999 });
    expect(m).toBe(CHAR_BUILDS['诚'].moves[3]);
  });

  it('力竭（<20）时耗体 ≥16 的招被剔除', () => {
    // 诚的 flatDrive(20)/smash(16) 都被禁，剩 topspin/passingShot
    for (const roll of [0, 0.3, 0.6, 0.99]) {
      const m = pickOpponentMove({ charName: '诚', energy: 10, rngRoll: roll });
      expect(['topspin', 'passingShot']).toContain(m);
      expect(MOVES[m].energyCost < 16).toBe(true);
    }
  });

  it('全部被禁时回退到耗体最低的招', () => {
    // 构造极端：体力 10 时 Ross 的可用招 = slice/passingShot(14)
    const m = pickOpponentMove({ charName: 'Ross', energy: 10, rngRoll: 0.5 });
    expect(['slice', 'passingShot']).toContain(m);
  });
});

describe('makeTell 读招提示（75% 真实率）', () => {
  it('truthRoll < 0.75 → 真提示，hintMove 等于 actualMove', () => {
    const t = makeTell({ charName: '诚', actualMove: 'smash', truthRoll: 0.5, fakeRoll: 0 });
    expect(t.isTrue).toBe(true);
    expect(t.text).toBe(TELLS.smash);
    expect(t.hintMove).toBe('smash');
  });

  it('truthRoll ≥ 0.75 → 假提示且来自其它招，hintMove 在配招内', () => {
    const t = makeTell({ charName: '诚', actualMove: 'smash', truthRoll: 0.8, fakeRoll: 0 });
    expect(t.isTrue).toBe(false);
    expect(t.text).not.toBe(TELLS.smash);
    expect(t.hintMove).not.toBe('smash');
    expect(CHAR_BUILDS['诚'].moves).toContain(t.hintMove);
    // 文案仍与 hintMove 对应
    expect(t.text).toBe(TELLS[t.hintMove]);
  });

  it('八招都有提示文案', () => {
    expect(Object.keys(TELLS).sort()).toEqual(Object.keys(MOVES).sort());
  });
});
