import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME_PREF,
  normalizeThemePref,
  readStoredThemePref,
  writeStoredThemePref,
  resolveTheme,
} from '../theme.js';

describe('normalizeThemePref', () => {
  it('keeps valid prefs', () => {
    expect(normalizeThemePref('light')).toBe('light');
    expect(normalizeThemePref('dark')).toBe('dark');
    expect(normalizeThemePref('system')).toBe('system');
  });
  it('falls back to default for junk', () => {
    expect(normalizeThemePref('purple')).toBe(DEFAULT_THEME_PREF);
    expect(normalizeThemePref(null)).toBe(DEFAULT_THEME_PREF);
  });
});

describe('resolveTheme', () => {
  it('explicit user pref wins over module default', () => {
    expect(resolveTheme({ userPref: 'light', moduleDefault: 'dark' })).toBe('light');
    expect(resolveTheme({ userPref: 'dark', moduleDefault: 'light' })).toBe('dark');
  });
  it('system pref follows module default when present', () => {
    expect(resolveTheme({ userPref: 'system', moduleDefault: 'dark' })).toBe('dark');
    expect(resolveTheme({ userPref: 'system', moduleDefault: 'light' })).toBe('light');
  });
  it('falls back to systemTheme when no module default', () => {
    expect(resolveTheme({ userPref: 'system', moduleDefault: null, systemTheme: 'dark' })).toBe('dark');
    expect(resolveTheme({ userPref: 'system', moduleDefault: undefined, systemTheme: 'light' })).toBe('light');
  });
});

describe('storage round-trip', () => {
  beforeEach(() => window.localStorage.clear());
  it('reads default when empty', () => {
    expect(readStoredThemePref()).toBe(DEFAULT_THEME_PREF);
  });
  it('persists and reads back', () => {
    writeStoredThemePref('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredThemePref()).toBe('dark');
  });
  it('normalizes junk on read', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'banana');
    expect(readStoredThemePref()).toBe(DEFAULT_THEME_PREF);
  });
});
