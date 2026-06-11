import { describe, it, expect } from 'vitest';
import {
  toMultiplier, timingAccuracy, mashAccuracy, reactionAccuracy,
  zoneAccuracy, serveResult, comboAccuracy,
} from '../minigameMath';

describe('minigameMath', () => {
  it('toMultiplier: accuracy 0→0.5, 1→1.5, 越界截断', () => {
    expect(toMultiplier(0)).toBe(0.5);
    expect(toMultiplier(1)).toBe(1.5);
    expect(toMultiplier(2)).toBe(1.5);
    expect(toMultiplier(-1)).toBe(0.5);
  });

  it('timingAccuracy: 零偏差满分，窗口边缘归零，windowBonus 放宽', () => {
    expect(timingAccuracy(0, 200)).toBe(1);
    expect(timingAccuracy(200, 200)).toBe(0);
    expect(timingAccuracy(100, 200)).toBeCloseTo(0.5);
    expect(timingAccuracy(200, 200, 0.5)).toBeCloseTo(1 - 200 / 300);
  });

  it('mashAccuracy: 达标封顶', () => {
    expect(mashAccuracy(10, 20)).toBe(0.5);
    expect(mashAccuracy(25, 20)).toBe(1);
  });

  it('reactionAccuracy: 250ms 内满分，900ms 外零分', () => {
    expect(reactionAccuracy(200)).toBe(1);
    expect(reactionAccuracy(900)).toBe(0);
    expect(reactionAccuracy(575)).toBeCloseTo(0.5);
  });

  it('zoneAccuracy 与 serveResult', () => {
    expect(zoneAccuracy(50, 50, 10)).toBe(1);
    expect(serveResult(30)).toBe('ace');
    expect(serveResult(100)).toBe('good');
    expect(serveResult(500)).toBe('fault');
    expect(serveResult(70, 60, 220, 0.5)).toBe('ace');   // 放宽后 90ms 内都算
  });

  it('comboAccuracy 取平均', () => {
    expect(comboAccuracy([1, 0.5, 0])).toBeCloseTo(0.5);
    expect(comboAccuracy([])).toBe(0);
  });
});
