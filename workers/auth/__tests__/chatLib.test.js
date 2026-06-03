import { describe, expect, it } from 'vitest';
import { conversationKey, parseHistoryParams } from '../chatLib.js';

describe('conversationKey', () => {
  it('is order-independent (min:max)', () => {
    expect(conversationKey(7, 3)).toBe('3:7');
    expect(conversationKey(3, 7)).toBe('3:7');
  });
  it('coerces numeric strings', () => {
    expect(conversationKey('10', '2')).toBe('2:10');
  });
  it('throws on equal ids', () => {
    expect(() => conversationKey(5, 5)).toThrow();
  });
  it('throws on non-numeric', () => {
    expect(() => conversationKey('x', 2)).toThrow();
  });
});

describe('parseHistoryParams', () => {
  it('defaults before=null and limit=30', () => {
    expect(parseHistoryParams({ friendId: '4' })).toEqual({ friendId: 4, before: null, limit: 30 });
  });
  it('parses before (an id cursor) + limit', () => {
    expect(parseHistoryParams({ friendId: '4', before: '1000', limit: '10' }))
      .toEqual({ friendId: 4, before: 1000, limit: 10 });
  });
  it('clamps limit to 1..100', () => {
    expect(parseHistoryParams({ friendId: '4', limit: '500' }).limit).toBe(100);
    expect(parseHistoryParams({ friendId: '4', limit: '0' }).limit).toBe(1);
  });
  it('returns null friendId when invalid', () => {
    expect(parseHistoryParams({ friendId: 'x' }).friendId).toBeNull();
  });
  it('treats empty/0 before as null cursor', () => {
    expect(parseHistoryParams({ friendId: '4', before: '' }).before).toBeNull();
  });
});
