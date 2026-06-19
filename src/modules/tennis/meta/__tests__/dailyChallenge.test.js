import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDailyChallenge, getTodayKey, isDailyChallengeCompleted, markDailyChallengeCompleted, DAILY_BONUS_COINS } from '../dailyChallenge';
import { CHARS } from '../../gameData';

describe('getDailyChallenge', () => {
  it('返回合法的对手和属性', () => {
    const result = getDailyChallenge('诚');
    expect(CHARS.map((c) => c.n)).toContain(result.foe.n);
    expect(result.foe.n).not.toBe('诚');
    expect(result.stats.sta).toBeGreaterThanOrEqual(45);
    expect(result.stats.sta).toBeLessThanOrEqual(85);
    expect(result.stats.skill).toBeGreaterThanOrEqual(45);
    expect(result.stats.mind).toBeLessThanOrEqual(85);
  });

  it('相同日期相同玩家返回相同结果（确定性）', () => {
    const a = getDailyChallenge('Elza');
    const b = getDailyChallenge('Elza');
    expect(a.foe.n).toBe(b.foe.n);
    expect(a.stats).toEqual(b.stats);
  });

  it('不同玩家可能得到不同对手（池不同）', () => {
    // 不是严格要求，但至少能无错运行全角色
    CHARS.forEach((c) => {
      const result = getDailyChallenge(c.n);
      expect(result.foe.n).not.toBe(c.n);
    });
  });
});

describe('getTodayKey', () => {
  it('返回 YYYY-MM-DD 格式字符串', () => {
    expect(getTodayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isDailyChallengeCompleted / markDailyChallengeCompleted', () => {
  const storageMap = new Map();
  beforeEach(() => {
    storageMap.clear();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => storageMap.get(k) ?? null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => storageMap.set(k, v));
  });
  afterEach(() => vi.restoreAllMocks());

  it('初始未完成', () => {
    expect(isDailyChallengeCompleted()).toBe(false);
  });

  it('markDailyChallengeCompleted 后变为已完成', () => {
    markDailyChallengeCompleted();
    expect(isDailyChallengeCompleted()).toBe(true);
  });
});

describe('DAILY_BONUS_COINS', () => {
  it('额外金币为正整数', () => {
    expect(DAILY_BONUS_COINS).toBeGreaterThan(0);
    expect(Number.isInteger(DAILY_BONUS_COINS)).toBe(true);
  });
});
