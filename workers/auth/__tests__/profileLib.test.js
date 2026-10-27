import { describe, expect, it } from 'vitest';
import { validatePublicProfile } from '../profileLib.js';

describe('public profile validation', () => {
  it('supports Chinese display names and trims profile text', () => {
    expect(validatePublicProfile({ displayName: '  小纪  ', bio: ' 永远保持好奇 ', location: '', website: 'https://example.com', avatarColor: 'clay' })).toEqual({ displayName: '小纪', bio: '永远保持好奇', location: '', website: 'https://example.com', avatarColor: 'clay' });
  });
  it('rejects executable URLs and oversized signatures', () => {
    expect(() => validatePublicProfile({ website: 'javascript:alert(1)' })).toThrow();
    expect(() => validatePublicProfile({ bio: 'a'.repeat(161) })).toThrow();
  });
  it('allows clearing fields without overwriting omitted values', () => {
    expect(validatePublicProfile({ bio: '' })).toEqual({ bio: '' });
  });
});
