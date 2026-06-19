/**
 * Round 24 测试脚本
 * 验证三项改动：
 * 1. 守卫 DAY_SPEECH identity_table 追加格式（追加不覆盖历史 + 追加示例）
 * 2. 守卫 NIGHT_GUARD identity_table 守护历史指导 + 追加示例
 * 3. DAY_VOTE 热力盲从防护：刷票靶子识别方法（三项标准 + 决策原则）
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const aiPromptsSrc = readFileSync(join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

let passed = 0;
let failed = 0;
const results = [];

function test(name, fn) {
    try {
        const result = fn();
        if (result === true) {
            passed++;
            results.push(`  ✅ ${name}`);
        } else {
            failed++;
            results.push(`  ❌ ${name}: returned ${JSON.stringify(result)}`);
        }
    } catch (e) {
        failed++;
        results.push(`  ❌ ${name}: ${e.message}`);
    }
}

// === T1-T8: 守卫 DAY_SPEECH identity_table 追加格式 ===

// 找守卫 DAY_SPEECH 区块
const guardDaySpeechMarker = "'守卫': (ctx, params) => {";
const guardDaySpeechStart = aiPromptsSrc.indexOf(guardDaySpeechMarker);
if (guardDaySpeechStart === -1) throw new Error("Cannot find 守卫 DAY_SPEECH section");
// 窗口：守卫 -> 村民 之间
const guardDaySpeechEnd = aiPromptsSrc.indexOf("'村民': (ctx, params) =>", guardDaySpeechStart);
const guardDaySection = aiPromptsSrc.slice(guardDaySpeechStart, guardDaySpeechEnd);

test('T1: 守卫 DAY_SPEECH 有追加格式指令（不覆盖历史）', () =>
    guardDaySection.includes('追加') && guardDaySection.includes('不覆盖历史'));

test('T2: 守卫 DAY_SPEECH 有【追加示例】标记', () =>
    guardDaySection.includes('【追加示例】'));

test('T3: 守卫 DAY_SPEECH 追加示例包含守护结果示例（N1守X号）', () => {
    const ex = guardDaySection.indexOf('追加示例');
    const window = guardDaySection.slice(ex, ex + 200);
    return window.includes('N1守') && window.includes('→');
});

test('T4: 守卫 DAY_SPEECH 提到"跨轮"或"连贯"（策略连贯性）', () =>
    guardDaySection.includes('跨轮') || guardDaySection.includes('连贯') || guardDaySection.includes('守护记录'));

test('T5: 守卫 DAY_SPEECH 仍保留神职候选标记', () =>
    guardDaySection.includes('守护优先级') || guardDaySection.includes('疑似关键神职') || guardDaySection.includes('守护候选'));

test('T6: 守卫 DAY_SPEECH 仍保留 identity_table 输出 JSON', () =>
    guardDaySection.includes('"identity_table"') && guardDaySection.includes('"voteIntention"'));

test('T7: 守卫 DAY_SPEECH 追加示例不含 JS 变量插值（静态文本）', () => {
    const ex = guardDaySection.indexOf('追加示例');
    const window = guardDaySection.slice(ex, ex + 250);
    // 不应含 ${canSave}, ${hasPoison} 等运行时变量
    return !window.match(/\$\{[a-zA-Z]/);
});

test('T8: 守卫 DAY_SPEECH identity_table 包含"confidence"范围', () =>
    guardDaySection.includes('50-80') || guardDaySection.includes('confidence'));

// === T9-T16: 守卫 NIGHT_GUARD identity_table 指导 ===

// 找 NIGHT_GUARD case 区块
const nightGuardMarker = 'case PROMPT_ACTIONS.NIGHT_GUARD:';
const nightGuardStart = aiPromptsSrc.indexOf(nightGuardMarker);
if (nightGuardStart === -1) throw new Error("Cannot find NIGHT_GUARD case");
const nightGuardEnd = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:', nightGuardStart);
const nightGuardSection = aiPromptsSrc.slice(nightGuardStart, nightGuardEnd);

test('T9: NIGHT_GUARD case 存在 identity_table 填写指导段落', () =>
    nightGuardSection.includes('identity_table 填写指导'));

test('T10: NIGHT_GUARD 追加指令明确"不覆盖历史"', () =>
    nightGuardSection.includes('不覆盖历史'));

test('T11: NIGHT_GUARD 有【追加示例】标记', () =>
    nightGuardSection.includes('【追加示例】'));

test('T12: NIGHT_GUARD 追加示例包含"N1守"格式', () => {
    const ex = nightGuardSection.indexOf('追加示例');
    const window = nightGuardSection.slice(ex, ex + 200);
    return window.includes('N1守') && window.includes('→');
});

test('T13: NIGHT_GUARD 有疑似神职守护候选标记', () =>
    nightGuardSection.includes('守护优先级') || nightGuardSection.includes('守护候选') || nightGuardSection.includes('疑似神职'));

test('T14: NIGHT_GUARD 最终 identity_table 输出字段未变', () =>
    nightGuardSection.includes('"targetId"') && nightGuardSection.includes('"identity_table"'));

test('T15: NIGHT_GUARD 追加示例不含运行时变量插值', () => {
    const ex = nightGuardSection.indexOf('追加示例');
    const window = nightGuardSection.slice(ex, ex + 250);
    return !window.match(/\$\{[a-zA-Z]/);
});

test('T16: NIGHT_GUARD 守护优先级顺序不变（预言家最高）', () =>
    nightGuardSection.includes('已跳身份的预言家'));

// === T17-T23: DAY_VOTE 热力盲从防护 ===

// 找 DAY_VOTE case 区块（用 lastIndexOf 避免 getCOTTemplate 假 case）
const dayVoteCaseMarker = 'case PROMPT_ACTIONS.DAY_VOTE: {';
const dayVoteStart = aiPromptsSrc.lastIndexOf(dayVoteCaseMarker);
if (dayVoteStart === -1) throw new Error("Cannot find DAY_VOTE case block");
const dayVoteEnd = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT:', dayVoteStart);
const dayVoteSection = aiPromptsSrc.slice(dayVoteStart, dayVoteEnd);

// 找热力 hint 区段
const heatHintStart = dayVoteSection.indexOf('跨轮投票热力');
if (heatHintStart === -1) throw new Error("Cannot find 跨轮投票热力 section");
const heatHintWindow = dayVoteSection.slice(heatHintStart, heatHintStart + 600);

test('T17: DAY_VOTE 热力区段存在刷票识别内容', () =>
    heatHintWindow.includes('刷票') || heatHintWindow.includes('靶子'));

test('T18: DAY_VOTE 有三项标准（数字标记①②③）', () =>
    heatHintWindow.includes('①') && heatHintWindow.includes('②') && heatHintWindow.includes('③'));

test('T19: DAY_VOTE 有"热力高但本轮发言"相关识别（标准①）', () =>
    heatHintWindow.includes('热力高但本轮发言') || heatHintWindow.includes('热力高但'));

test('T20: DAY_VOTE 有"多个狼嫌疑"合谋识别（标准②）', () =>
    heatHintWindow.includes('多个狼嫌疑') || heatHintWindow.includes('一致力推'));

test('T21: DAY_VOTE 有"踩明显狼嫌疑"正向识别（标准③）', () =>
    heatHintWindow.includes('踩') && (heatHintWindow.includes('狼嫌疑') || heatHintWindow.includes('好人在正确')));

test('T22: DAY_VOTE 有决策原则（先评估发言再参考热力）', () =>
    heatHintWindow.includes('决策原则') && heatHintWindow.includes('先') && heatHintWindow.includes('再'));

test('T23: DAY_VOTE 热力提示不含运行时变量插值（除 hotTargets 动态数据）', () => {
    // 只允许 ${hotTargets...} 和 ${...}条件；不允许已声明变量如 ${voteDay}
    const forbiddenVars = ['${voteDay}', '${aliveCount}', '${wolfCount}', '${isLateGame}', '${pkMode}'];
    for (const v of forbiddenVars) {
        if (heatHintWindow.includes(v)) return false;
    }
    return true;
});

// === T24-T26: 回归测试（确保既有机制未被破坏）===

test('T24: NIGHT_WITCH identity_table 无变化（R6 修复）', () => {
    const witchCaseStart = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:');
    const witchCaseEnd = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:', witchCaseStart);
    const witchSection = aiPromptsSrc.slice(witchCaseStart, witchCaseEnd);
    return witchSection.includes('"identity_table"') && witchSection.includes('useSave');
});

test('T25: DAY_SPEECH 村民 追加示例无变化（R19 修复）', () => {
    const villagerStart = aiPromptsSrc.lastIndexOf("'村民': (ctx, params) =>");
    // 村民 DAY_SPEECH 段落较长（约2000字节），窗口需足够大
    const villagerSection = aiPromptsSrc.slice(villagerStart, villagerStart + 2200);
    return villagerSection.includes('【追加示例】') && villagerSection.includes('N1发言带节奏');
});

test('T26: DAY_SPEECH 猎人 追加示例无变化（R19 修复）', () => {
    const hunterStart = aiPromptsSrc.indexOf("'猎人': (ctx, params) =>");
    const hunterSection = aiPromptsSrc.slice(hunterStart, hunterStart + 800);
    return hunterSection.includes('【追加示例】') && hunterSection.includes('开枪备选');
});

// === 输出结果 ===
console.log('\n=== Round 24 测试结果 ===\n');
results.forEach(r => console.log(r));
console.log(`\n总计: ${passed + failed} 项测试，✅ ${passed} 通过，❌ ${failed} 失败`);
if (failed > 0) process.exit(1);
