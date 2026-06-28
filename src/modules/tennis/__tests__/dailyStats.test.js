import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveDailyStats, loadDailyStats, getTodayKey } from '../meta/dailyChallenge';

const keyFor = (date) => `tennis_daily_stats_${date}`;

describe('dailyChallenge — saveDailyStats / loadDailyStats', () => {
  beforeEach(() => {
    const today = getTodayKey();
    localStorage.removeItem(keyFor(today));
  });

  it('loadDailyStats returns null when no stats saved', () => {
    expect(loadDailyStats('诚')).toBeNull();
  });

  it('loadDailyStats returns null for null/undefined playerName', () => {
    expect(loadDailyStats(null)).toBeNull();
    expect(loadDailyStats(undefined)).toBeNull();
    expect(loadDailyStats('')).toBeNull();
  });

  it('saves and loads win stats correctly', () => {
    saveDailyStats({ playerName: '诚', won: true, setsP: 2, setsO: 1, aces: 3, avgMultiplier: 1.45, clutchWins: 2, countersWon: 4 });
    const s = loadDailyStats('诚');
    expect(s).not.toBeNull();
    expect(s.won).toBe(true);
    expect(s.setsP).toBe(2);
    expect(s.setsO).toBe(1);
    expect(s.aces).toBe(3);
    expect(s.avgMultiplier).toBe(1.45);
    expect(s.clutchWins).toBe(2);
    expect(s.countersWon).toBe(4);
  });

  it('saves and loads loss stats correctly', () => {
    saveDailyStats({ playerName: 'Elza', won: false, setsP: 0, setsO: 2, aces: 0, avgMultiplier: null, clutchWins: 0, countersWon: 1 });
    const s = loadDailyStats('Elza');
    expect(s.won).toBe(false);
    expect(s.setsP).toBe(0);
    expect(s.setsO).toBe(2);
    expect(s.aces).toBe(0);
    expect(s.avgMultiplier).toBeNull();
    expect(s.countersWon).toBe(1);
  });

  it('multiple players can save independently on same day', () => {
    saveDailyStats({ playerName: '诚', won: true, setsP: 2, setsO: 0, aces: 2, avgMultiplier: 1.3, clutchWins: 1, countersWon: 2 });
    saveDailyStats({ playerName: '铁蛋', won: false, setsP: 1, setsO: 2, aces: 0, avgMultiplier: 0.9, clutchWins: 0, countersWon: 0 });
    const sCheng = loadDailyStats('诚');
    const sTiedan = loadDailyStats('铁蛋');
    expect(sCheng.won).toBe(true);
    expect(sTiedan.won).toBe(false);
    expect(loadDailyStats('菲比')).toBeNull();
  });

  it('overwrite replaces previous stats for same player', () => {
    saveDailyStats({ playerName: '诚', won: false, setsP: 0, setsO: 2, aces: 0, avgMultiplier: null, clutchWins: 0, countersWon: 0 });
    saveDailyStats({ playerName: '诚', won: true, setsP: 2, setsO: 1, aces: 5, avgMultiplier: 1.8, clutchWins: 3, countersWon: 2 });
    const s = loadDailyStats('诚');
    expect(s.won).toBe(true);
    expect(s.aces).toBe(5);
  });

  it('defaults missing optional fields to 0/null', () => {
    saveDailyStats({ playerName: '菲比', won: true, setsP: 2, setsO: 0 });
    const s = loadDailyStats('菲比');
    expect(s.aces).toBe(0);
    expect(s.clutchWins).toBe(0);
    expect(s.countersWon).toBe(0);
    expect(s.avgMultiplier).toBeNull();
  });

  it('loadDailyStats returns null for unknown player even when others saved', () => {
    saveDailyStats({ playerName: 'Ross', won: true, setsP: 2, setsO: 0, aces: 1, avgMultiplier: 1.1, clutchWins: 1, countersWon: 1 });
    expect(loadDailyStats('莹')).toBeNull();
  });
});
