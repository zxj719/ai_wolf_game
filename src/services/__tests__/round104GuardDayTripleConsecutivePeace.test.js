/**
 * Round 104 Tests: 守卫 DAY_SPEECH 三连平安夜三阶推断
 * T1-T20: 验证 isTripleConsecutivePeacefulGuard + tripleConsecutivePeaceHintGuard 实现
 *
 * 守卫独有优势（零间接推断）：
 * - guardHistory 直接记录每夜守护目标，无需票压代理推断
 * - 三夜刀口比对：路径A=三夜同一目标（confidence 升 35-45）/ 路径B=两夜同目标（confidence 升 30-40）/ 路径C=三夜各不同
 * - 与 NIGHT_GUARD 三连（R97）在 DAY 侧对称完成，守卫四象限推断矩阵全部封闭
 * - Prepend Injection 第 19 次应用：tripleHint 前置到 consecutivePeaceHintGuard 模板头部
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

// T1-T4: isTripleConsecutivePeacefulGuard 外层变量声明
test('T1: isTripleConsecutivePeacefulGuard 在 guardVarBlock 中声明', () => {
    expect(guardVarBlock).toContain('isTripleConsecutivePeacefulGuard');
});

test('T2: isTripleConsecutivePeacefulGuard 使用 ctx.dayCount >= 4 条件（D4+适用）', () => {
    const tripleIdx = guardVarBlock.indexOf('isTripleConsecutivePeacefulGuard');
    const declSection = guardVarBlock.slice(tripleIdx, tripleIdx + 220);
    expect(declSection).toContain('ctx.dayCount >= 4');
});

test('T3: isTripleConsecutivePeacefulGuard 依赖 isConsecutivePeacefulGuard（超集原则）', () => {
    const tripleIdx = guardVarBlock.indexOf('isTripleConsecutivePeacefulGuard');
    const declSection = guardVarBlock.slice(tripleIdx, tripleIdx + 220);
    expect(declSection).toContain('isConsecutivePeacefulGuard');
});

test('T4: isTripleConsecutivePeacefulGuard 使用 fullGameTimeline 检测 N(D-3):平安夜', () => {
    const tripleIdx = guardVarBlock.indexOf('isTripleConsecutivePeacefulGuard');
    const declSection = guardVarBlock.slice(tripleIdx, tripleIdx + 220);
    expect(declSection).toContain('ctx.fullGameTimeline');
    expect(declSection).toContain(':平安夜');
    expect(declSection).toContain('dayCount - 3');
});

// T5-T7: if 块内三连变量（threePrevDay, threeNightGuardTarget, tripleConsecutivePeaceHintGuard）
test('T5: if 块内声明 threePrevDay = ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 400);
    expect(ifSection).toContain('threePrevDay');
    expect(ifSection).toContain('ctx.dayCount >= 4');
    expect(ifSection).toContain('ctx.dayCount - 3');
});

test('T6: threeNightGuardTarget 使用 guardHistory.find() 零间接推断 N-3 守护目标', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 500);
    expect(ifSection).toContain('threeNightGuardTarget');
    expect(ifSection).toContain('guardHistory?.find');
    expect(ifSection).toContain('dayCount - 3');
    expect(ifSection).toContain('targetId');
});

test('T7: tripleConsecutivePeaceHintGuard 三元表达式在 if 块内声明', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const ifSection = guardVarBlock.slice(ifGuardStart, ifGuardStart + 600);
    expect(ifSection).toContain('tripleConsecutivePeaceHintGuard');
    expect(ifSection).toContain('isTripleConsecutivePeacefulGuard');
});

// T8-T13: tripleConsecutivePeaceHintGuard 内容验证
test('T8: tripleConsecutivePeaceHintGuard 包含三连推断标识头 ⭕【守卫三连平安夜三阶推断', () => {
    expect(guardVarBlock).toContain('⭕【守卫三连平安夜三阶推断');
});

test('T9: tripleConsecutivePeaceHintGuard 包含路径A（三夜守同一目标，confidence 升 35-45）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 500);
    expect(hintContent).toContain('路径A');
    expect(hintContent).toContain('三夜守同一目标');
    expect(hintContent).toContain('confidence 升 35-45');
});

test('T10: tripleConsecutivePeaceHintGuard 包含路径B（两夜守同目标+一夜不同，confidence 升 30-40）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 600);
    expect(hintContent).toContain('路径B');
    expect(hintContent).toContain('confidence 升 30-40');
});

test('T11: tripleConsecutivePeaceHintGuard 包含路径C（三夜各不同，回退单夜推断）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 700);
    expect(hintContent).toContain('路径C');
    expect(hintContent).toContain('三夜各不同');
    expect(hintContent).toContain('单夜');
});

test('T12: tripleConsecutivePeaceHintGuard 引用三夜守护历史模板变量（零间接推断）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 500);
    expect(hintContent).toContain('${threePrevDay}');
    expect(hintContent).toContain('${threeNightGuardTarget');
});

test('T13: tripleConsecutivePeaceHintGuard 包含 identity_table 追加指令（三路径 confidence 梯度）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 900);
    expect(hintContent).toContain('identity_table 追加');
    expect(hintContent).toContain('35-45');
    expect(hintContent).toContain('30-40');
});

// T14: 白熊效应合规验证（第 25 次验证）
test('T14: tripleConsecutivePeaceHintGuard 内容无负向禁词（白熊效应合规，第 25 次验证）', () => {
    const hintStart = guardVarBlock.indexOf('⭕【守卫三连平安夜三阶推断');
    const hintContent = guardVarBlock.slice(hintStart, hintStart + 900);
    expect(hintContent).not.toContain('不要');
    expect(hintContent).not.toContain('禁止');
    expect(hintContent).not.toContain('绝不能');
});

// T15-T17: Prepend Injection 结构验证（第 19 次应用）
test('T15: tripleConsecutivePeaceHintGuard false 分支为空字符串（非三连时无附加内容）', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const tripleHintStart = guardVarBlock.indexOf('tripleConsecutivePeaceHintGuard', ifGuardStart);
    const ternarySection = guardVarBlock.slice(tripleHintStart, tripleHintStart + 1200);
    expect(ternarySection).toContain(": '';");
});

test('T16: consecutivePeaceHintGuard 使用 ${tripleConsecutivePeaceHintGuard} 前置注入（Prepend Injection 第 19 次）', () => {
    const hintDecl = guardVarBlock.indexOf('const consecutivePeaceHintGuard');
    // ${tripleConsecutivePeaceHintGuard} starts at ~107 from decl; need window >= 141
    const declSection = guardVarBlock.slice(hintDecl, hintDecl + 180);
    expect(declSection).toContain('${tripleConsecutivePeaceHintGuard}');
    expect(declSection).toContain('⭕【守卫两连平安夜');
});

test('T17: isTripleConsecutivePeacefulGuard 条件包含 lastGuardTarget !== null（目标已知时激活）', () => {
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    const tripleHintStart = guardVarBlock.indexOf('tripleConsecutivePeaceHintGuard', ifGuardStart);
    const declSection = guardVarBlock.slice(tripleHintStart, tripleHintStart + 120);
    expect(declSection).toContain('lastGuardTarget !== null');
});

// T18-T19: 声明顺序验证（外层超集原则）
test('T18: isTripleConsecutivePeacefulGuard 声明在 isConsecutivePeacefulGuard 之后、if 块之前', () => {
    const consIdx = guardVarBlock.indexOf('isConsecutivePeacefulGuard');
    const tripleIdx = guardVarBlock.indexOf('isTripleConsecutivePeacefulGuard');
    const ifGuardStart = guardVarBlock.indexOf('if (isPeacefulNightGuard)');
    expect(tripleIdx).toBeGreaterThan(consIdx);
    expect(tripleIdx).toBeLessThan(ifGuardStart);
});

test('T19: R91 两连推断回归保留（⭕【守卫两连平安夜二阶推断 + confidence 升 25-35）', () => {
    expect(guardVarBlock).toContain('⭕【守卫两连平安夜二阶推断');
    expect(guardVarBlock).toContain('confidence 升 25-35');
});

// T20: 块大小验证
test('T20: 守卫 DAY_SPEECH 块大小在预期范围内（R104 后 6665 chars）', () => {
    expect(guardBlock.length).toBeGreaterThan(6000);
    expect(guardBlock.length).toBeLessThan(8000);
});
