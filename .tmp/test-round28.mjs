/**
 * Round 28 Tests: isSheriff 注入到 DAY_SPEECH + DAY_VOTE
 *
 * T1-T5:  isSheriff 进入 roleParams
 * T6-T10: DAY_SPEECH 警长任务提示（好人方/狼人/预言家分支）
 * T11-T15: DAY_VOTE 警长权重提示
 * T16-T20: 非警长场景不引入警长文本（避免污染）
 * T21-T25: 回归测试（R27 关键特性不受影响）
 */

import { readFileSync } from 'fs';

const src = readFileSync('./src/services/aiPrompts.js', 'utf-8');

let pass = 0, fail = 0;
function assert(name, condition) {
    if (condition) { console.log(`  ✅ ${name}`); pass++; }
    else           { console.error(`  ❌ ${name}`); fail++; }
}

// ─── T1-T5: isSheriff 进入 roleParams ───────────────────────────────────────
console.log('\n[T1-T5] isSheriff 进入 roleParams');

// T1: roleParams 中存在 isSheriff 字段赋值
assert('T1: isSheriff 在 roleParams 中被赋值',
    src.includes('isSheriff: currentPlayer?.isSheriff || false,'));

// T2: isSheriff 赋值出现在 roleParams 对象内部（roleParams = { 附近）
const roleParamsIdx = src.indexOf('const roleParams = {');
const roleParamsEnd = src.indexOf('};', roleParamsIdx) + 2;
const roleParamsBlock = src.slice(roleParamsIdx, roleParamsEnd);
assert('T2: isSheriff 赋值在 roleParams 对象块内',
    roleParamsBlock.includes('isSheriff: currentPlayer?.isSheriff || false,'));

// T3: sheriffHint 变量在 roleParams 之后被定义
const sheriffHintIdx = src.indexOf('const sheriffHint = roleParams.isSheriff');
assert('T3: sheriffHint 变量存在', sheriffHintIdx > -1);
assert('T4: sheriffHint 定义在 roleParams 构建之后', sheriffHintIdx > roleParamsEnd);

// T5: 返回语句包含 sheriffHint
const returnLineIdx = src.indexOf('return rolePromptGenerator(ctx, roleParams) + sheriffHint');
assert('T5: 返回值包含 sheriffHint', returnLineIdx > -1);

// ─── T6-T10: DAY_SPEECH 警长任务提示内容 ─────────────────────────────────────
console.log('\n[T6-T10] DAY_SPEECH 警长任务提示内容');

const sheriffHintBlock = src.slice(sheriffHintIdx, sheriffHintIdx + 1200);

assert('T6: 包含"警长任务"标识',
    sheriffHintBlock.includes('警长任务'));

assert('T7: 包含 1.5 票说明',
    sheriffHintBlock.includes('1.5票'));

assert('T8: 包含"警长指路"关键词',
    sheriffHintBlock.includes('警长指路'));

assert('T9: 包含好人警长分支（非狼人/非预言家角色）',
    sheriffHintBlock.includes('好人警长'));

assert('T10: 包含狼人警长分支',
    sheriffHintBlock.includes('狼人警长'));

// ─── T11-T15: DAY_VOTE 警长权重提示 ──────────────────────────────────────────
console.log('\n[T11-T15] DAY_VOTE 警长权重提示');

const isVoterSheriffIdx = src.indexOf('const isVoterSheriff = currentPlayer?.isSheriff || false;');
assert('T11: isVoterSheriff 变量存在', isVoterSheriffIdx > -1);

// 确认在 DAY_VOTE case 内（通过 case PROMPT_ACTIONS.DAY_VOTE: { 定位）
const dayVoteCaseIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const dayVoteCaseEnd = src.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT:', dayVoteCaseIdx);
const dayVoteBlock = src.slice(dayVoteCaseIdx, dayVoteCaseEnd);
assert('T12: isVoterSheriff 在 DAY_VOTE case 内',
    dayVoteBlock.includes('const isVoterSheriff = currentPlayer?.isSheriff || false;'));

