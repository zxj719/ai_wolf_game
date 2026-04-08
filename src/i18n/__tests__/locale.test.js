import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_DEFINITIONS } from '../../config/roles.js';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getRoleDescription,
  getRoleLabel,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
} from '../locale.js';

describe('locale helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes unsupported values back to the default locale', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it('reads and writes the locale preference from localStorage', () => {
    expect(readStoredLocale()).toBe(DEFAULT_LOCALE);

    writeStoredLocale('en');

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(readStoredLocale()).toBe('en');
  });

  it('translates role labels from role keys and runtime role names', () => {
    expect(getRoleLabel('SEER', 'en')).toBe('Seer');
    expect(getRoleLabel(ROLE_DEFINITIONS.WEREWOLF, 'en')).toBe('Werewolf');
    expect(getRoleDescription('WITCH', 'en')).toContain('antidote');
  });
});
