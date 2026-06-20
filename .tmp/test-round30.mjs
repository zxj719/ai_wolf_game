/**
 * Round 30 测试：SHERIFF_SPEECH 猎人隐性威慑框架验证
 * 测试猎人竞选发言在不暴露身份的前提下暗示"死不是终点"
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

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

// 定位 SHERIFF_SPEECH case 块（用 lastIndexOf 确保是 generateUserPrompt 里的真实实现）
const sheriffSpeechIdx = src.lastIndexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
assert(sheriffSpeechIdx >= 0, '找不到 SHERIFF_SPEECH case');

// 找到 case 块的结束位置（下一个 case）
const nextCaseAfterSpeech = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:', sheriffSpeechIdx);
assert(nextCaseAfterSpeech > sheriffSpeechIdx, '找不到 SHERIFF_VOTE case（SHERIFF_SPEECH 后继）');

const sheriffSpeechBlock = src.slice(sheriffSpeechIdx, nextCaseAfterSpeech);

console.log('\n=== T1-T5: SHERIFF_SPEECH 猎人分支存在性验证 ===');

test('T1: SHERIFF_SPEECH 中有猎人独立分支', () => {
  assert(sheriffSpeechBlock.includes("playerRole === '猎人'"), '应存在猎人独立分支');
});

test('T2: 猎人分支在狼人分支之后、好人fallback之前', () => {
  const wolfIdx = sheriffSpeechBlock.indexOf("playerRole === '狼人'");
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  assert(wolfIdx >= 0, '缺少狼人分支');
  assert(hunterIdx > wolfIdx, '猎人分支应在狼人分支之后');
  assert(goodIdx > hunterIdx, '好人fallback应在猎人分支之后');
});

test('T3: 猎人分支含"持续威慑力"或相关威慑词汇', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('威慑') || hunterBlock.includes('不惧') || hunterBlock.includes('不亏'),
    '猎人分支应含威慑相关词汇'
  );
});

test('T4: 猎人分支有"绝不能暴露猎人身份"的警告', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('绝不能暴露') || hunterBlock.includes('不能暴露猎人') || hunterBlock.includes('不能说"我是猎人"'),
    '猎人分支应有不暴露身份的警告'
  );
});

test('T5: 猎人分支有"不确定性"或"隐性"概念（威慑机制说明）', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('不确定性') || hunterBlock.includes('隐性') || hunterBlock.includes('模糊'),
    '猎人分支应说明模糊/隐性的策略价值'
  );
});

console.log('\n=== T6-T10: 猎人分支内容质量验证 ===');

test('T6: 猎人提示词含"死不是终点"或等价的"倒下了好人不亏"概念', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('白亏') || hunterBlock.includes('不亏') || hunterBlock.includes('倒下'),
    '猎人分支应含"死不是终点/不白亏"等价概念'
  );
});

test('T7: 猎人提示词含具体改编示例（两个角度①②）', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    (hunterBlock.includes('①') && hunterBlock.includes('②')) ||
    (hunterBlock.includes('角度') && hunterBlock.includes('①')),
    '猎人分支应包含两个具体改编角度示例'
  );
});

test('T8: 猎人提示词含3要点结构（含昨夜分析）', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('昨夜局势') || hunterBlock.includes('局势分析'),
    '猎人分支应含昨夜局势分析要点（基础分析能力展示）'
  );
});

test('T9: 猎人分支使用了 badgeFlowLine 变量', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  assert(
    hunterBlock.includes('${badgeFlowLine}'),
    '猎人分支应使用 badgeFlowLine 变量（警徽流/价值主张）'
  );
});

test('T10: 猎人分支未直接提及"开枪"技能（隐性威慑不能明说技能）', () => {
  const hunterIdx = sheriffSpeechBlock.indexOf("playerRole === '猎人'");
  const goodIdx = sheriffSpeechBlock.lastIndexOf("你是好人（${playerRole}）");
  const hunterBlock = sheriffSpeechBlock.slice(hunterIdx, goodIdx);
  // 猎人竞选发言提示词内不应直接提"开枪"（会暗示技能）
  // 注意：SHERIFF_RUN 中可以提"开枪"（那是决策分析），但竞选发言提示词不应引导 AI 直接说"开枪"
  assert(
    !hunterBlock.includes('开枪'),
    '猎人竞选发言提示词不应直接提"开枪"——应用间接措辞保持隐性威慑'
  );
});

console.log('\n=== T11-T15: 其他角色分支未被破坏（回归验证）===');

test('T11: 预言家分支仍然存在且含查验结果要点', () => {
  assert(sheriffSpeechBlock.includes("playerRole === '预言家'"), '预言家分支消失');
  assert(sheriffSpeechBlock.includes('首夜查验结果'), '预言家竞选发言要点消失');
});

test('T12: 狼人分支仍然存在且含悍跳/好人双策略', () => {
  assert(sheriffSpeechBlock.includes("playerRole === '狼人'"), '狼人分支消失');
  assert(sheriffSpeechBlock.includes('悍跳预言家'), '狼人分支悍跳策略消失');
});

test('T13: 好人 fallback 仍然存在且含3要点', () => {
  assert(sheriffSpeechBlock.includes('你是好人（${playerRole}）'), '好人 fallback 消失');
  assert(sheriffSpeechBlock.includes('昨夜局势分析'), '好人 fallback 要点消失');
});

test('T14: SHERIFF_SPEECH 输出 JSON 模板完整', () => {
  assert(sheriffSpeechBlock.includes('"speech"'), 'SHERIFF_SPEECH 应输出 speech 字段');
  assert(sheriffSpeechBlock.includes('"thought"'), 'SHERIFF_SPEECH 应输出 thought 字段');
});

test('T15: badgeFlowLine 仍然在 SHERIFF_SPEECH 中计算（含警徽流/价值主张）', () => {
  assert(
    sheriffSpeechBlock.includes('badgeFlowLine') || sheriffSpeechBlock.includes('警徽流计划'),
    'badgeFlowLine 应在 SHERIFF_SPEECH block 中存在'
  );
});

console.log('\n=== T16-T20: R29 SHERIFF_RUN 回归 ===');

const sheriffRunIdx = src.lastIndexOf('case PROMPT_ACTIONS.SHERIFF_RUN:');
const nextCaseIdx = src.indexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:', sheriffRunIdx);
const sheriffRunBlock = src.slice(sheriffRunIdx, nextCaseIdx);

test('T16: R29 SHERIFF_RUN 猎人独立分支仍存在', () => {
  assert(sheriffRunBlock.includes("} else if (playerRole === '猎人')"), 'R29 猎人独立分支消失');
});

test('T17: R29 SHERIFF_RUN 猎人分支含"值得认真考虑"', () => {
  assert(sheriffRunBlock.includes('值得认真考虑') || sheriffRunBlock.includes('值得'), 'R29 猎人上警决策框架消失');
});

test('T18: R29 SHERIFF_RUN 女巫"默认不上警"仍存在', () => {
  assert(sheriffRunBlock.includes('默认不上警'), 'R29 女巫默认不上警消失');
});

test('T19: R29 SHERIFF_RUN 守卫"强烈建议不上警"仍存在', () => {
  assert(sheriffRunBlock.includes('强烈建议不上警'), 'R29 守卫强烈建议不上警消失');
});

test('T20: R28 isSheriff 后处理注入仍然存在', () => {
  assert(src.includes('isSheriff: currentPlayer?.isSheriff || false'), 'R28 isSheriff roleParams 注入消失');
  assert(src.includes('roleParams.isSheriff'), 'R28 sheriffHint 条件检查消失');
});

console.log('\n=== T21-T25: 深层回归（R26-R27 预言家 + R24 identity_table）===');

test('T21: R27 DAY_VOTE 对跳投票优先级仍存在', () => {
  assert(src.includes('seerCounterClaimantsInVote') || src.includes('counterClaimants'),
    'R27 对跳投票优先级逻辑消失');
});

test('T22: R26 预言家对跳三步法仍存在（Step A/B）', () => {
  assert(src.includes('Step A') || src.includes('Step B'), 'R26 预言家对跳三步法消失');
});

test('T23: R15 狼人多狼协作 let wolfTeammatesHint 仍存在', () => {
  assert(src.includes('wolfTeammatesHint'), 'R15 多狼协作提示消失');
});

test('T24: NIGHT_* case 均含 identity_table（委托模块联合验证）', () => {
  const magicianSrc = readFileSync(join(__dirname, '../src/services/rolePrompts/magician.js'), 'utf-8');
  const dreamweaverSrc = readFileSync(join(__dirname, '../src/services/rolePrompts/dreamweaver.js'), 'utf-8');

  const directCases = ['NIGHT_GUARD', 'NIGHT_SEER', 'NIGHT_WOLF', 'NIGHT_WITCH'];
  for (const nc of directCases) {
    const idx = src.lastIndexOf(`case PROMPT_ACTIONS.${nc}:`);
    assert(idx >= 0, `找不到 ${nc} case`);
    const nextIdx = src.indexOf('case PROMPT_ACTIONS.', idx + 1);
    const block = src.slice(idx, nextIdx > idx ? nextIdx : idx + 4000);
    assert(block.includes('identity_table'), `${nc} case 缺少 identity_table`);
  }

  assert(magicianSrc.includes('identity_table'), 'magician.js nightAction 缺少 identity_table');
  assert(dreamweaverSrc.includes('identity_table'), 'dreamweaver.js nightAction 缺少 identity_table');
});

test('T25: R24 守卫跨轮追加格式仍存在', () => {
  assert(src.includes('追加示例') || src.includes('追加不覆盖'), 'R24 追加格式指导消失');
});

console.log(`\n============================`);
console.log(`总计：${passed + failed} 项测试，通过 ${passed}，失败 ${failed}`);
console.log(`============================\n`);

if (failed > 0) process.exit(1);
