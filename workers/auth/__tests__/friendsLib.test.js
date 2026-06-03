import { describe, expect, it } from 'vitest';
import { normalizeFriendship, sanitizeSearchQuery } from '../friendsLib.js';

describe('normalizeFriendship', () => {
  it('orders the smaller id into user_a', () => {
    expect(normalizeFriendship(7, 3)).toEqual({ userA: 3, userB: 7 });
    expect(normalizeFriendship(3, 7)).toEqual({ userA: 3, userB: 7 });
  });

  it('coerces numeric strings', () => {
    expect(normalizeFriendship('10', '2')).toEqual({ userA: 2, userB: 10 });
  });

  it('throws when both ids are equal', () => {
    expect(() => normalizeFriendship(5, 5)).toThrow();
  });
});

describe('sanitizeSearchQuery', () => {
  it('trims and returns the query when long enough', () => {
    expect(sanitizeSearchQuery('  alice ')).toBe('alice');
  });

  it('returns null for queries shorter than 2 chars', () => {
    expect(sanitizeSearchQuery('a')).toBeNull();
    expect(sanitizeSearchQuery('   ')).toBeNull();
    expect(sanitizeSearchQuery('')).toBeNull();
    expect(sanitizeSearchQuery(null)).toBeNull();
  });
});
