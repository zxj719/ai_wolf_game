/**
 * Round 16 tests
 * 验证以下三处改动：
 * 1. NIGHT_WOLF multiWolfHint — 加入白天角色分化提示（主动方/低调方）
 * 2. NIGHT_WOLF — identity_table 战略用途提示
 * 3. DAY_SPEECH '狼人' — identity_table 日间填写策略提示
 */
import { readFileSync } from 'fs';

const src = readFileSync('./src/services/aiPrompts.js', 'utf-8');

let passed = 0;
let failed = 0;

function test(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ── 定位 NIGHT_WOLF case 块 ────────────────────────────────────────────
// 用花括号形式 case 或直接查唯一注释锚点
const nightWolfIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF:');
const nightSeerIdx = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:');
if (nightWolfIdx === -1 || nightSeerIdx === -1) {
  console.error('❌ 无法定位 NIGHT_WOLF / NIGHT_SEER case');
  process.exit(1);
}
const nightWolfBlock = src.slice(nightWolfIdx, nightSeerIdx);

console.log('\n[T1-T4] NIGHT_WOLF multiWolfHint 角色分化一致性');
test('T1: multiWolfHint 包含"角色分化"关键词',
  nightWolfBlock.includes('白天角色分化'));
test('T2: multiWolfHint 包含"主动方"',
  nightWolfBlock.includes('主动方'));
test('T3: multiWolfHint 包含"低调方"',
  nightWolfBlock.includes('低调方'));
test('T4: multiWolfHint 包含"中立评委"或"装中立"',
  nightWolfBlock.includes('装中立'));

console.log('\n[T5-T8] NIGHT_WOLF identity_table 战略用途提示');
test('T5: 包含"identity_table 战略用途"标题',
  nightWolfBlock.includes('identity_table 战略用途'));
test('T6: 包含"高优先刀口"关键词',
  nightWolfBlock.includes('高优先刀口'));
test('T7: 包含"已知狼队友"分支',
  nightWolfBlock.includes('已知狼队友'));
test('T8: 包含"低威胁村民"分支',
  nightWolfBlock.includes('低威胁村民'));

// ── 定位 DAY_SPEECH 狼人 函数 ──────────────────────────────────────────
// 找到 ROLE_DAY_SPEECH_PROMPTS 后的 '狼人': 函数
const roleDaySpeechIdx = src.indexOf("const ROLE_DAY_SPEECH_PROMPTS = {");
const werewolfDayIdx = src.indexOf("'狼人': (ctx, params) => {", roleDaySpeechIdx);
const seerDayIdx = src.indexOf("'预言家': (ctx, params) => {", werewolfDayIdx);
if (werewolfDayIdx === -1 || seerDayIdx === -1) {
  console.error('❌ 无法定位 ROLE_DAY_SPEECH_PROMPTS 狼人/预言家 函数');
  process.exit(1);
}
const werewolfDayBlock = src.slice(werewolfDayIdx, seerDayIdx);

console.log('\n[T9-T12] DAY_SPEECH 狼人 identity_table 日间填写策略');
test('T9: 包含"identity_table 填写策略"标题',
  werewolfDayBlock.includes('identity_table 填写策略'));
test('T10: 包含"刀口候选"关键词（reason 中记录威胁）',
  werewolfDayBlock.includes('刀口候选'));
test('T11: 包含"不能直接填"狼人""的指令',
  werewolfDayBlock.includes('不能直接填'));
test('T12: 包含"维持公开叙事一致"说明',
  werewolfDayBlock.includes('维持公开叙事一致'));

// ── 验证构建一致性：多狼协作原有三条原则未被删除 ─────────────────────
console.log('\n[T13-T15] 原有多狼原则保留（回归）');
test('T13: 立场分散原则保留',
  nightWolfBlock.includes('立场分散') || werewolfDayBlock.includes('立场分散'));
test('T14: 投票错位原则保留',
  werewolfDayBlock.includes('投票错位'));
test('T15: 制造分歧感原则保留',
  werewolfDayBlock.includes('制造分歧感'));

// ── 验证单狼时 multiWolfHint 不误触发 ──────────────────────────────
console.log('\n[T16] 单狼模式不包含多狼提示（结构正确）');
test('T16: multiWolfHint 为条件三元表达式（含 "wolfTeammates.length > 0"）',
  nightWolfBlock.includes('wolfTeammates.length > 0'));

// ── 总结 ──────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`总计: ${passed + failed} 项  ✅ ${passed} 通过  ${failed > 0 ? '❌' : ''} ${failed} 失败`);
if (failed > 0) process.exit(1);
