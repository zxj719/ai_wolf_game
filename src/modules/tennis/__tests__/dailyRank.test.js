import { describe, it, expect } from 'vitest';
import { computeDailyRank } from '../meta/dailyChallenge';

const mkC = (player_name, won, duration_s) => ({ player_name, won, duration_s });

describe('computeDailyRank', () => {
  it('returns null when playerName is empty', () => {
    const cs = [mkC('诚', true, 120)];
    expect(computeDailyRank('', cs)).toBeNull();
    expect(computeDailyRank(null, cs)).toBeNull();
    expect(computeDailyRank(undefined, cs)).toBeNull();
  });

  it('returns null when completions is null or not an array', () => {
    expect(computeDailyRank('诚', null)).toBeNull();
    expect(computeDailyRank('诚', undefined)).toBeNull();
    expect(computeDailyRank('诚', {})).toBeNull();
  });

  it('returns null when completions is empty', () => {
    expect(computeDailyRank('诚', [])).toBeNull();
  });

  it('returns null when player is not in winners (player lost)', () => {
    const cs = [mkC('诚', true, 120), mkC('铁蛋', false, 90)];
    expect(computeDailyRank('铁蛋', cs)).toBeNull();
  });

  it('returns null when player won but duration_s is 0', () => {
    const cs = [mkC('诚', true, 0), mkC('Elza', true, 130)];
    expect(computeDailyRank('诚', cs)).toBeNull();
  });

  it('returns 1 for the single winner', () => {
    const cs = [mkC('诚', true, 120)];
    expect(computeDailyRank('诚', cs)).toBe(1);
  });

  it('returns 1 for the fastest winner among multiple', () => {
    const cs = [mkC('Elza', true, 200), mkC('诚', true, 95), mkC('菲比', true, 150)];
    expect(computeDailyRank('诚', cs)).toBe(1);
  });

  it('returns correct rank for second and third place', () => {
    const cs = [mkC('诚', true, 95), mkC('Elza', true, 200), mkC('菲比', true, 150)];
    // sorted: 诚(95) → 菲比(150) → Elza(200)
    expect(computeDailyRank('菲比', cs)).toBe(2);
    expect(computeDailyRank('Elza', cs)).toBe(3);
  });

  it('excludes losers from rank calculation', () => {
    const cs = [
      mkC('铁蛋', false, 80),   // loser with best time — should not count
      mkC('诚', true, 120),
      mkC('Elza', true, 100),
    ];
    // winners sorted: Elza(100) → 诚(120)
    expect(computeDailyRank('Elza', cs)).toBe(1);
    expect(computeDailyRank('诚', cs)).toBe(2);
    expect(computeDailyRank('铁蛋', cs)).toBeNull();
  });

  it('returns null when player not present in completions at all', () => {
    const cs = [mkC('诚', true, 120), mkC('Elza', true, 100)];
    expect(computeDailyRank('莹', cs)).toBeNull();
  });

  it('handles single winner correctly (rank 1)', () => {
    const cs = [
      mkC('Ross', false, 180),
      mkC('丫', false, 90),
      mkC('莹', true, 240),
    ];
    expect(computeDailyRank('莹', cs)).toBe(1);
  });
});
