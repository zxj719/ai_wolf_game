import { describe, it, expect } from 'vitest';
import { validateProgressUpdate, DEFAULT_PROGRESS } from '../tennisProgressLib.js';

const existing = () => ({
  coins: 100,
  equipment: { racket: { rarity: 'fine' } },
  unlockedMoves: ['虎啸正手'],
  achievements: ['firstWin'],
  championships: 1,
  adventureClears: 0,
});

const valid = () => ({
  coins: 250,
  equipment: { racket: { rarity: 'epic' }, charm: { rarity: 'common', special: 'counterBoost' } },
  unlockedMoves: ['虎啸正手', '狐步幻影'],
  achievements: ['firstWin', 'familyKing'],
  championships: 2,
  adventureClears: 0,
});

describe('validateProgressUpdate', () => {
  it('合法更新通过并归一化', () => {
    const r = validateProgressUpdate(valid(), existing());
    expect(r.ok).toBe(true);
    expect(r.progress.coins).toBe(250);
    expect(r.progress.unlockedMoves).toEqual(['虎啸正手', '狐步幻影']);
  });

  it('金币单次增量超 500 拒绝；下降（消费）允许', () => {
    expect(validateProgressUpdate({ ...valid(), coins: 601 }, existing()).ok).toBe(false);
    expect(validateProgressUpdate({ ...valid(), coins: 0 }, existing()).ok).toBe(true);
    expect(validateProgressUpdate({ ...valid(), coins: -5 }, existing()).ok).toBe(false);
  });

  it('championships 回退或跳级拒绝', () => {
    expect(validateProgressUpdate({ ...valid(), championships: 0 }, existing()).ok).toBe(false);
    expect(validateProgressUpdate({ ...valid(), championships: 3 }, existing()).ok).toBe(false);
    expect(validateProgressUpdate({ ...valid(), championships: 1 }, existing()).ok).toBe(true);
  });

  it('adventureClears 同样单调且步进 ≤1', () => {
    expect(validateProgressUpdate({ ...valid(), adventureClears: 2 }, existing()).ok).toBe(false);
    expect(validateProgressUpdate({ ...valid(), adventureClears: 1 }, existing()).ok).toBe(true);
  });

  it('枚举外的装备槽/品质/特效/绝技/成就拒绝', () => {
    expect(validateProgressUpdate(
      { ...valid(), equipment: { hat: { rarity: 'epic' } } }, existing()).ok).toBe(false);
    expect(validateProgressUpdate(
      { ...valid(), equipment: { racket: { rarity: 'mythic' } } }, existing()).ok).toBe(false);
    expect(validateProgressUpdate(
      { ...valid(), equipment: { charm: { rarity: 'fine', special: 'hax' } } }, existing()).ok).toBe(false);
    expect(validateProgressUpdate(
      { ...valid(), unlockedMoves: ['绝世神功'] }, existing()).ok).toBe(false);
    expect(validateProgressUpdate(
      { ...valid(), achievements: ['hacker'] }, existing()).ok).toBe(false);
  });

  it('已解锁的绝技不可丢失（并集语义）', () => {
    const r = validateProgressUpdate({ ...valid(), unlockedMoves: ['狐步幻影'] }, existing());
    expect(r.ok).toBe(true);
    expect(r.progress.unlockedMoves.sort()).toEqual(['虎啸正手', '狐步幻影'].sort());
  });

  it('DEFAULT_PROGRESS 形状', () => {
    expect(DEFAULT_PROGRESS).toEqual({
      coins: 0, equipment: {}, unlockedMoves: [], achievements: [], ownedCards: [],
      championships: 0, adventureClears: 0,
    });
  });

  it('ownedCards：枚举外/超上限/形状错误拒绝，合法通过', () => {
    const ok = validateProgressUpdate(
      { ...valid(), ownedCards: [{ cardId: 'towelTime', upgraded: false }] }, existing());
    expect(ok.ok).toBe(true);
    expect(ok.progress.ownedCards).toHaveLength(1);
    expect(validateProgressUpdate(
      { ...valid(), ownedCards: [{ cardId: 'hax', upgraded: false }] }, existing()).ok).toBe(false);
    expect(validateProgressUpdate(
      { ...valid(), ownedCards: Array(11).fill({ cardId: 'towelTime', upgraded: false }) }, existing()).ok).toBe(false);
  });
});
