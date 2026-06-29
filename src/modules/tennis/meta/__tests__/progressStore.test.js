import { describe, it, expect } from 'vitest';
import { mergeProgress, EMPTY_PROGRESS } from '../progressStore';

describe('mergeProgress（本地/云端合并）', () => {
  it('解锁集取并集，计数取最大', () => {
    const a = { ...EMPTY_PROGRESS, unlockedMoves: ['虎啸正手'], achievements: ['firstWin'], championships: 2, adventureClears: 0 };
    const b = { ...EMPTY_PROGRESS, unlockedMoves: ['狐步幻影'], achievements: ['sGrade'], championships: 1, adventureClears: 1 };
    const m = mergeProgress(a, b);
    expect(m.unlockedMoves.sort()).toEqual(['狐步幻影', '虎啸正手'].sort());
    expect(m.achievements.sort()).toEqual(['firstWin', 'sGrade'].sort());
    expect(m.championships).toBe(2);
    expect(m.adventureClears).toBe(1);
  });

  it('金币取最大（防回档），装备同槽保高品质', () => {
    const a = { ...EMPTY_PROGRESS, coins: 80, equipment: { racket: { rarity: 'epic' }, shoes: { rarity: 'common' } } };
    const b = { ...EMPTY_PROGRESS, coins: 120, equipment: { racket: { rarity: 'fine' }, grip: { rarity: 'fine' } } };
    const m = mergeProgress(a, b);
    expect(m.coins).toBe(120);
    expect(m.equipment.racket.rarity).toBe('epic');
    expect(m.equipment.shoes.rarity).toBe('common');
    expect(m.equipment.grip.rarity).toBe('fine');
  });

  it('null 容错', () => {
    const a = { ...EMPTY_PROGRESS, coins: 10 };
    expect(mergeProgress(a, null)).toEqual(a);
    expect(mergeProgress(null, a)).toEqual(a);
    expect(mergeProgress(null, null)).toEqual(EMPTY_PROGRESS);
  });

  it('allFamilyChampAt 双方均有时取早者（首次达成日期保留）', () => {
    const a = { ...EMPTY_PROGRESS, allFamilyChampAt: 1000 };
    const b = { ...EMPTY_PROGRESS, allFamilyChampAt: 2000 };
    expect(mergeProgress(a, b).allFamilyChampAt).toBe(1000);
    expect(mergeProgress(b, a).allFamilyChampAt).toBe(1000);
  });

  it('allFamilyChampAt 一方 null 时取非 null 值', () => {
    const a = { ...EMPTY_PROGRESS, allFamilyChampAt: 5000 };
    const b = { ...EMPTY_PROGRESS, allFamilyChampAt: null };
    expect(mergeProgress(a, b).allFamilyChampAt).toBe(5000);
    expect(mergeProgress(b, a).allFamilyChampAt).toBe(5000);
  });

  it('allFamilyChampAt 双方均为 null 时结果也是 null', () => {
    const m = mergeProgress({ ...EMPTY_PROGRESS }, { ...EMPTY_PROGRESS });
    expect(m.allFamilyChampAt).toBeNull();
  });
});
