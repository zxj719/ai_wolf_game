/**
 * Round 91 Tests: 守卫两连平安夜二阶推断
 * T1-T20: 验证 isConsecutivePeacefulGuard + consecutivePeaceHintGuard 实现
 *
 * 守卫独有优势：guardHistory 直接记录每夜守护目标，可精确判断"连守同一目标"或"轮换目标"
 * 与村民/预言家/狼人的两连推断相比，守卫无需间接推断——N-2 守护目标直接从 guardHistory 读取
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

const guardBlockStart = src.indexOf("'守卫': (ctx, params) =>");
const guardBlockEnd = src.indexOf("'村民': (ctx, params)", guardBlockStart);
const guardBlock = src.slice(guardBlockStart, guardBlockEnd);
const guardReturnStart = guardBlock.indexOf('return `');
const guardVarBlock = guardBlock.slice(0, guardReturnStart);
const guardReturnBlock = guardBlock.slice(guardReturnStart);

// T1-T4: isConsecutivePeacefulGuard 声明（外层，在 if 块之前）
test('T1: isConsecutivePeacefulGuard 在 guardVarBlock 中声明', () => {
    expect(guardVarBlock).toContain('isConsecutivePeacefulGuard');
});

test('T2: isConsecutivePeacefulGuard 使用 ctx.dayCount >= 3 条件', () => {
    const consIdx = guardVarBlock.indexOf('isConsecutivePeacefulGuard');
    const declSection = guardVarBlock.slice(consIdx, consIdx + 200);
    expect(declSection).toContain('ctx.dayCount >= 3');
});

test('T3: isConsecutivePeacefulGuard 使用 fullGameTimeline 检测历史平安夜', () => {
    const consIdx = guardVarBlock.indexOf('isConsecutivePeacefulGuard');
    const declSection = guardVarBlock.slice(consIdx, consIdx + 200);
    expect(declSection).toContain('ctx.fullGameTimeline');
    expect(declSection).toContain(':平安夜');
});

test('T4: isConsecutivePeacefulGuard 声明在 if (isPeacefulNightGuard) 块之前', () => {
    const consIdx = guardVarBlock.indexOf('isConsecutivePeacefulGuard');
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    expect(consIdx).toBeGreaterThan(-1);
    expect(ifGuardStart).toBeGreaterThan(-1);
    expect(consIdx).toBeLessThan(ifGuardStart);
});

// T5-T7: if 块内新增变量（prevPrevDay, prevPrevNightGuardTarget, consecutivePeaceHintGuard）
test('T5: if 块内声明 prevPrevDay = ctx.dayCount - 2', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 400);
    expect(ifSection).toContain('prevPrevDay');
    expect(ifSection).toContain('ctx.dayCount - 2');
});

test('T6: prevPrevNightGuardTarget 使用 guardHistory.find() 查找 N-2 守护目标', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 400);
    expect(ifSection).toContain('prevPrevNightGuardTarget');
    expect(ifSection).toContain('guardHistory?.find');
    expect(ifSection).toContain('targetId');
});

test('T7: consecutivePeaceHintGuard 三元表达式在 if 块内声明', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 600);
    expect(ifSection).toContain('consecutivePeaceHintGuard');
    expect(ifSection).toContain('isConsecutivePeacefulGuard');
});

// T8-T14: consecutivePeaceHintGuard 内容验证
test('T8: consecutivePeaceHintGuard 包含两连推断标识头 ⭕【守卫两连平安夜二阶推断', () => {
    expect(guardVarBlock).toContain('⭕【守卫两连平安夜二阶推断');
});

test('T9: consecutivePeaceHintGuard 头部包含 thought 和 speech 指令', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintHeader = guardVarBlock.slice(hintStart, hintStart + 120);
    expect(hintHeader).toContain('thought');
    expect(hintHeader).toContain('speech');
});

test('T10: consecutivePeaceHintGuard 包含路径A（连守同一目标）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 500);
    expect(hintContent).toContain('路径A');
    expect(hintContent).toContain('连守同一目标');
});

test('T11: consecutivePeaceHintGuard 包含路径B（守护目标不同）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 700);
    expect(hintContent).toContain('路径B');
    expect(hintContent).toContain('守护目标不同');
});

test('T12: consecutivePeaceHintGuard 引用 prevPrevDay 和 lastGuardTarget 模板变量', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 700);
    expect(hintContent).toContain('${prevPrevDay}');
    expect(hintContent).toContain('${lastGuardTarget}');
});

test('T13: consecutivePeaceHintGuard 包含 identity_table 追加指令', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 800);
    expect(hintContent).toContain('identity_table 追加');
});

test('T14: consecutivePeaceHintGuard 路径A 包含 confidence 升 25-35（两连命中高可信度）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 600);
    expect(hintContent).toContain('confidence 升 25-35');
});

// T15-T16: 与原有 guardPeaceNightStep 的集成
test('T15: guardPeaceNightStep 赋值使用 ${consecutivePeaceHintGuard} 前置拼接模式', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1600);
    // 验证赋值形式：guardPeaceNightStep = `${consecutivePeaceHintGuard}⭕【守卫平安夜推断`
    expect(ifSection).toContain('guardPeaceNightStep = `${consecutivePeaceHintGuard}⭕【守卫平安夜推断');
});

test('T16: 原 守卫平安夜推断内容保留（命中推断 + 未中推断 + confidence 升 15-25）', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 1700);
    expect(ifSection).toContain('⭕【守卫平安夜推断（thought 中完成；speech 按普通村民发言，不提守护细节）】');
    expect(ifSection).toContain('命中推断');
    expect(ifSection).toContain('未中推断');
    expect(ifSection).toContain('confidence 升 15-25');
});

// T17-T18: 条件化行为验证（非两连情况降级为空字符串）
test('T17: consecutivePeaceHintGuard 三元 false 分支为空字符串（非两连时无附加内容）', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    // Find the ternary false branch (`: ''`)
    const hintStart = guardVarBlock.indexOf('consecutivePeaceHintGuard', ifGuardStart);
    const ternarySection = guardVarBlock.slice(hintStart, hintStart + 1100);
    expect(ternarySection).toContain(": '';");
});

test('T18: consecutivePeaceHintGuard 条件要求 isConsecutivePeacefulGuard && lastGuardTarget !== null', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const hintDeclStart = guardVarBlock.indexOf('consecutivePeaceHintGuard', ifGuardStart);
    const declSection = guardVarBlock.slice(hintDeclStart, hintDeclStart + 120);
    expect(declSection).toContain('isConsecutivePeacefulGuard');
    expect(declSection).toContain('lastGuardTarget !== null');
});

// T19: 白熊效应合规验证
test('T19: consecutivePeaceHintGuard 内容无负向禁词（白熊效应合规）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫两连平安夜二阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 900);
    expect(hintContent).not.toContain('不要');
    expect(hintContent).not.toContain('禁止');
    expect(hintContent).not.toContain('绝不能');
});

// T20: 块大小验证
test('T20: 守卫 DAY_SPEECH 块大小在预期范围内（R91 后 5471 chars）', () => {
    expect(guardBlock.length).toBeGreaterThan(5000);
    expect(guardBlock.length).toBeLessThan(6500);
});
