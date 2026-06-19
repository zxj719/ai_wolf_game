/**
 * Round 17 验证脚本：好人方 identity_table reason 字段战略化
 * 测试三处改动：
 *   T1-T5: NIGHT_SEER identity_table 夜间查验指导
 *   T6-T10: DAY_SPEECH 预言家 identity_table 差异化填写指导
 *   T11-T15: DAY_SPEECH 守卫 identity_table 守护判断指导
 *   T16: 回归检查：女巫/村民旧提示词未受影响
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dirname, '../src/services/aiPrompts.js'), 'utf-8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
            failed++;
        }
    } catch (e) {
        console.log(`❌ ${name} — THREW: ${e.message}`);
        failed++;
    }
}

// 辅助：在指定锚点字符串之后的 window 内搜索目标字符串
function findAfterAnchor(src, anchor, target, windowSize = 800) {
    const anchorIdx = src.indexOf(anchor);
    if (anchorIdx === -1) return false;
    const window = src.slice(anchorIdx, anchorIdx + windowSize);
    return window.includes(target);
}

// ─── T1-T5: NIGHT_SEER identity_table 夜间指导 ───

test('T1: NIGHT_SEER identity_table 指导块存在', () => {
    return src.includes('identity_table 填写指导（夜间查验：记录确认知识与候选优先级）');
});

test('T2: NIGHT_SEER 指导要求已查验玩家 confidence 95-100', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（夜间查验：记录确认知识与候选优先级）',
        'confidence 填 95-100');
});

test('T3: NIGHT_SEER 指导要求写"待明日报"标记', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（夜间查验：记录确认知识与候选优先级）',
        '待明日报');
});

test('T4: NIGHT_SEER 指导包含今晚查验目标 confidence 50-70', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（夜间查验：记录确认知识与候选优先级）',
        'confidence 填 50-70');
});

test('T5: NIGHT_SEER 指导在 NIGHT_WITCH case 之前（顺序正确）', () => {
    const seerGuideIdx = src.indexOf('identity_table 填写指导（夜间查验：记录确认知识与候选优先级）');
    const witchCaseIdx = src.indexOf("case PROMPT_ACTIONS.NIGHT_WITCH:");
    return seerGuideIdx !== -1 && witchCaseIdx !== -1 && seerGuideIdx < witchCaseIdx;
});

// ─── T6-T10: DAY_SPEECH '预言家' identity_table 指导 ───

test('T6: DAY_SPEECH 预言家 identity_table 差异化指导块存在', () => {
    return src.includes('identity_table 填写指导（预言家有确定性知识，应差异化填写）');
});

test('T7: 预言家指导要求已查验玩家 confidence 95-100', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（预言家有确定性知识，应差异化填写）',
        'confidence 填 95-100');
});

test('T8: 预言家指导包含"N[X]夜查验确认"格式示例', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（预言家有确定性知识，应差异化填写）',
        'N[X]夜查验确认');
});

test('T9: 预言家指导涵盖悍跳嫌疑场景', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（预言家有确定性知识，应差异化填写）',
        '悍跳攻预嫌疑');
});

test('T10: 预言家指导位于 DAY_SPEECH 函数内（在 voteDecided 说明之前）', () => {
    const guideIdx = src.indexOf('identity_table 填写指导（预言家有确定性知识，应差异化填写）');
    // 预言家函数以 '\'预言家\': (ctx, params) =>' 开头
    const seerFnIdx = src.indexOf("'预言家': (ctx, params) =>");
    const witchFnIdx = src.indexOf("'女巫': (ctx, params) =>");
    return guideIdx > seerFnIdx && guideIdx < witchFnIdx;
});

// ─── T11-T15: DAY_SPEECH '守卫' identity_table 指导 ───

test('T11: DAY_SPEECH 守卫 identity_table 指导块存在', () => {
    return src.includes('identity_table 填写指导（记录守护判断以提升夜间决策连贯性）');
});

test('T12: 守卫指导包含守护结果记录格式', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（记录守护判断以提升夜间决策连贯性）',
        'N[X]夜守护，结果');
});

test('T13: 守卫指导包含守护候选神职识别', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（记录守护判断以提升夜间决策连贯性）',
        '守护优先级高');
});

test('T14: 守卫指导包含高度可疑狼人标记', () => {
    return findAfterAnchor(src, 'identity_table 填写指导（记录守护判断以提升夜间决策连贯性）',
        '投票怀疑对象');
});

test('T15: 守卫指导在守卫 DAY_SPEECH 函数内（在女巫函数之后）', () => {
    const guideIdx = src.indexOf('identity_table 填写指导（记录守护判断以提升夜间决策连贯性）');
    const witchFnIdx = src.indexOf("'女巫': (ctx, params) =>");
    const villagerFnIdx = src.indexOf("'村民': (ctx, params) =>");
    return guideIdx > witchFnIdx && guideIdx < villagerFnIdx;
});

// ─── T16: 回归检查 ───

test('T16: 女巫 DAY_SPEECH 原有药水指导未丢失', () => {
    return src.includes('【女巫专属任务】白天发言 - 隐藏身份/关键时刻跳');
});

test('T17: NIGHT_WOLF identity_table 战略指导（R16）未受影响', () => {
    return src.includes('identity_table 战略用途（你已知所有人真实身份）');
});

test('T18: DAY_SPEECH 狼人 identity_table 日间策略（R16）未受影响', () => {
    return src.includes('identity_table 填写策略（日间公开视角，但 reason 可记录私有战略注记）');
});

// ─── 总结 ───
console.log(`\n总计：${passed + failed} 项，通过 ${passed}，失败 ${failed}`);
process.exit(failed > 0 ? 1 : 0);
