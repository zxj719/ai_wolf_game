/**
 * Round 93: 骑士领袖历史读取（Step0 ④）— DAY→DAY 闭环补完
 *
 * 验证：
 * - knightLeaderReadHint 变量声明及条件控制（hasUsedDuel && dayCount > 1）
 * - 激活时包含"④ 读取上轮领袖指令"与三路径（集火型/调查型/保护型）
 * - D${ctx.dayCount - 1}领袖指令 动态 prevDay 插值正确
 * - knightHistoryStep 中包含 ${knightLeaderReadHint} 插值
 * - hasUsedDuel=false 或 dayCount=1 时不激活（向下兼容）
 * - ④ 出现在 Step0.5 之前（生成顺序正确）
 * - 白熊效应合规（全正向描述，无"不要""禁止"等负向禁词）
 */
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect } from 'vitest';
import { getKnightDaySpeechPrompt } from '../rolePrompts/knight.js';

const src = readFileSync(
  path.resolve('src/services/rolePrompts/knight.js'),
  'utf-8'
);

// 定位 knightLeaderReadHint 变量声明区
const hintIdx = src.indexOf('const knightLeaderReadHint');
const histIdx = src.indexOf('const knightHistoryStep');
const hintBlock = src.slice(hintIdx, histIdx);

// 定位 knightHistoryStep 变量声明区
const duelStatusIdx = src.indexOf('const duelStatus');
const histBlock = src.slice(histIdx, duelStatusIdx);

// 公共 context / params 构造器
const makeCtx = (dayCount = 2) => ({
  dayCount,
  alivePlayersInfo: '2号、3号、4号、5号、6号存活',
  deathLog: '',
  voteInfo: `D${dayCount - 1}: 7号(3票)出局`,
  lastNightInfo: '',
  seerChecks: [],
  fullGameTimeline: `N1:3号死亡 → D1:7号出局`,
});

const makeParams = (hasUsedDuel = false, personalityType = '') => ({
  hasUsedDuel,
  aliveCount: 7,
  personalityType,
});

// ─── T1-T5: 变量声明存在性与结构 ───

test('T1: knightLeaderReadHint 变量在 knight.js 函数体内声明', () => {
  expect(src).toContain('const knightLeaderReadHint');
});

test('T2: knightLeaderReadHint 受 hasUsedDuel && ctx.dayCount > 1 条件控制', () => {
  expect(hintBlock).toContain('hasUsedDuel && ctx.dayCount > 1');
});

test('T3: knightLeaderReadHint 激活分支含动态 prevDay 插值（D${ctx.dayCount - 1}领袖指令）', () => {
  // 使用字符串而非模板语法，因为我们检查源码文本
  expect(hintBlock).toContain('ctx.dayCount - 1}领袖指令');
});

test('T4: knightLeaderReadHint 非激活分支为空字符串（向下兼容）', () => {
  expect(hintBlock).toContain(": '';");
});

test('T5: knightHistoryStep 中包含 ${knightLeaderReadHint} 插值', () => {
  expect(histBlock).toContain('${knightLeaderReadHint}');
});

// ─── T6-T10: knightLeaderReadHint 内容验证 ───

test('T6: 激活分支包含"④ 读取上轮领袖指令"标题', () => {
  expect(hintBlock).toContain('④ 读取上轮领袖指令');
});

test('T7: 激活分支包含路径A（上轮集火型）', () => {
  expect(hintBlock).toContain('路径A（上轮集火型）');
});

test('T8: 激活分支包含路径B（上轮调查型）', () => {
  expect(hintBlock).toContain('路径B（上轮调查型）');
});

test('T9: 激活分支包含路径C（上轮保护型）', () => {
  expect(hintBlock).toContain('路径C（上轮保护型）');
});

test('T10: 激活分支包含在 thought 中明确战略切换决策的指导', () => {
  expect(hintBlock).toContain('在 thought 中明确今日沿用上轮战略还是切换');
});

// ─── T11-T15: 函数调用集成验证（激活条件） ───

test('T11: hasUsedDuel=false 时输出不含"④ 读取上轮领袖指令"', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(false));
  expect(output).not.toContain('④ 读取上轮领袖指令');
});

test('T12: hasUsedDuel=true && dayCount=1 时输出不含"④ 读取上轮领袖指令"', () => {
  // dayCount=1 → knightHistoryStep 进入 D1 fallback 分支，hint 不激活
  const output = getKnightDaySpeechPrompt(makeCtx(1), makeParams(true));
  expect(output).not.toContain('④ 读取上轮领袖指令');
});

test('T13: hasUsedDuel=true && dayCount=2 时输出含"④ 读取上轮领袖指令"', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('④ 读取上轮领袖指令');
});

test('T14: dayCount=2 时输出含"D1领袖指令"（ctx.dayCount - 1 = 1）', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('D1领袖指令');
});

test('T15: dayCount=3 时输出含"D2领袖指令"（ctx.dayCount - 1 = 2）', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(3), makeParams(true));
  expect(output).toContain('D2领袖指令');
});

// ─── T16-T18: 三路径内容集成验证 ───

test('T16: 激活时输出含"路径A（上轮集火型）"', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('路径A（上轮集火型）');
});

test('T17: 激活时输出含"路径B（上轮调查型）"', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('路径B（上轮调查型）');
});

test('T18: 激活时输出含"路径C（上轮保护型）"', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('路径C（上轮保护型）');
});

// ─── T19: 顺序验证（④ 在 Step0.5 之前）───

test('T19: 激活时"④ 读取上轮领袖指令"出现在"Step0.5:"之前', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  const pos4 = output.indexOf('④ 读取上轮领袖指令');
  const pos05 = output.indexOf('Step0.5:');
  expect(pos4).toBeGreaterThan(-1);
  expect(pos05).toBeGreaterThan(-1);
  expect(pos4).toBeLessThan(pos05);
});

// ─── T20: 白熊效应合规（全正向描述）───

test('T20: knightLeaderReadHint 激活分支无"不要""禁止""绝不能"等负向禁词', () => {
  // 激活分支是从 ? ` 到 \n` 之间的内容
  const activeStart = hintBlock.indexOf('? `');
  const activeEnd = hintBlock.indexOf(": '';");
  const activeContent = hintBlock.slice(activeStart, activeEnd);
  expect(activeContent).not.toContain('不要');
  expect(activeContent).not.toContain('禁止');
  expect(activeContent).not.toContain('绝不能');
  // 正向行动词校验
  expect(activeContent).toContain('今日继续集票带节奏');
  expect(activeContent).toContain('整合进今日战略选择');
});
