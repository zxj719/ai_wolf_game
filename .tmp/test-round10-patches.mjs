/**
 * Round 10 Patch Verification Tests
 * 主要测试：消除 getBaseContext 函数分叉（import 替代本地定义）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const aiPromptsSrc = readFileSync(join(root, 'src/services/aiPrompts.js'), 'utf8');
const baseRulesSrc = readFileSync(join(root, 'src/services/rolePrompts/baseRules.js'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/services/rolePrompts/index.js'), 'utf8');
const knightSrc = readFileSync(join(root, 'src/services/rolePrompts/knight.js'), 'utf8');
const magicianSrc = readFileSync(join(root, 'src/services/rolePrompts/magician.js'), 'utf8');
const dreamweaverSrc = readFileSync(join(root, 'src/services/rolePrompts/dreamweaver.js'), 'utf8');

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

console.log('\n=== Round 10 Patch Tests ===\n');

// ────────────────────────────────────────────────────────────────────
// T1-T3: 主修复验证 — getBaseContext 分叉消除
// ────────────────────────────────────────────────────────────────────

// T1: aiPrompts.js 不再有本地 getBaseContext 定义
test(
  'T1: aiPrompts.js 无本地 getBaseContext 定义（分叉源已删除）',
  !aiPromptsSrc.includes('const getBaseContext ='),
  '仍然存在本地定义，分叉未消除'
);

// T2: aiPrompts.js 从 ./rolePrompts 导入 getBaseContext
test(
  'T2: aiPrompts.js import { getBaseContext } from ./rolePrompts',
  aiPromptsSrc.includes('getBaseContext') &&
  aiPromptsSrc.match(/import\s*\{[^}]*getBaseContext[^}]*\}\s*from\s*['"]\.\/rolePrompts['"]/),
  '未从 rolePrompts 导入 getBaseContext'
);

// T3: rolePrompts/index.js 正确地 re-export getBaseContext from baseRules
test(
  'T3: rolePrompts/index.js re-exports getBaseContext from baseRules',
  indexSrc.includes('getBaseContext') && indexSrc.includes("from './baseRules'"),
  '导出链断裂：index.js 未导出 getBaseContext'
);

// ────────────────────────────────────────────────────────────────────
// T4-T5: 死代码清理
// ────────────────────────────────────────────────────────────────────

// T4: aiPrompts.js 无 baseContext 死变量
test(
  'T4: aiPrompts.js 无未使用的 baseContext 变量',
  !aiPromptsSrc.includes('const baseContext ='),
  '死代码 const baseContext 仍存在'
);

// T5: aiPrompts.js 无 // Base context block included in most prompts 注释
test(
  'T5: 死代码相关注释已清除',
  !aiPromptsSrc.includes('Base context block included in most prompts'),
  '相关注释仍存在'
);

// ────────────────────────────────────────────────────────────────────
// T6-T11: 6 个主要角色仍通过 getBaseContext 构建发言基础上下文
// ────────────────────────────────────────────────────────────────────

// 搜索整个 ROLE_DAY_SPEECH_PROMPTS 字典块（6 个主要角色，不含骑士/摄梦/魔术师）
const dictStart = aiPromptsSrc.indexOf('const ROLE_DAY_SPEECH_PROMPTS = {');
const dictBlock = dictStart !== -1 ? aiPromptsSrc.slice(dictStart, dictStart + 8000) : '';
// 只计 6 个主角色（骑士/摄梦/魔术师委托给模块，不直接调用 getBaseContext）
const getBaseContextCallCount = (dictBlock.match(/getBaseContext\(ctx\)/g) || []).length;

test(
  'T6: 6 个主要角色的 DAY_SPEECH 均调用 getBaseContext(ctx)',
  getBaseContextCallCount >= 6,
  `只有 ${getBaseContextCallCount}/6 次 getBaseContext(ctx) 调用`
);

// ────────────────────────────────────────────────────────────────────
// T7-T9: 特殊角色 (骑士/摄梦人/魔术师) 仍使用 baseRules.getBaseContext
// ────────────────────────────────────────────────────────────────────

test(
  'T7: 骑士 rolePrompts 从 baseRules 导入 getBaseContext',
  knightSrc.includes("import { getBaseContext } from './baseRules'"),
  '骑士模块未导入 baseRules.getBaseContext'
);

test(
  'T8: 摄梦人 rolePrompts 从 baseRules 导入 getBaseContext',
  dreamweaverSrc.includes("import { getBaseContext } from './baseRules'"),
  '摄梦人模块未导入 baseRules.getBaseContext'
);

test(
  'T9: 魔术师 rolePrompts 从 baseRules 导入 getBaseContext',
  magicianSrc.includes("import { getBaseContext } from './baseRules'"),
  '魔术师模块未导入 baseRules.getBaseContext'
);

// ────────────────────────────────────────────────────────────────────
// T10-T14: baseRules.js 内容完整性（被所有路径依赖）
// ────────────────────────────────────────────────────────────────────

test(
  'T10: baseRules.js getBaseContext 包含整局时间线',
  baseRulesSrc.includes('整局时间线'),
  'baseRules.js getBaseContext 缺少整局时间线字段'
);

test(
  'T11: baseRules.js getBaseContext 包含 identityAnalysis.hints',
  baseRulesSrc.includes('identityAnalysis?.hints'),
  '缺少 identityAnalysis.hints 注入'
);

test(
  'T12: baseRules.js getBaseContext 包含时序提醒（未发言玩家）',
  baseRulesSrc.includes('时序提醒') && baseRulesSrc.includes('已发言'),
  '缺少时序提醒'
);

test(
  'T13: baseRules.js getBaseContext 包含 currentPlayerTraits 发言风格注入（Round 9 修复）',
  baseRulesSrc.includes('currentPlayerTraits'),
  '缺少 currentPlayerTraits，Round 9 修复丢失'
);

test(
  'T14: baseRules.js getBaseContext 是 export const（不是 const）',
  baseRulesSrc.includes('export const getBaseContext'),
  'getBaseContext 在 baseRules.js 中未导出'
);

// ────────────────────────────────────────────────────────────────────
// T15-T20: 回归测试（前9轮关键修复）
// ────────────────────────────────────────────────────────────────────

// T15: Round 4 — NIGHT_SEER 有 identity_table
const seerNightIdx = aiPromptsSrc.indexOf('PROMPT_ACTIONS.NIGHT_SEER');
// 找到下一个 case 的位置作为截止点
const seerNextCase = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH');
const seerBlock = seerNightIdx !== -1
  ? aiPromptsSrc.slice(seerNightIdx, seerNextCase !== -1 ? seerNextCase : seerNightIdx + 1000)
  : '';
test(
  'T15: NIGHT_SEER 输出 schema 包含 identity_table (Round 4)',
  seerBlock.includes('identity_table'),
  'NIGHT_SEER 缺少 identity_table'
);

// T16: Round 6 — NIGHT_WITCH 有 identity_table
const witchNightIdx = aiPromptsSrc.indexOf('PROMPT_ACTIONS.NIGHT_WITCH');
const witchNextCase = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER');
const witchBlock = witchNightIdx !== -1
  ? aiPromptsSrc.slice(witchNightIdx, witchNextCase !== -1 ? witchNextCase : witchNightIdx + 1500)
  : '';
test(
  'T16: NIGHT_WITCH 输出 schema 包含 identity_table (Round 6)',
  witchBlock.includes('identity_table'),
  'NIGHT_WITCH 缺少 identity_table'
);

// T17: Round 7 — HUNTER_SHOOT 含 aliveCount 推断框架
const hunterIdx = aiPromptsSrc.indexOf('PROMPT_ACTIONS.HUNTER_SHOOT');
const hunterBlock = hunterIdx !== -1 ? aiPromptsSrc.slice(hunterIdx, hunterIdx + 1000) : '';
test(
  'T17: HUNTER_SHOOT 临界局势引导包含 aliveTargets 数量推断 (Round 7)',
  hunterBlock.includes('存活') && hunterBlock.includes('狼人') && hunterBlock.includes('aliveTargets'),
  'HUNTER_SHOOT 缺少临界局势推断框架'
);

// T18: Round 5 — LAST_WORDS 有预言家专属分支
const lwIdx = aiPromptsSrc.indexOf('PROMPT_ACTIONS.LAST_WORDS');
const lwBlock = lwIdx !== -1 ? aiPromptsSrc.slice(lwIdx, lwIdx + 3000) : '';
test(
  'T18: LAST_WORDS 有预言家/女巫/猎人/守卫专属分支 (Round 5)',
  lwBlock.includes("playerRole === '预言家'") &&
  lwBlock.includes("playerRole === '女巫'") &&
  lwBlock.includes("playerRole === '猎人'") &&
  lwBlock.includes("playerRole === '守卫'"),
  '某些角色缺少 LAST_WORDS 专属分支'
);

// T19: Round 8 — 骑士/摄梦人/魔术师有 LAST_WORDS 专属分支
test(
  'T19: LAST_WORDS 有骑士/摄梦人/魔术师专属分支 (Round 8)',
  lwBlock.includes("playerRole === '骑士'") &&
  lwBlock.includes("playerRole === '摄梦人'") &&
  lwBlock.includes("playerRole === '魔术师'"),
  '骑士/摄梦人/魔术师缺少 LAST_WORDS 专属分支'
);

// T20: 9 个角色全部在 ROLE_DAY_SPEECH_PROMPTS 中有条目
const allRoles = ['狼人', '预言家', '女巫', '猎人', '守卫', '村民', '骑士', '摄梦人', '魔术师'];
const roleDaySpeechIdx = aiPromptsSrc.indexOf('const ROLE_DAY_SPEECH_PROMPTS = {');
// 足够大的窗口：整个字典到 generateUserPrompt 之间
const roleDaySpeechEnd = aiPromptsSrc.indexOf('export const generateUserPrompt');
const roleDaySpeechBlock = roleDaySpeechIdx !== -1
  ? aiPromptsSrc.slice(roleDaySpeechIdx, roleDaySpeechEnd !== -1 ? roleDaySpeechEnd : roleDaySpeechIdx + 10000)
  : '';
const missingRoles = allRoles.filter(r => !roleDaySpeechBlock.includes(`'${r}':`));
test(
  'T20: ROLE_DAY_SPEECH_PROMPTS 覆盖全部 9 个角色 (Round 8)',
  missingRoles.length === 0,
  `缺少角色: ${missingRoles.join(', ')}`
);

// T21: 骑士 DAY_SPEECH 输出包含 shouldDuel 字段
test(
  'T21: 骑士 daySpeech 输出包含 shouldDuel 触发字段',
  knightSrc.includes('shouldDuel'),
  '骑士缺少 shouldDuel，决斗触发不会生效'
);

// T22: 魔术师 DAY_SPEECH 输出包含 shouldReveal 字段
test(
  'T22: 魔术师 daySpeech 输出包含 shouldReveal 字段',
  magicianSrc.includes('shouldReveal'),
  '魔术师缺少 shouldReveal，身份披露不会触发'
);

// T23: Round 3 — 狼人 DAY_SPEECH 有 wolfTeammatesHint 多狼协作
test(
  'T23: 狼人 DAY_SPEECH 有 wolfTeammates 多狼协作提示 (Round 3)',
  aiPromptsSrc.includes('wolfTeammatesHint') && aiPromptsSrc.includes('wolfTeammates'),
  '狼人缺少多狼协作提示'
);

// ────────────────────────────────────────────────────────────────────
// 总结
// ────────────────────────────────────────────────────────────────────

console.log(`\n=== 测试结果 ===`);
console.log(`✅ 通过: ${passed}`);
if (failed > 0) console.log(`❌ 失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
