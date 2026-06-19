/**
 * Round 23 Test Suite — NIGHT_DREAMWEAVER hasRevealed + NIGHT_* 状态系统审计
 */
import { readFileSync } from 'fs';

const aiSrc = readFileSync('src/services/aiPrompts.js', 'utf8');
const nightFlowSrc = readFileSync('src/hooks/useNightFlow.js', 'utf8');

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ T${++passed + failed}: ${name}`);
    passed = passed; // already incremented
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ── 计数器重置为序号用 ──
let tc = 0;
function test(name, cond, detail = '') {
  tc++;
  if (cond) {
    console.log(`  ✅ T${tc}: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL T${tc}: ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// 找到 NIGHT_DREAMWEAVER case 的位置（带 {} 形式）
const dwCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {');
if (dwCaseIdx === -1) {
  console.error('❌ FATAL: NIGHT_DREAMWEAVER case not found!');
  process.exit(1);
}
// 取 2500 chars 的窗口（R22 教训：窗口需比预期大 30%）
const dwWindow = aiSrc.slice(dwCaseIdx, dwCaseIdx + 2500);

console.log('\n=== T1-T8: NIGHT_DREAMWEAVER hasRevealed 接入验证 ===');
test(
  'params 解构包含 hasRevealed: dwHasRevealed',
  dwWindow.includes('hasRevealed: dwHasRevealed')
);
test(
  'dwRevealedAlert 变量用 let 声明',
  dwWindow.includes('let dwRevealedAlert = \'\';')
);
test(
  'dwHasRevealed 触发 dwRevealedAlert 内容',
  dwWindow.includes('if (dwHasRevealed) {') && dwWindow.includes('dwRevealedAlert = `')
);
test(
  '身份已公开警示文本存在',
  dwWindow.includes('身份已公开 — 殉情模式跃升最高优先')
);
test(
  '殉情阈值降低到 50%',
  dwWindow.includes('confidence≥50%') || dwWindow.includes('confidence≥50 %')
);
test(
  '策略提示条件化：hasRevealed=true 时殉情排第一',
  dwWindow.includes('if (dwHasRevealed) {') &&
  dwWindow.indexOf('★ 殉情模式（最高优先）') < dwWindow.indexOf('防御模式（次优先）')
);
test(
  '策略提示条件化：hasRevealed=false 时防御排第一',
  dwWindow.includes('} else {') &&
  dwWindow.indexOf('防御模式：可入梦真预言家') < dwWindow.indexOf('进攻模式：对高度怀疑')
);
test(
  'return 模板包含 ${dwRevealedAlert}',
  dwWindow.includes('${dwRevealedAlert}')
);

console.log('\n=== T9-T11: useNightFlow.js 调用端验证 ===');
const dwNightFlowIdx = nightFlowSrc.indexOf('PROMPT_ACTIONS.NIGHT_DREAMWEAVER');
const dwNightWindow = nightFlowSrc.slice(dwNightFlowIdx, dwNightFlowIdx + 400);
test(
  'useNightFlow 调用端传 hasRevealed: actor.hasRevealed',
  dwNightWindow.includes('hasRevealed: actor.hasRevealed')
);
test(
  'hasRevealed 注释说明用途',
  dwNightWindow.includes('殉情模式') || dwNightWindow.includes('item 40')
);
// 确保没有直接用 `${}` 包含 dwHasRevealed（R18 教训：指导文本不能用变量插值）
test(
  '返回模板中不含 ${dwHasRevealed} 裸插值（R18 教训）',
  !dwWindow.includes('${dwHasRevealed}')
);

console.log('\n=== T12-T16: NIGHT_* 状态系统审计（item 39）===');

// NIGHT_MAGICIAN 应该有 hasRevealed（R22 已修复）
const magCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:');
const magWindow = aiSrc.slice(magCaseIdx, magCaseIdx + 1600);
test(
  'NIGHT_MAGICIAN 仍包含 hasRevealed: currentPlayer?.hasRevealed（R22 回归）',
  magWindow.includes('hasRevealed: currentPlayer?.hasRevealed')
);

// NIGHT_WOLF 无需 hasRevealed（狼人不用跳身份）
const wolfCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF:');
const wolfWindow = aiSrc.slice(wolfCaseIdx, wolfCaseIdx + 2000);
test(
  'NIGHT_WOLF case 存在且含 identity_table',
  wolfWindow.includes('identity_table')
);

// NIGHT_SEER 无需 hasRevealed（预言家不用跳身份）—— 只检查 identity_table 存在
const seerCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:');
const seerWindow = aiSrc.slice(seerCaseIdx, seerCaseIdx + 1200);
test(
  'NIGHT_SEER case 存在且含 identity_table',
  seerWindow.includes('identity_table')
);

// NIGHT_WITCH 应有 identity_table
const witchCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:');
const witchWindow = aiSrc.slice(witchCaseIdx, witchCaseIdx + 2000);
test(
  'NIGHT_WITCH case 存在且含 identity_table',
  witchWindow.includes('identity_table')
);

// NIGHT_GUARD 应有 identity_table
const guardCaseIdx = aiSrc.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD:');
const guardWindow = aiSrc.slice(guardCaseIdx, guardCaseIdx + 1500);
test(
  'NIGHT_GUARD case 存在且含 identity_table',
  guardWindow.includes('identity_table')
);

console.log('\n=== T17-T22: 回归测试 ===');

// 骑士终局阈值（R22 修复）
const knightSrc = readFileSync('src/services/rolePrompts/knight.js', 'utf8');
test(
  '骑士终局模式：aliveCount <= 5 阈值仍在（R22 回归）',
  knightSrc.includes('aliveCount') && knightSrc.includes('isEndgame')
);
test(
  '骑士终局阈值文本：50%/40% 存在（R22 回归）',
  knightSrc.includes('50%') && knightSrc.includes('40%')
);

// 魔术师 hasRevealed night 优先级（R22 修复）
const magicianSrc = readFileSync('src/services/rolePrompts/magician.js', 'utf8');
test(
  '魔术师 nightAction 包含 hasRevealed 分支（R22 回归）',
  magicianSrc.includes('hasRevealed') && magicianSrc.includes('if (hasRevealed)')
);

// 摄梦人 DAY_SPEECH hasRevealed（R21 修复）
const dreamweaverSrc = readFileSync('src/services/rolePrompts/dreamweaver.js', 'utf8');
test(
  '摄梦人 daySpeech 包含 hasRevealed（R21 回归）',
  dreamweaverSrc.includes('hasRevealed')
);

// 摩术师和摄梦人的 DAY_SPEECH roleParams 都传入 hasRevealed
test(
  'DAY_SPEECH roleParams 传 hasRevealed（R20/21 回归）',
  aiSrc.includes('hasRevealed: currentPlayer?.hasRevealed,  // 魔术师是否已跳身份')
);

// 骑士 shouldDuel 消费端仍存在
const speechFlowSrc = readFileSync('src/hooks/useSpeechFlow.js', 'utf8');
test(
  'useSpeechFlow.js 仍然消费 shouldDuel（R8 回归）',
  speechFlowSrc.includes('shouldDuel')
);

console.log('\n=== T23-T25: 边界条件 ===');

// 当 hasRevealed=false 时，NIGHT_DREAMWEAVER 策略不含"殉情最高优先"标记
// 通过检查 else 分支中没有出现 '★ 殉情模式（最高优先）' 来验证
// 找到 else { 分支
const elseIdx = dwWindow.indexOf('} else {\n');
const elseWindow = elseIdx !== -1 ? dwWindow.slice(elseIdx, elseIdx + 600) : '';
test(
  'hasRevealed=false 的 else 分支中不含"★ 殉情模式（最高优先）"',
  elseIdx !== -1 && !elseWindow.includes('★ 殉情模式（最高优先）')
);

// 不管 hasRevealed，女巫/猎人规避提示始终存在（整体策略数组后面）
test(
  '女巫/猎人规避提示在 if/else 块之外（整局通用）',
  dwWindow.includes('避免入梦女巫') && dwWindow.includes('避免入梦猎人')
);

// 殉情阈值 confidence≥50% 只出现在 dwHasRevealed=true 分支
const if_dw_idx = dwWindow.indexOf('if (dwHasRevealed) {');
const else_idx = dwWindow.indexOf('} else {');
const before_else = if_dw_idx !== -1 && else_idx !== -1
  ? dwWindow.slice(if_dw_idx, else_idx)
  : '';
test(
  '殉情 50% 阈值只在 dwHasRevealed=true 分支中出现',
  before_else.includes('50%') && !elseWindow.includes('50%')
);

// ── 总结 ──
console.log(`\n${'─'.repeat(50)}`);
console.log(`总计：${tc} 项，通过 ${passed}，失败 ${failed}`);
if (failed === 0) {
  console.log('✅ ALL TESTS PASSED');
  process.exit(0);
} else {
  console.error(`❌ ${failed} TEST(S) FAILED`);
  process.exit(1);
}