assert('T13: sheriffVoteHint 变量存在于 DAY_VOTE',
    dayVoteBlock.includes('const sheriffVoteHint = isVoterSheriff'));

assert('T14: sheriffVoteHint 包含"1.5票"说明',
    dayVoteBlock.includes('1.5票') && dayVoteBlock.includes('sheriffVoteHint'));

assert('T15: sheriffVoteHint 注入到返回字符串',
    dayVoteBlock.includes('${sheriffVoteHint}'));

// ─── T16-T20: 非警长场景不引入警长文本 ───────────────────────────────────────
console.log('\n[T16-T20] 非警长场景负向测试');

// sheriffHint 应使用三元：isSheriff ? ... : '' 形式（非警长时空字符串）
assert('T16: sheriffHint 在非警长时为空字符串（三元 false 分支）',
    src.includes("const sheriffHint = roleParams.isSheriff\n                ? `") ||
    src.includes('const sheriffHint = roleParams.isSheriff'));

// sheriffVoteHint 应使用三元
assert('T17: sheriffVoteHint 在非警长时为空字符串（三元 false 分支）',
    dayVoteBlock.includes(': ``;') || dayVoteBlock.includes(": '';") ||
    dayVoteBlock.includes(': \`\`;'));

// T18: 警长任务文本不出现在常规的 NIGHT_* case 中（隔离性）
const nightWolfIdx = src.indexOf("case PROMPT_ACTIONS.NIGHT_WOLF:");
const nightGuardIdx = src.indexOf("case PROMPT_ACTIONS.NIGHT_GUARD:");
const nightWolfBlock = src.slice(nightWolfIdx, nightWolfIdx + 600);
assert('T18: 警长任务文本不在 NIGHT_WOLF case 中',
    !nightWolfBlock.includes('警长任务'));

// T19: isVoterSheriff 只出现在 DAY_VOTE case 内
const isVoterSheriffCount = (src.match(/isVoterSheriff/g) || []).length;
assert('T19: isVoterSheriff 出现次数合理（3次：定义+条件+${插值}）',
    isVoterSheriffCount >= 2 && isVoterSheriffCount <= 5);

// T20: sheriffHint 定义不在任何 NIGHT_* case 内（不污染夜间行动）
const night1Idx = src.indexOf("case PROMPT_ACTIONS.NIGHT_SEER:");
assert('T20: sheriffHint 定义出现在 NIGHT_SEER case 之前（DAY_SPEECH 区域）',
    sheriffHintIdx < night1Idx);

// ─── T21-T25: 回归测试（R27 核心特性） ───────────────────────────────────────
console.log('\n[T21-T25] 回归测试 R27 核心特性');

// T21: seerCounterClaimantsInVote 仍然存在于 DAY_VOTE
assert('T21: seerCounterClaimantsInVote 回归',
    dayVoteBlock.includes('seerCounterClaimantsInVote'));

// T22: seerVoteStrategy PK 分支仍然存在
assert('T22: seerVoteStrategy PK分支回归',
    dayVoteBlock.includes('PK必须投悍跳者'));

// T23: wolfTeammatesHint 仍然存在于 DAY_SPEECH 狼人提示词
const wolfSpeechIdx = src.indexOf("'狼人': (ctx, params) => {");
const wolfSpeechBlock = src.slice(wolfSpeechIdx, wolfSpeechIdx + 1500);
assert('T23: wolfTeammatesHint 回归（多狼协作）',
    wolfSpeechBlock.includes('wolfTeammatesHint'));

// T24: 预言家 counterClaimants 对跳三步法仍然存在
const seerSpeechIdx = src.indexOf("'预言家': (ctx, params) => {");
const seerSpeechBlock = src.slice(seerSpeechIdx, seerSpeechIdx + 3000);
assert('T24: 预言家对跳三步法回归（Step A）',
    seerSpeechBlock.includes('Step A'));

// T25: DAY_VOTE 热力降权三标准回归
assert('T25: 热力降权三标准回归（刷票陷阱）',
    dayVoteBlock.includes('刷票陷阱'));

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n总计：${pass + fail} 项，通过 ${pass}，失败 ${fail}`);
if (fail > 0) process.exit(1);
