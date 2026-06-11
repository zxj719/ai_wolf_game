import { describe, it, expect } from 'vitest';
import { flappyParams, dodgeParams, scoreToMultiplier, getLevel, bumpLevel } from '../levels';

describe('难度曲线（spec §7b）', () => {
  it('flappy：0 级宽缝慢速，12 级后收敛不再变难', () => {
    const lv0 = flappyParams(0);
    const lv12 = flappyParams(12);
    expect(lv0.gapRatio).toBeCloseTo(0.34);
    expect(lv12.gapRatio).toBeCloseTo(0.18);
    expect(flappyParams(99)).toEqual(lv12);
    expect(lv12.speed).toBeGreaterThan(lv0.speed);
    expect(lv12.spawnMs).toBeLessThan(lv0.spawnMs);
  });

  it('弹幕：球数 2→6、下落与波间隔收敛', () => {
    expect(dodgeParams(0).ballsPerWave).toBe(2);
    expect(dodgeParams(12).ballsPerWave).toBe(6);
    expect(dodgeParams(12).fallMs).toBe(1100);
  });

  it('scoreToMultiplier：0 分=0.5，60 分顶格 1.5', () => {
    expect(scoreToMultiplier(0)).toBe(0.5);
    expect(scoreToMultiplier(30)).toBe(1.0);
    expect(scoreToMultiplier(60)).toBe(1.5);
    expect(scoreToMultiplier(200)).toBe(1.5);
  });

  it('等级持久化：每玩 +1（jsdom localStorage）', () => {
    expect(getLevel('flappyTest')).toBe(0);
    expect(bumpLevel('flappyTest')).toBe(1);
    expect(bumpLevel('flappyTest')).toBe(2);
    expect(getLevel('flappyTest')).toBe(2);
  });
});
