import { describe, it, expect } from 'vitest';
import { validateMinigameScore, MINIGAME_VARIANTS } from '../minigamesLib.js';
import { DIFFICULTIES } from '../../../src/modules/games/minesweeper/mineEngine.js';
import { LAYOUTS } from '../../../src/modules/games/mahjong/mahjongEngine.js';

describe('validateMinigameScore', () => {
  it('接受合法成绩', () => {
    expect(validateMinigameScore({ game: 'minesweeper', variant: 'expert', timeMs: 95000 }).ok).toBe(true);
    expect(validateMinigameScore({ game: 'mahjong', variant: 'turtle', timeMs: 300000 }).ok).toBe(true);
  });

  it('拒绝未知变体、非整数和过快成绩', () => {
    expect(validateMinigameScore({ game: 'minesweeper', variant: 'god', timeMs: 95000 }).ok).toBe(false);
    expect(validateMinigameScore({ game: 'chess', variant: 'expert', timeMs: 95000 }).ok).toBe(false);
    expect(validateMinigameScore({ game: 'minesweeper', variant: 'expert', timeMs: 1.5 }).ok).toBe(false);
    expect(validateMinigameScore({ game: 'minesweeper', variant: 'expert', timeMs: 100 }).ok).toBe(false);
    expect(validateMinigameScore({ game: 'minesweeper', variant: '__proto__', timeMs: 95000 }).ok).toBe(false);
    expect(validateMinigameScore(null).ok).toBe(false);
  });

  it('白名单与前端难度 / 布局完全一致', () => {
    expect(Object.keys(MINIGAME_VARIANTS.minesweeper).sort()).toEqual(Object.keys(DIFFICULTIES).sort());
    expect(Object.keys(MINIGAME_VARIANTS.mahjong).sort()).toEqual(LAYOUTS.map((l) => l.id).sort());
  });
});
