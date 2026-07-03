/**
 * Round 107: 摄梦人 NIGHT 侧平安夜双来源推断（dream immunity vs guard/witch）
 * （isNightPeacefulDW + isConsecutivePeacefulNightDW + isTripleConsecutivePeacefulNightDW）
 *
 * T1      isNightPeacefulDW 变量声明（ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')）
 * T2      dwNightPrevDay 变量声明（ctx.dayCount > 1 ? ctx.dayCount - 1 : 0）
 * T3      isConsecutivePeacefulNightDW 声明（D3+，fullGameTimeline N-2:平安夜）
 * T4      dwNightPrevPrevDay + isTripleConsecutivePeacefulNightDW + dwNightThreePrevDay（D4+，fullGameTimeline N-3:平安夜）
 * T5      tripleConsecutivePeaceNightHintDW let 声明初始化空串
 * T6      consecutivePeaceNightHintDW let 声明 + if (isConsecutivePeacefulNightDW) 保护块
 * T7      dwNightPeaceStep 三元（isNightPeacefulDW ? ... : ''）
 * T8      三连标头（三阶双来源推断）
 * T9      两连标头（二阶双来源推断）
 * T10     单夜标头（摄梦人平安夜双来源推断）
 * T11     三连路径 A/B/C 均存在
 * T12     两连路径 A/B 均存在
 * T13     单夜来源 A/B 均存在（双来源推断）
 * T14     confidence 升 35-45/25-35/20-30 梯度均存在
 * T15     白熊效应合规（第 28 次验证，无 不要/禁止/绝不 ）
 * T16     Prepend Injection 结构：${tripleConsecutivePeaceNightHintDW} 前置在 consecutivePeaceNightHintDW 赋值中
 * T17     Prepend Injection 结构：${consecutivePeaceNightHintDW} 前置在 dwNightPeaceStep 三元中
 * T18     ${dwNightPeaceStep} 注入在 return 模板中 ${dreamweaverNightStyle} 之后、Step1: 之前
 * T19     声明顺序：isNightPeacefulDW 在 isConsecutivePeacefulNightDW 之前
 * T20     block 大小 7000-11000（新增约 +2625 chars，共约 8037）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

const NIGHT_DW_WINDOW = 9000;

function getNightDWBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
    if (start === -1) throw new Error('NIGHT_DREAMWEAVER case 未找到');
    return src.slice(start, start + NIGHT_DW_WINDOW);
}

// ═══════════════════════════════════════════════════════
// T1-T4: 外层检测变量声明
// ═══════════════════════════════════════════════════════

test('T1: 声明 isNightPeacefulDW（ctx.dayCount > 1 && ctx.lastNightInfo?.includes 平安夜）', () => {
    const block = getNightDWBlock();
    expect(block).toContain("const isNightPeacefulDW = ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T2: 声明 dwNightPrevDay（ctx.dayCount > 1 ? ctx.dayCount - 1 : 0）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('const dwNightPrevDay = ctx.dayCount > 1 ? ctx.dayCount - 1 : 0');
});

test('T3: 声明 isConsecutivePeacefulNightDW（D3+，fullGameTimeline N-2:平安夜）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('const isConsecutivePeacefulNightDW = ctx.dayCount >= 3 && isNightPeacefulDW &&');
    expect(block).toContain('ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 2}:平安夜`)');
});

test('T4: 声明 isTripleConsecutivePeacefulNightDW（D4+，fullGameTimeline N-3:平安夜）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('const dwNightPrevPrevDay = ctx.dayCount >= 3 ? ctx.dayCount - 2 : 0');
    expect(block).toContain('const isTripleConsecutivePeacefulNightDW = ctx.dayCount >= 4 && isConsecutivePeacefulNightDW &&');
    expect(block).toContain('ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 3}:平安夜`)');
    expect(block).toContain('const dwNightThreePrevDay = ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0');
});

// ═══════════════════════════════════════════════════════
// T5-T7: if 块和 step 变量
// ═══════════════════════════════════════════════════════

test('T5: tripleConsecutivePeaceNightHintDW let 声明初始化空串', () => {
    const block = getNightDWBlock();
    expect(block).toContain("let tripleConsecutivePeaceNightHintDW = ''");
});

test('T6: consecutivePeaceNightHintDW let 声明 + if (isConsecutivePeacefulNightDW) 保护', () => {
    const block = getNightDWBlock();
    expect(block).toContain("let consecutivePeaceNightHintDW = ''");
    expect(block).toContain('if (isConsecutivePeacefulNightDW)');
});

test('T7: dwNightPeaceStep 三元表达式（isNightPeacefulDW ? ... : ""）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('const dwNightPeaceStep = isNightPeacefulDW');
    expect(block).toContain(": '';");
});

// ═══════════════════════════════════════════════════════
// T8-T10: 推断标头文本
// ═══════════════════════════════════════════════════════

test('T8: 三连推断标头（三阶双来源推断）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('三连平安夜三阶双来源推断');
});

test('T9: 两连推断标头（二阶双来源推断）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('两连平安夜二阶双来源推断');
});

test('T10: 单夜推断标头（摄梦人平安夜双来源推断）', () => {
    const block = getNightDWBlock();
    expect(block).toContain('摄梦人平安夜双来源推断');
    expect(block).toContain('无人死亡');
});

// ═══════════════════════════════════════════════════════
// T11-T13: 路径内容
// ═══════════════════════════════════════════════════════

test('T11: 三连路径 A/B/C 均存在', () => {
    const block = getNightDWBlock();
    const tripleStart = block.indexOf('三连平安夜三阶双来源推断');
    const tripleSection = block.slice(tripleStart, tripleStart + 800);
    expect(tripleSection).toContain('路径A');
    expect(tripleSection).toContain('路径B');
    expect(tripleSection).toContain('路径C');
});

test('T12: 两连路径 A/B 均存在', () => {
    const block = getNightDWBlock();
    const twoStart = block.indexOf('两连平安夜二阶双来源推断');
    const twoSection = block.slice(twoStart, twoStart + 600);
    expect(twoSection).toContain('路径A');
    expect(twoSection).toContain('路径B');
});

test('T13: 单夜来源 A/B 双来源推断均存在', () => {
    const block = getNightDWBlock();
    const singleStart = block.indexOf('摄梦人平安夜双来源推断');
    const singleSection = block.slice(singleStart, singleStart + 800);
    expect(singleSection).toContain('来源A');
    expect(singleSection).toContain('来源B');
    expect(singleSection).toContain('入梦免疫拦截');
    expect(singleSection).toContain('守卫/女巫保护生效');
});

// ═══════════════════════════════════════════════════════
// T14: confidence 梯度
// ═══════════════════════════════════════════════════════

test('T14: confidence 升 35-45（三连）/25-35（两连）/20-30（单夜）梯度均存在', () => {
    const block = getNightDWBlock();
    expect(block).toContain('confidence 升 35-45');
    expect(block).toContain('confidence 升 25-35');
    expect(block).toContain('confidence 升 20-30');
});

// ═══════════════════════════════════════════════════════
// T15: 白熊效应合规（第 28 次验证）
// ═══════════════════════════════════════════════════════

test('T15: 白熊效应合规（第 28 次验证）— 三层内容无负向禁词', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
    const end = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE:', start);
    const block = src.slice(start, end);
    const r107Start = block.indexOf('R107');
    const r107Section = block.slice(r107Start);
    expect(r107Section).not.toMatch(/不要(?!覆盖)/);
    expect(r107Section).not.toContain('禁止');
    expect(r107Section).not.toContain('绝不能');
});

// ═══════════════════════════════════════════════════════
// T16-T17: Prepend Injection 结构（第 22 次应用）
// ═══════════════════════════════════════════════════════

test('T16: Prepend Injection 第 22 次 — tripleHint 前置在 consecutiveHint 赋值中', () => {
    const block = getNightDWBlock();
    const consIdx = block.indexOf('consecutivePeaceNightHintDW = `');
    expect(consIdx).toBeGreaterThan(-1);
    const consLine = block.slice(consIdx, consIdx + 80);
    expect(consLine).toContain('${tripleConsecutivePeaceNightHintDW}');
});

test('T17: Prepend Injection 第 22 次 — consecutiveHint 前置在 dwNightPeaceStep 三元中', () => {
    const block = getNightDWBlock();
    const stepIdx = block.indexOf('const dwNightPeaceStep = isNightPeacefulDW');
    expect(stepIdx).toBeGreaterThan(-1);
    const stepSection = block.slice(stepIdx, stepIdx + 100);
    expect(stepSection).toContain('${consecutivePeaceNightHintDW}');
});

// ═══════════════════════════════════════════════════════
// T18: Return 模板注入位置
// ═══════════════════════════════════════════════════════

test('T18: ${dwNightPeaceStep} 注入在 ${dreamweaverNightStyle} 之后、Step1: 之前', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
    const end = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE:', start);
    const block = src.slice(start, end);
    const styleIdx = block.indexOf('${dreamweaverNightStyle}');
    const peaceIdx = block.indexOf('${dwNightPeaceStep}');
    const step1Idx = block.indexOf('Step1:');
    expect(styleIdx).toBeGreaterThan(-1);
    expect(peaceIdx).toBeGreaterThan(styleIdx);
    expect(step1Idx).toBeGreaterThan(peaceIdx);
});

// ═══════════════════════════════════════════════════════
// T19: 声明顺序
// ═══════════════════════════════════════════════════════

test('T19: 声明顺序 — isNightPeacefulDW 在 isConsecutivePeacefulNightDW 之前', () => {
    const block = getNightDWBlock();
    const singleIdx = block.indexOf('const isNightPeacefulDW');
    const consIdx = block.indexOf('const isConsecutivePeacefulNightDW');
    const tripleIdx = block.indexOf('const isTripleConsecutivePeacefulNightDW');
    expect(singleIdx).toBeGreaterThan(-1);
    expect(consIdx).toBeGreaterThan(singleIdx);
    expect(tripleIdx).toBeGreaterThan(consIdx);
});

// ═══════════════════════════════════════════════════════
// T20: Block 大小边界
// ═══════════════════════════════════════════════════════

test('T20: NIGHT_DREAMWEAVER block 大小在合理范围（7000-11000 chars）', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:');
    const end = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE:', start);
    const size = end - start;
    expect(size).toBeGreaterThan(7000);
    expect(size).toBeLessThan(11000);
});
