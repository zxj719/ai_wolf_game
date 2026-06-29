/**
 * Round 87: 骑士 DAY_SPEECH personalityLens 注入测试
 * 覆盖：7 种个性类型 × 2 阶段（pre-duel/post-duel）+ knightSpeechLen 动态化 + 白熊效应合规
 */
import { describe, test, expect } from 'vitest';
import { getKnightDaySpeechPrompt } from '../rolePrompts/knight.js';

const makeCtx = (dayCount = 1) => ({
  dayCount,
  alivePlayersInfo: '2号、3号、4号、5号、6号存活',
  deathLog: '',
  voteInfo: '',
  lastNightInfo: '',
  seerChecks: [],
});

const makeParams = (personalityType = '', hasUsedDuel = false) => ({
  hasUsedDuel,
  aliveCount: 8,
  personalityType,
});

// —— T1-T5: 变量声明与基本存在 ——

test('T1: knightPersonalityLens 变量在函数体内声明', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  expect(src).toContain('knightPersonalityType');
  expect(src).toContain('knightPersonalityLens');
});

test('T2: knightSpeechLen 默认为 40-80字', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  expect(src).toContain("let knightSpeechLen = '40-80字'");
});

test('T3: aggressive 类型 pre-duel speechLen = 35-55字', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  expect(src).toContain("'35-55字'");
});

test('T4: cautious 类型 speechLen = 55-90字', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  expect(src).toContain("'55-90字'");
});

test('T5: 输出 JSON 使用 ${knightSpeechLen} 插值而非硬编码', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  expect(src).toContain('${knightSpeechLen}');
  // 确认 return 块中无硬编码 40-80
  const returnIdx = src.indexOf('return `${getBaseContext(ctx)}');
  const returnBlock = src.slice(returnIdx);
  expect(returnBlock).not.toContain('发言内容(40-80字)');
});

// —— T6-T10: 生成输出内容验证 ——

test('T6: logical 类型 pre-duel 包含"推理积累型"风格', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('logical', false));
  expect(result).toContain('推理积累型');
});

test('T7: logical 类型 post-duel 包含"数据驱动型"领袖风格', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('logical', true));
  expect(result).toContain('数据驱动型');
  expect(result).toContain('领袖风格');
});

test('T8: aggressive 类型 pre-duel 包含"速攻伺机型"', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('aggressive', false));
  expect(result).toContain('速攻伺机型');
});

test('T9: aggressive 类型 post-duel 包含"快速主导型"', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('aggressive', true));
  expect(result).toContain('快速主导型');
});

test('T10: emotional 类型 post-duel 包含"感染共情型"', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('emotional', true));
  expect(result).toContain('感染共情型');
});

// —— T11-T15: 注入位置与模板结构 ——

test('T11: ${knightPersonalityLens} 占位符在模板 return 块内', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  const returnIdx = src.indexOf('return `${getBaseContext(ctx)}');
  const returnBlock = src.slice(returnIdx, returnIdx + 6000);
  expect(returnBlock).toContain('${knightPersonalityLens}');
});

test('T12: personalityLens 注入在【决斗禁忌】之后', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  const returnIdx = src.indexOf('return `${getBaseContext(ctx)}');
  const returnBlock = src.slice(returnIdx, returnIdx + 6000);
  const forbiddenIdx = returnBlock.indexOf('【决斗禁忌】');
  const lensPlaceholderIdx = returnBlock.indexOf('${knightPersonalityLens}');
  expect(lensPlaceholderIdx).toBeGreaterThan(forbiddenIdx);
});

test('T13: personalityLens 注入在【思维链】之前', () => {
  const src = require('fs').readFileSync('src/services/rolePrompts/knight.js', 'utf8');
  const returnIdx = src.indexOf('return `${getBaseContext(ctx)}');
  const returnBlock = src.slice(returnIdx, returnIdx + 6000);
  const lensPlaceholderIdx = returnBlock.indexOf('${knightPersonalityLens}');
  const cotIdx = returnBlock.indexOf('【思维链（必须完成）】');
  expect(lensPlaceholderIdx).toBeLessThan(cotIdx);
});

test('T14: cautious pre-duel 输出字数提示含 55-90字', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(1), makeParams('cautious', false));
  expect(result).toContain('55-90字');
});

test('T15: 无 personalityType 时输出不含个性风格标记（向下兼容）', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('', false));
  expect(result).not.toContain('【你的发言风格】');
  expect(result).not.toContain('【你的领袖风格】');
});

// —— T16-T20: 回归 + 白熊效应合规 ——

test('T16: 所有 7 种类型 pre-duel 均不含白熊禁词', () => {
  const types = ['logical', 'aggressive', 'emotional', 'contrarian', 'cunning', 'cautious', 'steady'];
  const forbidden = ['不要', '禁止', '绝不能', '不能说'];
  for (const t of types) {
    const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams(t, false));
    const lensPart = result.match(/【你的(发言|领袖)风格】[^【]*/)?.[0] || '';
    for (const word of forbidden) {
      expect(lensPart, `${t} pre-duel 含白熊禁词: ${word}`).not.toContain(word);
    }
  }
});

test('T17: 所有 7 种类型 post-duel 均不含白熊禁词', () => {
  const types = ['logical', 'aggressive', 'emotional', 'contrarian', 'cunning', 'cautious', 'steady'];
  const forbidden = ['不要', '禁止', '绝不能', '不能说'];
  for (const t of types) {
    const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams(t, true));
    const lensPart = result.match(/【你的(发言|领袖)风格】[^【]*/)?.[0] || '';
    for (const word of forbidden) {
      expect(lensPart, `${t} post-duel 含白熊禁词: ${word}`).not.toContain(word);
    }
  }
});

test('T18: knightHistoryStep (R86 三路径框架) 仍存在，回归验证', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('', false));
  expect(result).toContain('路径A（候选存活）');
  expect(result).toContain('路径B（候选已被投票出局）');
  expect(result).toContain('路径C（候选已被狼夜杀）');
});

test('T19: steady 类型 post-duel 包含"协调渐进型"', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(3), makeParams('steady', true));
  expect(result).toContain('协调渐进型');
});

test('T20: contrarian 类型 pre-duel 包含"反预判型"风格标记', () => {
  const result = getKnightDaySpeechPrompt(makeCtx(2), makeParams('contrarian', false));
  expect(result).toContain('反预判型');
});
