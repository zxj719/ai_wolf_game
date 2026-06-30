/**
 * Round 89: 骑士领袖期专属 Step0.5（post-duel 全场引导规划）
 *
 * 验证：
 * - knightLeaderStep 变量仅在 hasUsedDuel=true 时非空
 * - Step0.5 包含：决斗出局条目读取 / 连锁逻辑 / 三选一战略框架 / identity_table 追加指导
 * - return 模板中 ${knightLeaderStep} 在 ${knightHistoryStep} 之后、Step1 之前
 * - identity_table 写指导包含领袖期追加格式
 * - 白熊效应合规（全正向描述）
 *
 * 已知模式（R86/R87）：
 * - 测试源码内容用 readFileSync + indexOf 定位 landmark
 * - 函数级生成输出用 getKnightDaySpeechPrompt 调用验证
 */
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect } from 'vitest';
import { getKnightDaySpeechPrompt } from '../rolePrompts/knight.js';

const src = readFileSync(
  path.resolve('src/services/rolePrompts/knight.js'),
  'utf-8'
);

// 定位 knightLeaderStep 变量声明区
const leaderIdx = src.indexOf('const knightLeaderStep');
const leaderEnd = src.indexOf('  return `${getBaseContext(ctx)}', leaderIdx);
const leaderBlock = src.slice(leaderIdx, leaderEnd);

// 定位 return 模板区
const returnIdx = src.indexOf('return `${getBaseContext(ctx)}');
const returnEnd = src.indexOf('getKnightDuelPrompt', returnIdx);
const returnBlock = src.slice(returnIdx, returnEnd);

// 定位 identity_table 写指导区
const idTableIdx = src.indexOf('identity_table 填写指导');
const idTableEnd = src.indexOf('输出JSON:', idTableIdx);
const idTableBlock = src.slice(idTableIdx, idTableEnd);

// 公共 context / params 构造器
const makeCtx = (dayCount = 2) => ({
  dayCount,
  alivePlayersInfo: '2号、3号、4号、5号、6号存活',
  deathLog: '',
  voteInfo: 'D1: 2号(3票)出局',
  lastNightInfo: '',
  seerChecks: [],
  fullGameTimeline: 'N1:3号死亡 → D1:2号出局',
});

const makeParams = (hasUsedDuel = false, personalityType = '') => ({
  hasUsedDuel,
  aliveCount: 7,
  personalityType,
});

// ─── T1-T5: 变量声明存在性 ───

test('T1: knightLeaderStep 变量在函数体内声明', () => {
  expect(src).toContain('const knightLeaderStep');
});

test('T2: knightLeaderStep 由 hasUsedDuel 条件控制（三元表达式）', () => {
  expect(leaderBlock).toContain('hasUsedDuel');
  expect(leaderBlock).toContain("? `Step0.5:");
});

test('T3: knightLeaderStep 的非激活分支为空字符串（向下兼容）', () => {
  expect(leaderBlock).toContain(": '';");
});

test('T4: return 模板中 ${knightLeaderStep} 出现在 ${knightHistoryStep} 之后', () => {
  const histPos = returnBlock.indexOf('${knightHistoryStep}');
  const leaderPos = returnBlock.indexOf('${knightLeaderStep}');
  expect(histPos).toBeGreaterThan(-1);
  expect(leaderPos).toBeGreaterThan(-1);
  expect(leaderPos).toBeGreaterThan(histPos);
});

test('T5: return 模板中 ${knightLeaderStep} 出现在 Step1 之前', () => {
  const leaderPos = returnBlock.indexOf('${knightLeaderStep}');
  const step1Pos = returnBlock.indexOf('Step1: 场上局势分析');
  expect(leaderPos).toBeGreaterThan(-1);
  expect(step1Pos).toBeGreaterThan(-1);
  expect(leaderPos).toBeLessThan(step1Pos);
});

// ─── T6-T10: knightLeaderStep 内容验证 ───

test('T6: Step0.5 包含"已决斗出局"读取指导', () => {
  expect(leaderBlock).toContain('已决斗出局');
});

test('T7: Step0.5 包含金水玩家 confidence 下调指导（40-50）', () => {
  expect(leaderBlock).toContain('40-50');
  expect(leaderBlock).toContain('金水');
});

test('T8: Step0.5 包含与被决斗狼人同立场玩家的 confidence 下调指导（15-25）', () => {
  expect(leaderBlock).toContain('15-25');
  expect(leaderBlock).toContain('confidence 下调');
});

test('T9: Step0.5 包含三选一战略框架（集火型 + 调查型 + 保护型）', () => {
  expect(leaderBlock).toContain('战略A');
  expect(leaderBlock).toContain('集火型');
  expect(leaderBlock).toContain('战略B');
  expect(leaderBlock).toContain('调查型');
  expect(leaderBlock).toContain('战略C');
  expect(leaderBlock).toContain('保护型');
});

test('T10: Step0.5 包含 identity_table 追加领袖指令的指导', () => {
  expect(leaderBlock).toContain('领袖指令');
  expect(leaderBlock).toContain('战略A/B/C');
});

// ─── T11-T15: 函数调用集成验证 ───

test('T11: hasUsedDuel=false 时输出不含 Step0.5: 思维链块（带冒号区分 id_table 提及）', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(false));
  // "Step0.5:" 带冒号只在 knightLeaderStep 块头；id_table guidance 中为 "Step0.5 执行后"（无冒号）
  expect(output).not.toContain('Step0.5:');
});

test('T12: hasUsedDuel=true 时输出含 Step0.5: 领袖期战略规划', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('Step0.5:');
  expect(output).toContain('领袖期战略规划');
});

test('T13: hasUsedDuel=true 时输出含三选一战略A/B/C', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('战略A');
  expect(output).toContain('战略B');
  expect(output).toContain('战略C');
});

test('T14: hasUsedDuel=true dayCount=3 时输出含 D3领袖指令', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(3), makeParams(true));
  expect(output).toContain('D3领袖指令');
});

test('T15: hasUsedDuel=true 时输出含"领袖公信力"文本', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  expect(output).toContain('领袖公信力');
});

// ─── T16-T18: identity_table 写指导 ───

test('T16: identity_table 写指导包含"领袖期核心目标"条目', () => {
  expect(idTableBlock).toContain('领袖期核心目标');
});

test('T17: identity_table 写指导保留"追加不覆盖历史"', () => {
  expect(idTableBlock).toContain('追加不覆盖历史');
});

test('T18: identity_table 领袖期写指导包含战略A/B/C 格式', () => {
  expect(idTableBlock).toContain('战略A/B/C');
});

// ─── T19-T20: 白熊效应合规（全正向描述）───

test('T19: knightLeaderStep 内容无"不要""禁止""绝不能"等负向禁词', () => {
  // leaderBlock 是 const 声明区，检查正向描述合规
  expect(leaderBlock).not.toContain('不要');
  expect(leaderBlock).not.toContain('绝不能');
  // "禁止决斗" 在 identity_table guidance 而非 leaderBlock
  const negTerms = ['不要传达', '不要说', '禁止发言', '禁止提及'];
  negTerms.forEach(t => expect(leaderBlock).not.toContain(t));
});

test('T20: hasUsedDuel=true 生成结果正向描述：可通过"领袖公信力"等关键词确认', () => {
  const output = getKnightDaySpeechPrompt(makeCtx(2), makeParams(true));
  // Step0.5 部分应当有正向行动词
  expect(output).toContain('实证锚点');
  expect(output).toContain('交叉验证');
  expect(output).toContain('确保神职安全');
});
