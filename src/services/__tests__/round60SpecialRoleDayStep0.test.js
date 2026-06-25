// Round 60 tests: Special role DAY_SPEECH Step 0 additions and 追加 format completion
// Covers: dreamweaver.js + magician.js missing DAY→DAY read-write loop closure
// Secondary: all 3 special role files now have bold **追加不覆盖历史** format
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const knightSrc = readFileSync(resolve(__dirname, '../rolePrompts/knight.js'), 'utf-8');
const dreamweaverSrc = readFileSync(resolve(__dirname, '../rolePrompts/dreamweaver.js'), 'utf-8');
const magicianSrc = readFileSync(resolve(__dirname, '../rolePrompts/magician.js'), 'utf-8');
const aiPromptsSrc = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf-8');

describe('Round 60 A: Dreamweaver DAY_SPEECH Step 0', () => {
  it('T1: dreamweaver.js has dreamweaverDayHistoryStep variable declaration', () => {
    expect(dreamweaverSrc).toContain('dreamweaverDayHistoryStep');
  });

  it('T2: dreamweaver.js Step 0 contains "连梦候选" keyword (read←write alignment)', () => {
    const idx = dreamweaverSrc.indexOf('dreamweaverDayHistoryStep');
    expect(idx).toBeGreaterThan(-1);
    const segment = dreamweaverSrc.slice(idx, idx + 700);
    expect(segment).toContain('连梦候选');
  });

  it('T3: dreamweaver.js Step 0 mentions "防御入梦候选" (defensive side of read)', () => {
    const idx = dreamweaverSrc.indexOf('dreamweaverDayHistoryStep');
    const segment = dreamweaverSrc.slice(idx, idx + 700);
    expect(segment).toContain('防御入梦候选');
  });

  it('T4: dreamweaver.js Step 0 appears (as interpolation ${...}) before Step1 in template', () => {
    const step0Idx = dreamweaverSrc.indexOf('${dreamweaverDayHistoryStep}');
    const step1Idx = dreamweaverSrc.indexOf('Step1: 昨晚入梦回顾');
    expect(step0Idx).toBeGreaterThan(-1);
    expect(step1Idx).toBeGreaterThan(-1);
    expect(step0Idx).toBeLessThan(step1Idx);
  });

  it('T5: dreamweaver.js Step 0 D1 fallback says "Step1 开始"', () => {
    const idx = dreamweaverSrc.indexOf('dreamweaverDayHistoryStep');
    const segment = dreamweaverSrc.slice(idx, idx + 700);
    expect(segment).toContain('Step1 开始');
    expect(segment).toContain('首日无历史候选记录');
  });

  it('T6: dreamweaver.js keyword alignment — "连梦候选" in write guide AND Step 0', () => {
    const writeGuideIdx = dreamweaverSrc.indexOf('identity_table 填写指导');
    expect(writeGuideIdx).toBeGreaterThan(-1);
    const writeSegment = dreamweaverSrc.slice(writeGuideIdx, writeGuideIdx + 500);
    expect(writeSegment).toContain('连梦候选');

    const step0Idx = dreamweaverSrc.indexOf('dreamweaverDayHistoryStep');
    const readSegment = dreamweaverSrc.slice(step0Idx, step0Idx + 700);
    expect(readSegment).toContain('连梦候选');
  });
});

describe('Round 60 B: Magician DAY_SPEECH Step 0', () => {
  it('T7: magician.js has magicianDayHistoryStep variable declaration', () => {
    expect(magicianSrc).toContain('magicianDayHistoryStep');
  });

  it('T8: magician.js DAY Step 0 contains "换刀候选" keyword', () => {
    const idx = magicianSrc.indexOf('magicianDayHistoryStep');
    expect(idx).toBeGreaterThan(-1);
    const segment = magicianSrc.slice(idx, idx + 700);
    expect(segment).toContain('换刀候选');
  });

  it('T9: magician.js DAY Step 0 mentions "保核目标候选" (protective side of read)', () => {
    const idx = magicianSrc.indexOf('magicianDayHistoryStep');
    const segment = magicianSrc.slice(idx, idx + 700);
    expect(segment).toContain('保核目标候选');
  });

  it('T10: magician.js Step 0 appears (as interpolation ${...}) before Step1 in template', () => {
    const step0Idx = magicianSrc.indexOf('${magicianDayHistoryStep}');
    const step1Idx = magicianSrc.indexOf('Step1: 逻辑镜像计算');
    expect(step0Idx).toBeGreaterThan(-1);
    expect(step1Idx).toBeGreaterThan(-1);
    expect(step0Idx).toBeLessThan(step1Idx);
  });

  it('T11: magician.js DAY Step 0 D1 fallback says "Step1 开始"', () => {
    const idx = magicianSrc.indexOf('magicianDayHistoryStep');
    const segment = magicianSrc.slice(idx, idx + 700);
    expect(segment).toContain('Step1 开始');
    expect(segment).toContain('首日无历史候选记录');
  });

  it('T12: magician.js DAY keyword alignment — "换刀候选" in write guide AND DAY Step 0', () => {
    const dayWriteIdx = magicianSrc.indexOf('identity_table 填写指导（魔术师白天');
    expect(dayWriteIdx).toBeGreaterThan(-1);
    const writeSegment = magicianSrc.slice(dayWriteIdx, dayWriteIdx + 600);
    expect(writeSegment).toContain('换刀候选');

    const step0Idx = magicianSrc.indexOf('magicianDayHistoryStep');
    const readSegment = magicianSrc.slice(step0Idx, step0Idx + 700);
    expect(readSegment).toContain('换刀候选');
  });

  it('T13: magicianDayHistoryStep is SEPARATE from magicianHistoryStep (night vs day)', () => {
    // night Step 0 uses magicianHistoryStep; day uses magicianDayHistoryStep
    const nightIdx = magicianSrc.indexOf('magicianHistoryStep');
    const dayIdx = magicianSrc.indexOf('magicianDayHistoryStep');
    expect(nightIdx).toBeGreaterThan(-1);
    expect(dayIdx).toBeGreaterThan(-1);
    expect(dayIdx).not.toEqual(nightIdx);
  });
});

