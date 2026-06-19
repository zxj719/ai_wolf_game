/**
 * Round 6 验证测试
 * 覆盖：
 *   T1-T4:  NIGHT_WITCH output schema 含 identity_table
 *   T5-T10: SHERIFF_BADGE_PASS 含 seerChecks 分级提示
 *   T11-T14: 回归测试 (LAST_WORDS, NIGHT_SEER, NIGHT_WOLF)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ---- 读取源文件做静态分析 ----
const aiPromptsSource = readFileSync(join(rootDir, 'src/services/aiPrompts.js'), 'utf8');
const useDayFlowSource = readFileSync(join(rootDir, 'src/hooks/useDayFlow.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ===================================================
// T1-T4: NIGHT_WITCH identity_table
// ===================================================
console.log('\n--- T1-T4: NIGHT_WITCH identity_table ---');

test('T1: NIGHT_WITCH 输出 schema 包含 identity_table 字段', () => {
  const witchSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:')
  );
  assert(witchSection.includes('identity_table'), '输出 schema 中未找到 identity_table');
});

test('T2: NIGHT_WITCH identity_table 格式与其他夜间行动一致（含玩家号/suspect/confidence/reason）', () => {
  const witchSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:')
  );
  assert(witchSection.includes('"suspect"'), '缺少 suspect 字段');
  assert(witchSection.includes('"confidence"'), '缺少 confidence 字段');
  assert(witchSection.includes('"reason"'), '缺少 reason 字段');
});

test('T3: NIGHT_SEER 输出 schema 也包含 identity_table（回归：Round4 修复不回退）', () => {
  const seerSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:')
  );
  assert(seerSection.includes('identity_table'), 'NIGHT_SEER 丢失了 identity_table');
});

test('T4: NIGHT_GUARD 输出 schema 包含 identity_table（基线验证）', () => {
  const guardSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:')
  );
  assert(guardSection.includes('identity_table'), 'NIGHT_GUARD 丢失了 identity_table');
});

// ===================================================
// T5-T10: SHERIFF_BADGE_PASS seerChecks 分级提示
// ===================================================
console.log('\n--- T5-T10: SHERIFF_BADGE_PASS seerChecks ---');

test('T5: aiPrompts.js SHERIFF_BADGE_PASS case 解构了 seerChecks', () => {
  const badgeSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:')
  );
  assert(badgeSection.includes('bpSeerChecks') || badgeSection.includes('seerChecks'),
    'SHERIFF_BADGE_PASS 未读取 seerChecks');
});

test('T6: SHERIFF_BADGE_PASS 包含金水优先提示（goldWaterTargets）', () => {
  const badgeSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:')
  );
  assert(badgeSection.includes('金水') && badgeSection.includes('优先'),
    '缺少金水优先移交提示');
});

test('T7: SHERIFF_BADGE_PASS 包含查杀禁止提示（killedTargets）', () => {
  const badgeSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:')
  );
  assert(badgeSection.includes('查杀') && badgeSection.includes('绝对不能'),
    '缺少查杀禁止移交提示');
});

test('T8: useDayFlow.js 的 SHERIFF_BADGE_PASS 调用传递 seerChecks 参数', () => {
  // 在 handleSheriffBadgePass 函数上下文中查找
  const callIdx = useDayFlowSource.indexOf('PROMPT_ACTIONS.SHERIFF_BADGE_PASS');
  const callSurrounding = useDayFlowSource.slice(callIdx, callIdx + 150);
  assert(callSurrounding.includes('seerChecks'),
    'askAI(SHERIFF_BADGE_PASS) 调用未传 seerChecks');
});

test('T9: SHERIFF_BADGE_PASS 金水筛选逻辑：只过滤候选人中的金水（!isWolf && badgeableSet.has）', () => {
  const badgeSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:')
  );
  assert(badgeSection.includes('!c.isWolf') && badgeSection.includes('badgeableSet.has'),
    '金水过滤逻辑不完整（需要 !c.isWolf && badgeableSet.has(c.targetId)）');
});

test('T10: SHERIFF_BADGE_PASS 输出 schema 不变（targetId/reason/thought）', () => {
  const badgeSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:')
  );
  assert(badgeSection.includes('"targetId"'), '输出 schema 缺 targetId');
  assert(badgeSection.includes('"reason"'), '输出 schema 缺 reason');
  assert(badgeSection.includes('"thought"'), '输出 schema 缺 thought');
});

// ===================================================
// T11-T14: 回归测试
// ===================================================
console.log('\n--- T11-T14: 回归测试 ---');

test('T11: LAST_WORDS 女巫分支包含药品状态（Round5 修复不回退）', () => {
  const lastWords = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT:')
  );
  assert(lastWords.includes('hasWitchSave') || lastWords.includes('hasSave'),
    'LAST_WORDS 女巫分支丢失药品状态');
});

test('T12: LAST_WORDS 守卫分支包含守护记录提示（Round5 修复不回退）', () => {
  const lastWords = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.LAST_WORDS:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT:')
  );
  assert(lastWords.includes('守护记录'), 'LAST_WORDS 守卫分支丢失守护记录提示');
});

test('T13: NIGHT_WOLF 输出 schema 包含 identity_table（基线，不应被本轮改动影响）', () => {
  const wolfSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:')
  );
  assert(wolfSection.includes('identity_table'), 'NIGHT_WOLF 丢失了 identity_table');
});

test('T14: NIGHT_WITCH 仍然保留 useSave/usePoison/reasoning/thought 字段（schema 扩展不破坏原有字段）', () => {
  const witchSection = aiPromptsSource.slice(
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:'),
    aiPromptsSource.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:')
  );
  assert(witchSection.includes('"useSave"'), '丢失 useSave');
  assert(witchSection.includes('"usePoison"'), '丢失 usePoison');
  assert(witchSection.includes('"reasoning"'), '丢失 reasoning');
  assert(witchSection.includes('"thought"'), '丢失 thought');
});

// ===================================================
// 结果汇总
// ===================================================
console.log(`\n============================`);
console.log(`Round 6 测试结果: ${passed}/${passed + failed} 通过`);
if (failed > 0) {
  console.log(`❌ ${failed} 个测试失败`);
  process.exit(1);
} else {
  console.log(`✅ 全部通过`);
}
