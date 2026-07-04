import { describe, it, expect } from 'vitest';
import { randomOpp, formatTime, WIN_PTS, LOSS_PTS, SPRINT_DURATION_S } from '../SprintScreen';
import { CHARS } from '../../gameData';

describe('randomOpp', () => {
  it('never returns the player character', () => {
    for (const c of CHARS) {
      const opp = randomOpp(c.n, () => 0.5);
      expect(opp.name).not.toBe(c.n);
    }
  });

  it('generates stats in [45, 74] range', () => {
    for (let i = 0; i < 20; i++) {
      const opp = randomOpp('诚');
      expect(opp.sta).toBeGreaterThanOrEqual(45);
      expect(opp.sta).toBeLessThan(75);
      expect(opp.skill).toBeGreaterThanOrEqual(45);
      expect(opp.skill).toBeLessThan(75);
      expect(opp.mind).toBeGreaterThanOrEqual(45);
      expect(opp.mind).toBeLessThan(75);
    }
  });

  it('returns valid face and name from CHARS', () => {
    const opp = randomOpp('诚', () => 0);
    const match = CHARS.find((c) => c.n === opp.name);
    expect(match).toBeDefined();
    expect(opp.face).toBe(match.f);
  });
});

describe('formatTime', () => {
  it('formats seconds into M:SS', () => {
    expect(formatTime(900)).toBe('15:00');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(59)).toBe('0:59');
  });
});

describe('sprint constants', () => {
  it('win gives more pts than loss', () => {
    expect(WIN_PTS).toBeGreaterThan(LOSS_PTS);
    expect(LOSS_PTS).toBeGreaterThan(0);
  });

  it('default duration is 15 minutes', () => {
    expect(SPRINT_DURATION_S).toBe(900);
  });
});