describe('Round 60 C: **追加不覆盖历史** bold format in all 3 special role files', () => {
  it('T14: knight.js has **追加不覆盖历史** in bold format', () => {
    expect(knightSrc).toContain('**追加不覆盖历史**');
  });

  it('T15: dreamweaver.js has **追加不覆盖历史** in bold format', () => {
    expect(dreamweaverSrc).toContain('**追加不覆盖历史**');
  });

  it('T16: magician.js DAY write guide has **追加不覆盖历史**', () => {
    const dayWriteIdx = magicianSrc.indexOf('identity_table 填写指导（魔术师白天');
    expect(dayWriteIdx).toBeGreaterThan(-1);
    const segment = magicianSrc.slice(dayWriteIdx, dayWriteIdx + 500);
    expect(segment).toContain('**追加不覆盖历史**');
  });

  it('T17: magician.js NIGHT write guide has **追加不覆盖历史**', () => {
    const nightWriteIdx = magicianSrc.indexOf('identity_table 填写指导（魔术师夜间');
    expect(nightWriteIdx).toBeGreaterThan(-1);
    const segment = magicianSrc.slice(nightWriteIdx, nightWriteIdx + 500);
    expect(segment).toContain('**追加不覆盖历史**');
  });
});

describe('Round 60 D: Regression — 【追加示例】 and NIGHT Step 0 intact', () => {
  it('T18: dreamweaver.js still has 【追加示例】 (R44 regression)', () => {
    expect(dreamweaverSrc).toContain('【追加示例】');
  });

  it('T19: magician.js still has 【追加示例】 in NIGHT write guide', () => {
    const nightWriteIdx = magicianSrc.indexOf('identity_table 填写指导（魔术师夜间');
    const segment = magicianSrc.slice(nightWriteIdx, nightWriteIdx + 500);
    expect(segment).toContain('【追加示例】');
  });

  it('T20: magician.js still has 【追加示例】 in DAY write guide', () => {
    const dayWriteIdx = magicianSrc.indexOf('identity_table 填写指导（魔术师白天');
    const segment = magicianSrc.slice(dayWriteIdx, dayWriteIdx + 600);
    expect(segment).toContain('【追加示例】');
  });

  it('T21: knight.js still has 【追加示例】 (R44 regression)', () => {
    expect(knightSrc).toContain('【追加示例】');
  });

  it('T22: magician.js NIGHT Step 0 still reads "换刀候选" (R43 regression)', () => {
    // getMagicianNightActionPrompt is the first function, magicianHistoryStep is in it
    const nightFnIdx = magicianSrc.indexOf('getMagicianNightActionPrompt');
    const nightHistoryIdx = magicianSrc.indexOf('magicianHistoryStep', nightFnIdx);
    expect(nightHistoryIdx).toBeGreaterThan(-1);
    const segment = magicianSrc.slice(nightHistoryIdx, nightHistoryIdx + 600);
    expect(segment).toContain('换刀候选');
  });

  it('T23: aiPrompts.js still has "连梦候选" in NIGHT_DREAMWEAVER write guide (regression)', () => {
    // "连梦候选" is in the identity_table write guide within the NIGHT_DREAMWEAVER case body
    // Search the full file — the string should appear at least once in the NIGHT case
    expect(aiPromptsSrc).toContain('连梦候选');
    // Anchor: dreamweaverNightLabel is uniquely defined inside NIGHT_DREAMWEAVER case
    const labelIdx = aiPromptsSrc.indexOf('dreamweaverNightLabel}夜[首次入梦');
    expect(labelIdx).toBeGreaterThan(-1);
  });

  it('T24: NIGHT_DREAMWEAVER in aiPrompts.js still has dreamweaverHistoryStep (NIGHT Step 0 intact)', () => {
    expect(aiPromptsSrc).toContain('dreamweaverHistoryStep');
  });

  it('T25: knight.js DAY Step 0 (knightHistoryStep, R44) still reads "决斗候选" (regression)', () => {
    expect(knightSrc).toContain('knightHistoryStep');
    const idx = knightSrc.indexOf('knightHistoryStep');
    const segment = knightSrc.slice(idx, idx + 700);
    expect(segment).toContain('决斗候选');
  });
});
