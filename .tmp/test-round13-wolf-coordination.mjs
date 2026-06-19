/**
 * Round 13 — 多狼协作测试
 * 验证：① 首狼正确调用 AI ② 后续狼跳过 AI 调用 ③ 提示词包含决策人角色
 */
import { readFileSync } from 'fs';

const nightFlowSrc = readFileSync('src/hooks/useNightFlow.js', 'utf8');
const aiPromptsSrc = readFileSync('src/services/aiPrompts.js', 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}

// == T1-T5: useNightFlow.js 多狼协作机制 ==
console.log('\n[T1-T5] useNightFlow.js 多狼协作机制');

test('T1: 新增 wolfTarget !== null 的早退出检查', () => {
  assert(nightFlowSrc.includes('nightDecisions.wolfTarget !== null'), '应检查 wolfTarget 是否已设');
});

test('T2: 早退出时记录 recordNightAction 确认行为', () => {
  assert(nightFlowSrc.includes("type: '确认'"), '确认行为应记录 type 确认');
});

test('T3: 早退出时 addLog 显示统一刀口信息', () => {
  assert(nightFlowSrc.includes('与队友统一刀口'), 'log 应说明统一刀口');
});

test('T4: 早退出分支不调用 askAI（不能在 wolfTarget 检查块内调用 askAI）', () => {
  // 用注释定位 AI 狼新增块（排除 line 332 用户狼检查中也存在的同字符串）
  const commentAnchor = nightFlowSrc.indexOf('// 多狼协作：首狼决策后，后续狼直接确认');
  assert(commentAnchor !== -1, '应有多狼协作注释');
  const checkStart = nightFlowSrc.indexOf('nightDecisions.wolfTarget !== null', commentAnchor);
  const elsePos = nightFlowSrc.indexOf('} else {', checkStart);
  const innerBlock = nightFlowSrc.slice(checkStart, elsePos);
  assert(!innerBlock.includes('askAI'), '早退出块不应调用 askAI');
});

test('T5: else 分支正确调用 askAI（原有逻辑不变）', () => {
  const elseStart = nightFlowSrc.indexOf('} else {\n\n        const res = await askAI');
  assert(elseStart !== -1, 'else 分支应包含 askAI 调用');
});

// == T6-T9: aiPrompts.js 首狼决策人提示词 ==
console.log('\n[T6-T9] aiPrompts.js 首狼提示词增强');

test('T6: 多狼提示包含"决策人"角色说明', () => {
  assert(aiPromptsSrc.includes('刀口决策人'), '应告知首狼它是本晚刀口决策人');
});

test('T7: 多狼提示包含"全队行动目标"说明', () => {
  assert(aiPromptsSrc.includes('全队行动目标'), '应说明首狼决定是全队行动');
});

test('T8: 多狼提示包含"期望价值"评估维度', () => {
  assert(aiPromptsSrc.includes('期望价值'), '应包含目标期望价值维度');
});

test('T9: 多狼提示包含"发言立场"分散指导', () => {
  assert(aiPromptsSrc.includes('分散发言立场') || aiPromptsSrc.includes('各狼须分散'), '应包含白天立场分散指导');
});

// == T10-T12: 回归测试：原有 NIGHT_WOLF 结构完整 ==
console.log('\n[T10-T12] 回归：NIGHT_WOLF 核心结构完整');

test('T10: NIGHT_WOLF 仍包含不能空刀规则', () => {
  assert(aiPromptsSrc.includes('不能空刀'), '空刀规则不能丢失');
});

test('T11: NIGHT_WOLF 仍包含 identity_table 输出', () => {
  const nwStart = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF:');
  const nwEnd = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:', nwStart);
  const nwBlock = aiPromptsSrc.slice(nwStart, nwEnd);
  assert(nwBlock.includes('identity_table'), 'NIGHT_WOLF 输出 schema 应有 identity_table');
});

test('T12: useNightFlow.js 中 WEREWOLF 块结构完整（不多不少一个 else if）', () => {
  const werewolfStart = nightFlowSrc.indexOf("else if (currentRoleKey === 'WEREWOLF') {");
  const nextRole = nightFlowSrc.indexOf("else if (currentRoleKey === 'SEER')", werewolfStart);
  // 验证 WEREWOLF 块内有 wolfTarget 检查 + else + askAI
  const block = nightFlowSrc.slice(werewolfStart, nextRole);
  assert(block.includes('wolfTarget !== null'), '块内应有 wolfTarget 检查');
  assert(block.includes('} else {'), '块内应有 else 分支');
  assert(block.includes('askAI'), '块内应有 askAI 调用');
  // 检查括号平衡
  const opens = (block.match(/\{/g) || []).length;
  const closes = (block.match(/\}/g) || []).length;
  // 第一个 { 和最后一个 } 属于外层 else if，内部应平衡
  assert(opens === closes, `括号不平衡 opens=${opens} closes=${closes}`);
});

console.log(`\n==== 结果：${passed} 通过 / ${failed} 失败 ====\n`);
if (failed > 0) process.exit(1);
