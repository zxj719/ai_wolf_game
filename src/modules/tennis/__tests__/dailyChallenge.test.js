import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateDailyStreak,
  loadDailyStreak,
  clearDailyStreak,
} from '../meta/dailyChallenge';

const STREAK_KEY = 'tennis_daily_streak';

describe('daily streak', () => {
  beforeEach(() => clearDailyStreak());

  it('loadDailyStreak returns 0 when no data', () => {
    expect(loadDailyStreak()).toBe(0);
  });

  it('updateDailyStreak returns 1 on first completion', () => {
    const streak = updateDailyStreak('2026-07-05');
    expect(streak).toBe(1);
  });

  it('loadDailyStreak returns 1 after first update', () => {
    updateDailyStreak('2026-07-05');
    expect(loadDailyStreak()).toBe(1);
  });

  it('idempotent: same-day call does not increment', () => {
    updateDailyStreak('2026-07-05');
    const second = updateDailyStreak('2026-07-05');
    expect(second).toBe(1);
    expect(loadDailyStreak()).toBe(1);
  });

  it('increments on consecutive day', () => {
    updateDailyStreak('2026-07-04');
    const streak = updateDailyStreak('2026-07-05');
    expect(streak).toBe(2);
    expect(loadDailyStreak()).toBe(2);
  });

  it('resets to 1 on gap (skipped day)', () => {
    updateDailyStreak('2026-07-03');
    const streak = updateDailyStreak('2026-07-05'); // gap on 07-04
    expect(streak).toBe(1);
  });

  it('builds up to 7-day streak correctly', () => {
    for (let day = 1; day <= 7; day++) {
      const date = `2026-07-0${day}`;
      updateDailyStreak(date);
    }
    expect(loadDailyStreak()).toBe(7);
  });

  it('resets after gap in long streak', () => {
    for (let day = 1; day <= 5; day++) {
      updateDailyStreak(`2026-07-0${day}`);
    }
    // skip day 6, then day 7
    const streak = updateDailyStreak('2026-07-07');
    expect(streak).toBe(1);
  });

  it('clearDailyStreak resets to 0', () => {
    updateDailyStreak('2026-07-05');
    clearDailyStreak();
    expect(loadDailyStreak()).toBe(0);
  });

  it('handles month boundary correctly (June 30 → July 1)', () => {
    updateDailyStreak('2026-06-30');
    const streak = updateDailyStreak('2026-07-01');
    expect(streak).toBe(2);
  });

  it('handles year boundary correctly (Dec 31 → Jan 1)', () => {
    updateDailyStreak('2026-12-31');
    const streak = updateDailyStreak('2027-01-01');
    expect(streak).toBe(2);
  });

  it('does not increment if today is same as lastDate', () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: 5, lastDate: '2026-07-05' }));
    const streak = updateDailyStreak('2026-07-05');
    expect(streak).toBe(5);
  });

  it('resets streak=0 stored in localStorage correctly', () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: 0, lastDate: '2026-07-03' }));
    const streak = updateDailyStreak('2026-07-05');
    expect(streak).toBe(1);
  });
});
