/**
 * Round 9 Patch Verification Tests
 * 主要测试：baseRules.js getBaseContext 的 currentPlayerTraits 注入
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 读取源文件进行静态验证
const baseRulesSrc = readFileSync(join(root, 'src/services/rolePrompts/baseRules.js'), 'utf8');
const aiPromptsSrc = readFileSync(join(root, 'src/services/aiPrompts.js'), 'utf8');
const knightSrc = readFileSync(join(root, 'src/services/rolePrompts/knight.js'), 'utf8');
const dreamweaverSrc = readFileSync(join(root, 'src/services/rolePrompts/dreamweaver.js'), 'utf8');
const magicianSrc = readFileSync(join(root, 'src/services/rolePrompts/magician.js'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition, detail = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

console.log('\n=== Round 9 Patch Tests ===\n');

// ---------- T1: baseRules.js 的 getBaseContext 现在包含 currentPlayerTraits ----------
test(
  'T1: baseRules.js getBaseContext 包含 currentPlayerTraits 注入',
  baseRulesSrc.includes('ctx.currentPlayerTraits'),
  '缺少 currentPlayerTraits 注入，特殊角色无法获得发言风格'
);

// ---------- T2: baseRules.js 的 currentPlayerTraits 格式与 aiPrompts.js 一致 ----------
const baseRulesTraitsSnippet = '你的发言风格】${ctx.currentPlayerTraits} 用这个风格说话';
const aiPromptsTraitsSnippet = '你的发言风格】${ctx.currentPlayerTraits} 用这个风格说话';
test(
  'T2: baseRules.js 和 aiPrompts.js 的发言风格文本格式一致',
  baseRulesSrc.includes(baseRulesTraitsSnippet) && aiPromptsSrc.includes(aiPromptsTraitsSnippet),
  '格式不一致，AI 可能接收到不同的指令'
);

// ---------- T3-T5: 特殊角色的 daySpeech 委托给 roleModule ----------
const roleDay骑士Idx = aiPromptsSrc.indexOf("'骑士': (ctx, params) => getRoleModule('骑士').daySpeech");
const roleDay摄梦人Idx = aiPromptsSrc.indexOf("'摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech");
const roleDay魔术师Idx = aiPromptsSrc.indexOf("'魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech");

test('T3: ROLE_DAY_SPEECH_PROMPTS 骑士 → roleModule.daySpeech 委托', roleDay骑士Idx !== -1);
test('T4: ROLE_DAY_SPEECH_PROMPTS 摄梦人 → roleModule.daySpeech 委托', roleDay摄梦人Idx !== -1);
test('T5: ROLE_DAY_SPEECH_PROMPTS 魔术师 → roleModule.daySpeech 委托', roleDay魔术师Idx !== -1);

// ---------- T6: 骑士 daySpeech 输出 schema 包含 shouldDuel ----------
// 注：骑士模块的 schema 字符串内使用转义引号 \"shouldDuel\"
test(
  'T6: 骑士 daySpeech 输出 schema 包含 shouldDuel 字段',
  knightSrc.includes('shouldDuel'),
  '缺少 shouldDuel，useSpeechFlow.js 无法触发决斗'
);

// ---------- T7: 骑士 daySpeech 输出 schema 包含 duelTarget ----------
test(
  'T7: 骑士 daySpeech 输出 schema 包含 duelTarget 字段',
  knightSrc.includes('duelTarget'),
  '缺少 duelTarget，决斗目标无法被读取'
);

// ---------- T8: 摄梦人 daySpeech 输出 schema 包含 voteIntention ----------
// 注：摄梦人模块的 schema 字符串内使用转义引号 \"voteIntention\"
test(
  'T8: 摄梦人 daySpeech 输出 schema 包含 voteIntention',
  dreamweaverSrc.includes('voteIntention'),
  '缺少 voteIntention，摄梦人投票意向无法被记录'
);

// ---------- T9: 魔术师 daySpeech 输出 schema 包含 shouldReveal ----------
test(
  'T9: 魔术师 daySpeech 输出 schema 包含 shouldReveal',
  magicianSrc.includes('"shouldReveal"'),
  '缺少 shouldReveal，魔术师跳身份逻辑无法触发'
);

// ---------- T10: CLAIMS_SCHEMA_SUFFIX 在 DAY_SPEECH case 末尾追加 ----------
const claimsAppendIdx = aiPromptsSrc.indexOf('return rolePromptGenerator(ctx, roleParams) + CLAIMS_SCHEMA_SUFFIX');
test(
  'T10: CLAIMS_SCHEMA_SUFFIX 追加到所有角色 DAY_SPEECH 输出',
  claimsAppendIdx !== -1,
  '缺少 CLAIMS_SCHEMA_SUFFIX 追加，骑士等角色声明无法被结构化记录'
);

// ---------- T11-T13: 9 个角色全部在 ROLE_DAY_SPEECH_PROMPTS 中 ----------
const allRoles = ['狼人', '预言家', '女巫', '猎人', '守卫', '村民', '骑士', '摄梦人', '魔术师'];
const roleDayPromptIdx = aiPromptsSrc.indexOf('const ROLE_DAY_SPEECH_PROMPTS = {');
const roleMapEnd = aiPromptsSrc.indexOf('};', roleDayPromptIdx);
const roleMapChunk = aiPromptsSrc.slice(roleDayPromptIdx, roleMapEnd);

allRoles.forEach((role, i) => {
  test(
    `T${11 + i}: ROLE_DAY_SPEECH_PROMPTS 包含 '${role}'`,
    roleMapChunk.includes(`'${role}':`),
    `'${role}' 缺少专属 DAY_SPEECH 条目，会 fallthrough 到村民模板`
  );
});

// ---------- T20: baseRules.js 两个 getBaseContext 在结尾格式统一 ----------
// 检查 baseRules.js 的 getBaseContext 结尾包含 currentPlayerTraits（已修复）
// 检查 aiPrompts.js 的本地 getBaseContext 也包含 currentPlayerTraits
const localGetBaseCtxIdx = aiPromptsSrc.indexOf('const getBaseContext = (ctx) => `第');
const localGetBaseCtxEnd = aiPromptsSrc.indexOf('};', localGetBaseCtxIdx);
const localGetBaseCtxChunk = aiPromptsSrc.slice(localGetBaseCtxIdx, localGetBaseCtxEnd + 2);
test(
  'T20: aiPrompts.js 本地 getBaseContext 也包含 currentPlayerTraits（回归）',
  localGetBaseCtxChunk.includes('currentPlayerTraits'),
  '本地版本的发言风格注入被误删了'
);

// ---------- 回归测试：R7-R8 已修复的功能 ----------
// R7: HUNTER_SHOOT 包含 alive-count 推断框架
const hunterShootIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.HUNTER_SHOOT");
const hunterShootEnd = hunterShootIdx + 2000;
const hunterChunk = aiPromptsSrc.slice(hunterShootIdx, hunterShootEnd);
test(
  'T21: HUNTER_SHOOT (R7) 包含 alive-count 推断框架',
  hunterChunk.includes('存活人数') || hunterChunk.includes('alive') || hunterChunk.includes('criticalGuidance'),
  'R7 猎人开枪 alive-count 推断被误删'
);

// R8: LAST_WORDS 包含骑士/摄梦人/魔术师分支
const lastWordsIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.LAST_WORDS");
const lastWordsEnd = lastWordsIdx + 3000;
const lastWordsChunk = aiPromptsSrc.slice(lastWordsIdx, lastWordsEnd);
test(
  'T22: LAST_WORDS (R8) 骑士分支',
  lastWordsChunk.includes("playerRole === '骑士'"),
  'R8 骑士遗言专属分支被误删'
);
test(
  'T23: LAST_WORDS (R8) 摄梦人分支',
  lastWordsChunk.includes("playerRole === '摄梦人'"),
  'R8 摄梦人遗言专属分支被误删'
);
test(
  'T24: LAST_WORDS (R8) 魔术师分支',
  lastWordsChunk.includes("playerRole === '魔术师'"),
  'R8 魔术师遗言专属分支被误删'
);

// R6: SHERIFF_BADGE_PASS 包含 seerChecks
const badgePassIdx = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.SHERIFF_BADGE_PASS");
const badgePassEnd = badgePassIdx + 2000;
const badgePassChunk = aiPromptsSrc.slice(badgePassIdx, badgePassEnd);
test(
  'T25: SHERIFF_BADGE_PASS (R6) 包含 seerChecks 参数',
  badgePassChunk.includes('seerChecks'),
  'R6 警徽移交 seerChecks 参数被误删'
);

// ---------- 结果汇总 ----------
console.log(`\n=== 结果: ${passed}/${passed + failed} passed ===`);
if (failed > 0) {
  console.log(`❌ ${failed} 项失败`);
  process.exit(1);
} else {
  console.log('✅ 全部通过');
}
