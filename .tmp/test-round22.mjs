/**
 * Round 22 Test Suite
 * 验证：
 * 1. NIGHT_MAGICIAN hasRevealed → 优先级 C 提升为 A
 * 2. Knight 终局阈值：aliveCount≤5 时 A=50%/B=40%，否则 A=70%/B=60%
 * 3. aiPrompts.js NIGHT_MAGICIAN case 现在传入 hasRevealed
 * 4. aiPrompts.js DAY_SPEECH roleParams 现在包含 aliveCount
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve('/home/user/ai_wolf_game/src');
const magicianSrc = readFileSync(`${root}/services/rolePrompts/magician.js`, 'utf8');
const knightSrc = readFileSync(`${root}/services/rolePrompts/knight.js`, 'utf8');
const aiPromptsSrc = readFileSync(`${root}/services/aiPrompts.js`, 'utf8');

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
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ─── T1-T6: magician.js hasRevealed 分支 ───────────────────────────────────

console.log('\n【T1-T6】magician.js hasRevealed 分支验证');

test('T1: getMagicianNightActionPrompt 解构了 hasRevealed', () => {
  assert(magicianSrc.includes('hasRevealed,'), '必须解构 hasRevealed');
});

test('T2: 存在 if (hasRevealed) 分支', () => {
  assert(magicianSrc.includes('if (hasRevealed)'), '必须有 if (hasRevealed) 分支');
});

test('T3: hasRevealed=true 时 优先级A 提及自保', () => {
  const idx = magicianSrc.indexOf('if (hasRevealed)');
  const segment = magicianSrc.slice(idx, idx + 1500);
  assert(segment.includes('优先级A（自保躲刀'), '身份已公开时优先级A应为自保');
});

test('T4: hasRevealed=true 时警告狼人可能刀你', () => {
  const idx = magicianSrc.indexOf('if (hasRevealed)');
  const segment = magicianSrc.slice(idx, idx + 500);
  assert(segment.includes('首选刀口'), '应警告身份暴露后成为刀口目标');
});

test('T5: hasRevealed=false 时维持原始 优先级A 保核', () => {
  const idx = magicianSrc.indexOf('} else {');
  assert(idx > 0, 'else 分支必须存在');
  const segment = magicianSrc.slice(idx, idx + 1000);
  assert(segment.includes('优先级A（保核）'), '未暴露时原始优先级A应为保核');
});

test('T6: hasRevealed=false 时维持原始 优先级C 自保', () => {
  const idx = magicianSrc.indexOf('} else {');
  const segment = magicianSrc.slice(idx, idx + 1200);
  assert(segment.includes('优先级C（自保）'), '未暴露时优先级C应为自保（低优先级）');
});

// ─── T7-T12: knight.js 终局阈值 ─────────────────────────────────────────────

console.log('\n【T7-T12】knight.js 终局阈值验证');

test('T7: getKnightDaySpeechPrompt 解构了 aliveCount', () => {
  assert(knightSrc.includes('aliveCount } = params'), '必须解构 aliveCount');
});

test('T8: isEndgame = aliveCount && aliveCount <= 5', () => {
  assert(knightSrc.includes('aliveCount <= 5'), '终局条件必须是 ≤5');
});

test('T9: 终局时 thresholdA = 50%', () => {
  assert(knightSrc.includes("? '50%' : '70%'"), 'thresholdA 终局应为 50%');
});

test('T10: 终局时 thresholdB = 40%', () => {
  assert(knightSrc.includes("? '40%' : '60%'"), 'thresholdB 终局应为 40%');
});

test('T11: 提示词使用 ${thresholdA} 和 ${thresholdB} 动态插值', () => {
  assert(knightSrc.includes('${thresholdA}'), 'prompt 必须包含 ${thresholdA}');
  assert(knightSrc.includes('${thresholdB}'), 'prompt 必须包含 ${thresholdB}');
});

test('T12: endgameNote 包含 终局紧急模式 字样', () => {
  assert(knightSrc.includes('终局紧急模式'), '必须有终局紧急模式说明');
});

// ─── T13-T16: aiPrompts.js 调用端参数验证 ───────────────────────────────────

console.log('\n【T13-T16】aiPrompts.js 调用端参数验证');

test('T13: NIGHT_MAGICIAN case 传入 hasRevealed', () => {
  // 使用 1500 char 窗口（hasRevealed 在 case 开始 ~1281 处）
  const caseIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.NIGHT_MAGICIAN:");
  assert(caseIdx > 0, 'NIGHT_MAGICIAN case 必须存在');
  const segment = aiPromptsSrc.slice(caseIdx, caseIdx + 1500);
  assert(segment.includes('hasRevealed: currentPlayer?.hasRevealed'), 'NIGHT_MAGICIAN 必须传入 hasRevealed');
});

test('T14: NIGHT_MAGICIAN hasRevealed 注释说明优先级调整', () => {
  const caseIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.NIGHT_MAGICIAN:");
  const segment = aiPromptsSrc.slice(caseIdx, caseIdx + 1500);
  assert(segment.includes('优先级 C 提升为 A'), 'hasRevealed 传参注释应说明优先级调整');
});

test('T15: DAY_SPEECH roleParams 包含 aliveCount (R12教训：跳过getCOTTemplate的假case)', () => {
  // getCOTTemplate 里也有 case PROMPT_ACTIONS.DAY_SPEECH:（line 321）
  // 真实 generateUserPrompt 的 DAY_SPEECH case 在更后面，用 lastIndexOf 定位
  const daySpeechIdx = aiPromptsSrc.lastIndexOf("case PROMPT_ACTIONS.DAY_SPEECH:");
  assert(daySpeechIdx > 0, 'generateUserPrompt 的 DAY_SPEECH case 必须存在');
  const segment = aiPromptsSrc.slice(daySpeechIdx, daySpeechIdx + 2000);
  assert(segment.includes('aliveCount: players.filter'), 'roleParams 必须包含 aliveCount');
});

test('T16: aliveCount 注释说明用途为骑士终局阈值', () => {
  const daySpeechIdx = aiPromptsSrc.lastIndexOf("case PROMPT_ACTIONS.DAY_SPEECH:");
  const segment = aiPromptsSrc.slice(daySpeechIdx, daySpeechIdx + 2000);
  assert(segment.includes('骑士终局'), 'aliveCount 的注释应说明骑士用途');
});

// ─── T17-T20: 回归测试（前轮改动无影响） ──────────────────────────────────

console.log('\n【T17-T20】回归测试');

test('T17: magician.js nightAction 函数仍被 MAGICIAN_PROMPTS 导出', () => {
  assert(magicianSrc.includes('nightAction: getMagicianNightActionPrompt'), '导出必须存在');
});

test('T18: knight.js KNIGHT_PROMPTS.daySpeech 仍存在', () => {
  assert(knightSrc.includes('daySpeech: getKnightDaySpeechPrompt'), 'daySpeech 导出必须存在');
});

test('T19: magician.js hasRevealed 分支中不存在裸变量插值（R18教训）', () => {
  // 确认 if (hasRevealed) 分支内没有 ${hasRevealed} 这类裸插值（应用常量文字替代）
  const idx = magicianSrc.indexOf('if (hasRevealed)');
  const segment = magicianSrc.slice(idx, idx + 1500);
  // template strings inside push() strings shouldn't have ${hasRevealed}
  const hasBareInterp = segment.includes('${hasRevealed}');
  assert(!hasBareInterp, '分支中不应有 ${hasRevealed} 裸插值（用常量文字）');
});

test('T20: knight.js isEndgame 变量在 return 模板前定义（不裸插 aliveCount<=5）', () => {
  // 使用 getBaseContext 锚定真正的 return（R12教训：first return\` 是别的函数）
  const isEndgIdx = knightSrc.indexOf('const isEndgame');
  const returnTemplateIdx = knightSrc.indexOf('return `${getBaseContext');
  assert(isEndgIdx > 0, 'const isEndgame 必须存在');
  assert(returnTemplateIdx > 0, 'return `${getBaseContext 必须存在');
  assert(isEndgIdx < returnTemplateIdx, 'isEndgame 必须在 return 模板之前定义');
});

// ─── T21-T23: 边界条件验证 ──────────────────────────────────────────────────

console.log('\n【T21-T23】边界条件验证');

test('T21: knight endgame note 包含动态 aliveCount 插值', () => {
  // 确认 endgameNote 使用 ${aliveCount} 显示实际人数
  assert(knightSrc.includes('${aliveCount}人存活'), 'endgameNote 应展示实际存活人数');
});

test('T22: magician hasRevealed=false 分支结束有 existingRoles.hasWitch 高级操作', () => {
  // 高级操作（女巫毒药重定向）在两个分支之外，在所有 push 完成后
  assert(magicianSrc.includes('重定向女巫的毒药'), '女巫高级操作提示应保留');
});

test('T23: aiPrompts.js NIGHT_MAGICIAN case 末尾不遗漏旧参数', () => {
  const caseIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.NIGHT_MAGICIAN:");
  // 使用 1500 char 窗口以覆盖整个 case（~1369 chars）
  const segment = aiPromptsSrc.slice(caseIdx, caseIdx + 1500);
  // 确认原有参数仍在
  assert(segment.includes('validTargets: validSwapTargets'), 'validTargets 参数必须保留');
  assert(segment.includes('dayCount: ctx.dayCount'), 'dayCount 参数必须保留');
  assert(segment.includes('suspectedWolves'), 'suspectedWolves 参数必须保留');
});

// ─── 汇总 ────────────────────────────────────────────────────────────────────

console.log(`\n─────────────────────────────────────`);
console.log(`总计: ${passed + failed} 项测试`);
console.log(`通过: ${passed} ✅  失败: ${failed} ❌`);
if (failed > 0) process.exit(1);
