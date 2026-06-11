import { describe, it, expect } from 'vitest';
import { createScore, addPoint, pointLabel } from '../scoring';

/** 连得 n 分 */
const win = (s, who, n) => {
  let cur = s;
  for (let i = 0; i < n; i++) cur = addPoint(cur, who);
  return cur;
};

describe('scoring 真实记分 lite（spec §1.4）', () => {
  it('0→15→30→40→局，局间回体 10，分数清零', () => {
    let s = createScore();
    s = addPoint(s, 0);
    expect(pointLabel(s, 0)).toBe('15');
    s = addPoint(s, 0);
    expect(pointLabel(s, 0)).toBe('30');
    s = addPoint(s, 0);
    expect(pointLabel(s, 0)).toBe('40');
    s = addPoint(s, 0);
    expect(s.games).toEqual([1, 0]);
    expect(s.restEnergy).toBe(10);
    expect(pointLabel(s, 0)).toBe('0');
  });

  it('40-40 进入 Deuce', () => {
    let s = win(createScore(), 0, 3);
    s = win(s, 1, 3);
    expect(s.isDeuce).toBe(true);
    expect(pointLabel(s, 0)).toBe('40');
  });

  it('Deuce → 占先 → 再得一分成局', () => {
    let s = win(win(createScore(), 0, 3), 1, 3);
    s = addPoint(s, 0);
    expect(s.advantage).toBe(0);
    expect(pointLabel(s, 0)).toBe('Adv');
    s = addPoint(s, 0);
    expect(s.games).toEqual([1, 0]);
  });

  it('占先失分回平分，deuceCount 累计', () => {
    let s = win(win(createScore(), 0, 3), 1, 3);
    s = addPoint(s, 0);          // 占先 0
    s = addPoint(s, 1);          // 回平分 → deuceCount 1
    expect(s.advantage).toBe(null);
    expect(s.deuceCount).toBe(1);
    expect(s.goldenPoint).toBe(false);
  });

  it('回平分 2 次后触发金球制，金球一分定局', () => {
    let s = win(win(createScore(), 0, 3), 1, 3);
    s = addPoint(s, 0); s = addPoint(s, 1);   // deuceCount 1
    s = addPoint(s, 1); s = addPoint(s, 0);   // deuceCount 2 → 金球
    expect(s.deuceCount).toBe(2);
    expect(s.goldenPoint).toBe(true);
    s = addPoint(s, 1);                        // 金球一分定局
    expect(s.games).toEqual([0, 1]);
  });

  it('先胜 3 局成盘，盘间回体 30', () => {
    let s = createScore();
    for (let g = 0; g < 3; g++) s = win(s, 0, 4);
    expect(s.sets).toEqual([1, 0]);
    expect(s.games).toEqual([0, 0]);
    expect(s.restEnergy).toBe(30);
  });

  it('两盘先取者获胜，matchOver 后 addPoint 冻结', () => {
    let s = createScore();
    for (let g = 0; g < 6; g++) s = win(s, 0, 4);   // 两盘 3-0 / 3-0
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.sets).toEqual([2, 0]);
    const frozen = addPoint(s, 1);
    expect(frozen).toEqual(s);
  });

  it('盘数 1:1 后第三盘正常推进', () => {
    let s = createScore();
    for (let g = 0; g < 3; g++) s = win(s, 0, 4);   // 第一盘 P0
    for (let g = 0; g < 3; g++) s = win(s, 1, 4);   // 第二盘 P1
    expect(s.sets).toEqual([1, 1]);
    expect(s.matchOver).toBe(false);
    for (let g = 0; g < 3; g++) s = win(s, 1, 4);   // 决胜盘 P1
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe(1);
  });
});
