import { describe, it, expect, beforeEach } from 'vitest';
import { checkOnboardingSeen, markOnboardingSeen } from '../components/OnboardingModal';

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
