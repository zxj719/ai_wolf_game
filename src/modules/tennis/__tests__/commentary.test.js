import { describe, it, expect } from 'vitest';
import { getPostMatchCommentary } from '../commentary';

const BASE = {
  playerName: '诚', oppName: 'Elza', playerFace: '🐯',
  playerWon: true, setsP: 2, setsO: 0,
  aces: 0, clutchWins: 0, countersWon: 0,
};

describe('getPostMatchCommentary', () => {
  it('returns a non-empty string', () => {
    const result = getPostMatchCommentary(BASE);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('ACE win (≥3 aces) always returns ACE commentary', () => {
    // Run multiple times to cover random branch
    for (let i = 0; i < 5; i++) {
      const result = getPostMatchCommentary({ ...BASE, aces: 4 });
      expect(result).toContain('ACE');
    }
  });

  it('clutch win (≥3 clutchWins) returns关键分/CLUTCH commentary', () => {
    for (let i = 0; i < 5; i++) {
      const result = getPostMatchCommentary({ ...BASE, clutchWins: 3 });
      expect(result).toMatch(/关键分|CLUTCH/);
    }
  });

  it('counter win (≥3 countersWon) returns克制/克招 commentary', () => {
    for (let i = 0; i < 5; i++) {
      const result = getPostMatchCommentary({ ...BASE, countersWon: 4 });
      expect(result).toMatch(/克制|克招/);
    }
  });

  it('2-0 win pool includes sweep lines', () => {
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(getPostMatchCommentary({ ...BASE, setsP: 2, setsO: 0 }));
    }
    const hasSweep = [...results].some(r => r.includes('横扫') || r.includes('2:0'));
    expect(hasSweep).toBe(true);
  });

  it('2-1 win pool includes comeback lines', () => {
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(getPostMatchCommentary({ ...BASE, setsP: 2, setsO: 1 }));
    }
    const hasComeback = [...results].some(r => r.includes('逆袭') || r.includes('2:1'));
    expect(hasComeback).toBe(true);
  });

  it('loss with ≥2 aces returns ACE commentary', () => {
    for (let i = 0; i < 5; i++) {
      const result = getPostMatchCommentary({ ...BASE, playerWon: false, setsP: 0, setsO: 2, aces: 3 });
      expect(result).toContain('ACE');
    }
  });

  it('loss with ≥2 clutchWins returns clutch-loss commentary', () => {
    for (let i = 0; i < 5; i++) {
      const result = getPostMatchCommentary({ ...BASE, playerWon: false, setsP: 0, setsO: 2, clutchWins: 2 });
      expect(result).toMatch(/关键分|顶住/);
    }
  });

  it('1-2 close loss pool includes惜败 lines', () => {
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(getPostMatchCommentary({ ...BASE, playerWon: false, setsP: 1, setsO: 2 }));
    }
    const hasClose = [...results].some(r => r.includes('惜败') || r.includes('翻盘') || r.includes('1:2'));
    expect(hasClose).toBe(true);
  });

  it('0-2 loss pool includes crushing-loss lines', () => {
    const results = new Set();
    for (let i = 0; i < 30; i++) {
      results.add(getPostMatchCommentary({ ...BASE, playerWon: false, setsP: 0, setsO: 2 }));
    }
    const hasCrushing = [...results].some(r => r.includes('0:2') || r.includes('完败') || r.includes('克星'));
    expect(hasCrushing).toBe(true);
  });

  it('works for all 7 characters without throwing', () => {
    const chars = ['诚', 'Elza', '菲比', 'Ross', '铁蛋', '丫', '莹'];
    for (const playerName of chars) {
      const win = getPostMatchCommentary({ ...BASE, playerName, setsP: 2, setsO: 1 });
      const loss = getPostMatchCommentary({ ...BASE, playerName, playerWon: false, setsP: 1, setsO: 2 });
      expect(typeof win).toBe('string');
      expect(win.length).toBeGreaterThan(0);
      expect(typeof loss).toBe('string');
      expect(loss.length).toBeGreaterThan(0);
    }
  });

  it('fills template variables correctly (no leftover braces)', () => {
    const scenarios = [
      { ...BASE, aces: 3 },
      { ...BASE, clutchWins: 3 },
      { ...BASE, countersWon: 3 },
      { ...BASE, playerWon: false, setsP: 0, setsO: 2 },
      { ...BASE, playerWon: false, setsP: 1, setsO: 2 },
    ];
    for (const s of scenarios) {
      const result = getPostMatchCommentary(s);
      expect(result).not.toMatch(/\{[a-z]/);
    }
  });

  it('priority: aces≥3 beats clutch≥3 for win', () => {
    for (let i = 0; i < 10; i++) {
      const result = getPostMatchCommentary({ ...BASE, aces: 5, clutchWins: 5 });
      expect(result).toContain('ACE');
    }
  });
});
