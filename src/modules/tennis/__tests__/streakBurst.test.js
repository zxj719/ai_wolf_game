import { describe, it, expect } from 'vitest';
import { shouldShowBurst, seedParticles } from '../components/StreakBurst';

describe('shouldShowBurst', () => {
  it('returns false for streaks below 5', () => {
    expect(shouldShowBurst(0)).toBe(false);
    expect(shouldShowBurst(1)).toBe(false);
    expect(shouldShowBurst(3)).toBe(false);
    expect(shouldShowBurst(4)).toBe(false);
  });

  it('returns true for exactly 5', () => {
    expect(shouldShowBurst(5)).toBe(true);
  });

  it('returns true for streaks above 5', () => {
    expect(shouldShowBurst(6)).toBe(true);
    expect(shouldShowBurst(10)).toBe(true);
    expect(shouldShowBurst(99)).toBe(true);
  });
});

describe('seedParticles', () => {
  it('generates 30 particles by default', () => {
    expect(seedParticles()).toHaveLength(30);
  });

  it('generates the requested count', () => {
    expect(seedParticles(10)).toHaveLength(10);
    expect(seedParticles(1)).toHaveLength(1);
  });

  it('each particle has required display fields', () => {
    const particles = seedParticles(30);
    for (const p of particles) {
      expect(typeof p.id).toBe('number');
      expect(typeof p.color).toBe('string');
      expect(p.color.startsWith('#')).toBe(true);
      expect(typeof p.left).toBe('number');
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThan(100);
      expect(typeof p.delay).toBe('number');
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(typeof p.duration).toBe('number');
      expect(p.duration).toBeGreaterThan(0);
      expect(typeof p.size).toBe('number');
      expect(p.size).toBeGreaterThan(0);
      expect(typeof p.radius).toBe('string');
      expect(typeof p.startRotate).toBe('number');
    }
  });

  it('particle ids are unique', () => {
    const ids = seedParticles(30).map((p) => p.id);
    expect(new Set(ids).size).toBe(30);
  });

  it('particle left positions are spread across 0-100 range', () => {
    const lefts = seedParticles(30).map((p) => p.left);
    expect(Math.max(...lefts)).toBeGreaterThan(50);
    expect(Math.min(...lefts)).toBeLessThan(20);
  });
});
