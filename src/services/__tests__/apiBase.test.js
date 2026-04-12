import { describe, expect, it } from 'vitest';
import { resolveApiBase } from '../apiBase.js';

describe('resolveApiBase', () => {
  it('falls back to local worker in dev when env points to workers.dev', () => {
    expect(resolveApiBase('https://wolfgame.example.workers.dev', true)).toBe('http://localhost:8787');
  });

  it('keeps an explicit local dev base in dev', () => {
    expect(resolveApiBase('http://localhost:9999', true)).toBe('http://localhost:9999');
  });

  it('keeps the configured production base outside dev', () => {
    expect(resolveApiBase('https://zhaxiaoji.com', false)).toBe('https://zhaxiaoji.com');
  });
});
