import { describe, it, expect, beforeEach } from 'vitest';
import { checkOnboardingSeen, markOnboardingSeen, TABS } from '../components/OnboardingModal';

const KEY = 'tennis_onboarding_v1';

describe('OnboardingModal — localStorage helpers', () => {
  beforeEach(() => localStorage.removeItem(KEY));

  it('checkOnboardingSeen returns false when key absent', () => {
    expect(checkOnboardingSeen()).toBe(false);
  });

  it('checkOnboardingSeen returns true after markOnboardingSeen', () => {
    markOnboardingSeen();
    expect(checkOnboardingSeen()).toBe(true);
  });

  it('markOnboardingSeen is idempotent', () => {
    markOnboardingSeen();
    markOnboardingSeen();
    expect(checkOnboardingSeen()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('checkOnboardingSeen is false before any call', () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(checkOnboardingSeen()).toBe(false);
  });
});

describe('OnboardingModal — TABS', () => {
  it('has four tabs', () => {
    expect(TABS).toHaveLength(4);
  });

  it('includes a modes tab', () => {
    expect(TABS.some((t) => t.id === 'modes')).toBe(true);
  });

  it('modes tab label mentions 游戏模式', () => {
    const modesTab = TABS.find((t) => t.id === 'modes');
    expect(modesTab?.label).toContain('游戏模式');
  });

  it('has counter, energy, tell, modes in order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['counter', 'energy', 'tell', 'modes']);
  });
});
