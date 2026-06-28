import { describe, it, expect } from 'vitest';
import { computeDailyRank } from '../meta/dailyChallenge';

const makeCompletion = (player_name, won, duration_s) => ({ player_name, won, duration_s });

describe('computeDailyRank', () => {
  it('returns null for null completions', () => {
    expect(computeDailyRank(null, '诚')).toBeNull();
  });

  it('returns null for undefined completions', () => {
    expect(computeDailyRank(undefined, '诚')).toBeNull();
  });

  it('returns null for empty player name', () => {
    expect(computeDailyRank([makeCompletion('诚', true, 120)], '')).toBeNull();
    expect(computeDailyRank([makeCompletion('诚', true, 120)], null)).toBeNull();
  });

  it('returns null when completions array is empty', () => {
    expect(computeDailyRank([], '诚')).toBeNull();
  });

  it('returns null when player is not in completions', () => {
    const completions = [makeCompletion('Elza', true, 100), makeCompletion('菲比', true, 90)];
    expect(computeDailyRank(completions, '诚')).toBeNull();
  });

  it('returns null when player lost (losers excluded from rank)', () => {
    const completions = [
      makeCompletion('诚', false, 150),
      makeCompletion('Elza', true, 120),
    ];
    expect(computeDailyRank(completions, '诚')).toBeNull();
  });

  it('returns null when player won but duration_s is 0', () => {
    const completions = [
      makeCompletion('诚', true, 0),
      makeCompletion('Elza', true, 120),
    ];
    expect(computeDailyRank(completions, '诚')).toBeNull();
  });

  it('returns rank 1 for the fastest winner', () => {
    const completions = [
      makeCompletion('诚', true, 300),
      makeCompletion('Elza', true, 90),
      makeCompletion('菲比', true, 200),
    ];
    expect(computeDailyRank(completions, 'Elza')).toBe(1);
  });

  it('returns rank 2 for the second fastest winner', () => {
    const completions = [
      makeCompletion('诚', true, 300),
      makeCompletion('Elza', true, 90),
      makeCompletion('菲比', true, 200),
    ];
    expect(computeDailyRank(completions, '菲比')).toBe(2);
  });

  it('returns rank 3 for the slowest winner', () => {
    const completions = [
      makeCompletion('诚', true, 300),
      makeCompletion('Elza', true, 90),
      makeCompletion('菲比', true, 200),
    ];
    expect(computeDailyRank(completions, '诚')).toBe(3);
  });

  it('losers do not affect rank counting', () => {
    const completions = [
      makeCompletion('Ross', false, 80),
      makeCompletion('诚', true, 200),
      makeCompletion('Elza', true, 90),
    ];
    expect(computeDailyRank(completions, '诚')).toBe(2);
    expect(computeDailyRank(completions, 'Elza')).toBe(1);
    expect(computeDailyRank(completions, 'Ross')).toBeNull();
  });

  it('zero-duration winners do not affect rank counting', () => {
    const completions = [
      makeCompletion('丫', true, 0),
      makeCompletion('诚', true, 200),
      makeCompletion('Elza', true, 90),
    ];
    expect(computeDailyRank(completions, '诚')).toBe(2);
    expect(computeDailyRank(completions, '丫')).toBeNull();
  });

  it('rank 1 when player is the only winner', () => {
    const completions = [
      makeCompletion('诚', true, 150),
      makeCompletion('Elza', false, 90),
    ];
    expect(computeDailyRank(completions, '诚')).toBe(1);
  });
});
