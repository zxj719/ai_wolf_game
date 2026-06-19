/**
 * Round 12: SHERIFF_VOTE 增强测试
 * 验证：seer 查验候选人提示 / 角色专属策略 / identity_table schema / 判断框架
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// 找到 SHERIFF_VOTE case 块
const caseStart = src.indexOf("case PROMPT_ACTIONS.SHERIFF_VOTE:");
assert(caseStart > 0, 'cannot find SHERIFF_VOTE case');
// SHERIFF_BADGE_PASS 在 SHERIFF_VOTE 之后
const nextCasePos = src.indexOf("case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:", caseStart);
assert(nextCasePos > caseStart, 'cannot find next case');
const caseBlock = src.slice(caseStart, nextCasePos);

// ─── 结构检查 ───

test('T1: SHERIFF_VOTE case 块包含花括号作用域', () => {
  assert(caseBlock.includes('const svCandidates'), '缺少 svCandidates 声明');
});

test('T2: svCandidateSet 用 new Set 构建', () => {
  assert(caseBlock.includes('new Set(svCandidates.map(Number))'), '缺少 svCandidateSet');
});

test('T3: 从 gameState.seerChecks 提取查验', () => {
  assert(caseBlock.includes('gameState.seerChecks || []'), '没有访问 gameState.seerChecks');
});

// ─── 金水 / 查杀候选人 ───

test('T4: 金水候选人提示包含优先投票说明', () => {
  assert(caseBlock.includes('金水候选人'), '缺少金水候选人标记');
  assert(caseBlock.includes('最优投票对象'), '缺少最优投票对象说明');
});

test('T5: 查杀候选人提示包含强警告', () => {
  assert(caseBlock.includes('查杀候选人'), '缺少查杀候选人标记');
  assert(caseBlock.includes('绝对不能投'), '缺少绝对不能投警告');
  assert(caseBlock.includes('1.5'), '缺少1.5票说明');
});

test('T6: 金水过滤逻辑用 !c.isWolf', () => {
  assert(caseBlock.includes('!c.isWolf && svCandidateSet.has'), '金水过滤逻辑错误');
});

test('T7: 查杀过滤逻辑用 c.isWolf', () => {
  assert(caseBlock.includes('c.isWolf && svCandidateSet.has'), '查杀过滤逻辑错误');
});

// ─── 角色专属策略 ───

test('T8: 狼人专属策略包含队友投票指引', () => {
  assert(caseBlock.includes("playerRole === '狼人'"), '缺少狼人角色判断');
  assert(caseBlock.includes('狼人策略'), '缺少狼人策略标记');
  assert(caseBlock.includes('队友'), '缺少队友说明');
});

test('T9: 预言家专属策略包含警徽杠杆说明', () => {
  assert(caseBlock.includes("playerRole === '预言家'"), '缺少预言家角色判断');
  assert(caseBlock.includes('预言家策略'), '缺少预言家策略标记');
  assert(caseBlock.includes('报验'), '缺少报验说明');
});

test('T10: 神职专属策略包含隐藏身份说明', () => {
  assert(caseBlock.includes("playerRole === '女巫'"), '缺少女巫分支');
  assert(caseBlock.includes('神职策略'), '缺少神职策略标记');
});

// ─── 输出 Schema ───

test('T11: 输出 schema 包含 targetId', () => {
  const schemaIdx = caseBlock.indexOf('输出JSON:');
  assert(schemaIdx > 0, '缺少输出JSON');
  const schemaStr = caseBlock.slice(schemaIdx, schemaIdx + 300);
  assert(schemaStr.includes('"targetId"'), '缺少 targetId 字段');
});

test('T12: 输出 schema 包含 reasoning', () => {
  const schemaIdx = caseBlock.indexOf('输出JSON:');
  const schemaStr = caseBlock.slice(schemaIdx, schemaIdx + 300);
  assert(schemaStr.includes('"reasoning"'), '缺少 reasoning 字段');
});

test('T13: 输出 schema 包含 thought', () => {
  const schemaIdx = caseBlock.indexOf('输出JSON:');
  const schemaStr = caseBlock.slice(schemaIdx, schemaIdx + 300);
  assert(schemaStr.includes('"thought"'), '缺少 thought 字段');
});

test('T14: 输出 schema 包含 identity_table（与 DAY_VOTE 一致）', () => {
  const schemaIdx = caseBlock.indexOf('输出JSON:');
  const schemaStr = caseBlock.slice(schemaIdx, schemaIdx + 400);
  assert(schemaStr.includes('"identity_table"'), '缺少 identity_table 字段');
});

// ─── 判断框架 ───

test('T15: 判断框架包含预言家查验优先', () => {
  assert(caseBlock.includes('预言家查验优先'), '缺少查验优先说明');
});

test('T16: 判断框架包含竞选发言质量', () => {
  assert(caseBlock.includes('竞选发言质量'), '缺少发言质量说明');
});

test('T17: 判断框架包含弃票合理性说明', () => {
  assert(caseBlock.includes('弃票'), '缺少弃票说明');
  assert(caseBlock.includes('-1'), '缺少-1表示弃票说明');
});

test('T18: 判断框架包含警徽流方案评估', () => {
  assert(caseBlock.includes('警徽流'), '缺少警徽流说明');
});

// ─── 回归测试：SHERIFF_BADGE_PASS 未被破坏 ───

test('T19: SHERIFF_BADGE_PASS case 依然存在', () => {
  const badgeCase = src.indexOf("case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:");
  assert(badgeCase > 0, 'SHERIFF_BADGE_PASS case 丢失');
});

test('T20: SHERIFF_BADGE_PASS 的 goldWaterTargets 逻辑未受影响', () => {
  const badgeStart = src.indexOf("case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:");
  const badgeBlock = src.slice(badgeStart, badgeStart + 1500);
  assert(badgeBlock.includes('goldWaterTargets'), 'BADGE_PASS goldWaterTargets 丢失');
  assert(badgeBlock.includes('killedTargets'), 'BADGE_PASS killedTargets 丢失');
});

// ─── 回归：DAY_VOTE case 未受影响 ───

test('T21: DAY_VOTE case 仍有 pkMode 场景提示', () => {
  // 搜索带花括号的版本（generateUserPrompt 内的真实 case，而非 getCOTTemplate 里的 case）
  const dvCaseStart = src.indexOf("case PROMPT_ACTIONS.DAY_VOTE: {");
  assert(dvCaseStart > 0, '找不到 DAY_VOTE { 块');
  const nextDvCase = src.indexOf('case PROMPT_ACTIONS.', dvCaseStart + 10);
  const dvBlock = src.slice(dvCaseStart, nextDvCase);
  assert(dvBlock.includes('pkMode'), 'DAY_VOTE pkMode 丢失');
  assert(dvBlock.includes('isLateGame'), 'DAY_VOTE isLateGame 丢失');
});

// ─── 数据流检查：svGoldWater filter 正确引用 svSeerChecks ───

test('T22: svGoldWater / svSlaughter 使用正确变量名 svSeerChecks', () => {
  assert(caseBlock.includes('svSeerChecks.filter(c => !c.isWolf'), 'svGoldWater filter 错误');
  assert(caseBlock.includes('svSeerChecks.filter(c => c.isWolf'), 'svSlaughter filter 错误');
});

// ─── 候选人显示 ───

test('T23: 候选人列表包含在输出文本中', () => {
  assert(caseBlock.includes('svCandidates.join'), '候选人 join 展示缺失');
});

console.log(`\n总计：${passed + failed}，通过：${passed}，失败：${failed}`);
if (failed > 0) process.exit(1);
