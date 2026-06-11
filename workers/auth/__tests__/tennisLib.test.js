import { describe, it, expect } from 'vitest';
import { validateTennisRecord } from '../tennisLib.js';

const valid = () => ({
  character: '诚',
  characterFace: '🐯',
  opponent: 'Elza',
  opponentFace: '🦊',
  setsWon: 2,
  setsLost: 1,
  reactionMs: 213,
  grade: 'S',
});

describe('validateTennisRecord', () => {
  it('合法 payload 通过并归一化字段', () => {
    const r = validateTennisRecord(valid());
    expect(r.ok).toBe(true);
    expect(r.record).toEqual({
      character: '诚',
      characterFace: '🐯',
      opponent: 'Elza',
      opponentFace: '🦊',
      setsWon: 2,
      setsLost: 1,
      reactionMs: 213,
      grade: 'S',
    });
  });

  it('reactionMs 允许为 null（极端情况下未记录）', () => {
    const r = validateTennisRecord({ ...valid(), reactionMs: null });
    expect(r.ok).toBe(true);
    expect(r.record.reactionMs).toBe(null);
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 0],
    [0, 0],
    [-1, 2],
  ])('非法盘分 %i-%i 拒绝', (sw, sl) => {
    const r = validateTennisRecord({ ...valid(), setsWon: sw, setsLost: sl });
    expect(r.ok).toBe(false);
  });

  it('0-2 失利是合法比分', () => {
    const r = validateTennisRecord({ ...valid(), setsWon: 0, setsLost: 2 });
    expect(r.ok).toBe(true);
  });

  it('未知角色拒绝', () => {
    expect(validateTennisRecord({ ...valid(), character: '路人甲' }).ok).toBe(false);
    expect(validateTennisRecord({ ...valid(), opponent: '路人乙' }).ok).toBe(false);
  });

  it('自己打自己拒绝', () => {
    expect(validateTennisRecord({ ...valid(), opponent: '诚' }).ok).toBe(false);
  });

  it('反应时间超人类（<80ms）或非数字拒绝', () => {
    expect(validateTennisRecord({ ...valid(), reactionMs: 79 }).ok).toBe(false);
    expect(validateTennisRecord({ ...valid(), reactionMs: 'fast' }).ok).toBe(false);
    expect(validateTennisRecord({ ...valid(), reactionMs: 60001 }).ok).toBe(false);
  });

  it('非法 grade 拒绝', () => {
    expect(validateTennisRecord({ ...valid(), grade: 'SS' }).ok).toBe(false);
  });

  it('face 字段非白名单 emoji 时回退为对应角色默认 face', () => {
    const r = validateTennisRecord({ ...valid(), characterFace: '<script>' });
    expect(r.ok).toBe(true);
    expect(r.record.characterFace).toBe('🐯');
  });
});
