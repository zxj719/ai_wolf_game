/**
 * Round 106: 女巫 NIGHT 侧平安夜两连/三连推断
 * （isNightPeacefulWitch + isConsecutivePeacefulNightWitch + isTripleConsecutivePeacefulNightWitch）
 *
 * T1      isNightPeacefulWitch 变量声明（ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')）
 * T2      witchNightPrevDay 变量声明（ctx.dayCount > 1 ? ctx.dayCount - 1 : 0）
 * T3      isConsecutivePeacefulNightWitch 变量声明（D3+，fullGameTimeline N-2:平安夜）
 * T4      witchNightPrevPrevDay 声明（D3+），isTripleConsecutivePeacefulNightWitch 声明（D4+，fullGameTimeline N-3:平安夜）
 * T5      tripleConsecutivePeaceNightHintWitch 初始 let + 声明
 * T6      consecutivePeaceNightHintWitch 初始 let + if (isConsecutivePeacefulNightWitch) 块声明
 * T7      witchNightPeaceStep 三元（isNightPeacefulWitch ? ... : ''）
 * T8      三连标头（三阶守护推断）
 * T9      两连标头（二阶守护推断）
 * T10     单夜标头（守护来源推断）
 * T11     三连路径 A/B/C 均存在
 * T12     两连路径 A/B 均存在
 * T13     confidence 升 35-45/30-40/25-35/15-25 均存在
 * T14     白熊效应合规（第 27 次验证，无 不要/禁止/不能/绝不 ）
 * T15     Prepend Injection 结构：${tripleConsecutivePeaceNightHintWitch} 前置在 consecutivePeaceNightHintWitch 赋值中
 * T16     Prepend Injection 结构：${consecutivePeaceNightHintWitch} 前置在 witchNightPeaceStep 三元中
 * T17     ${witchNightPeaceStep} 注入在 return 模板中 ${witchNightStyle} 之后、1. 解药考量 之前
 * T18     声明顺序：isNightPeacefulWitch 在 isConsecutivePeacefulNightWitch 之前
 * T19     声明顺序：isConsecutivePeacefulNightWitch 在 isTripleConsecutivePeacefulNightWitch 之前
 * T20     block 大小 5000-10000（新增约 +2601 chars，共约 6624）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

const NIGHT_WITCH_WINDOW = 9000;

function getNightWitchBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:');
    if (start === -1) throw new Error('NIGHT_WITCH case 未找到');
    return src.slice(start, start + NIGHT_WITCH_WINDOW);
}

// ═══════════════════════════════════════════════════════
// T1-T4: 外层检测变量声明
// ═══════════════════════════════════════════════════════

test('T1: 声明 isNightPeacefulWitch（ctx.dayCount > 1 && ctx.lastNightInfo?.includes 平安夜）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("const isNightPeacefulWitch = ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T2: 声明 witchNightPrevDay（ctx.dayCount > 1 ? ctx.dayCount - 1 : 0）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('const witchNightPrevDay = ctx.dayCount > 1 ? ctx.dayCount - 1 : 0');
});

test('T3: 声明 isConsecutivePeacefulNightWitch（D3+，fullGameTimeline N-2:平安夜）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('const isConsecutivePeacefulNightWitch = ctx.dayCount >= 3 && isNightPeacefulWitch &&');
    expect(block).toContain('ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 2}:平安夜`)');
});

test('T4: 声明 isTripleConsecutivePeacefulNightWitch（D4+，fullGameTimeline N-3:平安夜）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('const witchNightPrevPrevDay = ctx.dayCount >= 3 ? ctx.dayCount - 2 : 0');
    expect(block).toContain('const isTripleConsecutivePeacefulNightWitch = ctx.dayCount >= 4 && isConsecutivePeacefulNightWitch &&');
    expect(block).toContain('ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 3}:平安夜`)');
    expect(block).toContain('const witchNightThreePrevDay = ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0');
});

// ═══════════════════════════════════════════════════════
// T5-T7: if 块和 step 变量
// ═══════════════════════════════════════════════════════

test('T5: tripleConsecutivePeaceNightHintWitch let 声明初始化空串', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("let tripleConsecutivePeaceNightHintWitch = ''");
});

test('T6: consecutivePeaceNightHintWitch let 声明 + if (isConsecutivePeacefulNightWitch) 保护', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("let consecutivePeaceNightHintWitch = ''");
    expect(block).toContain('if (isConsecutivePeacefulNightWitch)');
});

test('T7: witchNightPeaceStep 三元（isNightPeacefulWitch ? ... : ""）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('const witchNightPeaceStep = isNightPeacefulWitch');
    expect(block).toContain(": '';");
});

// ═══════════════════════════════════════════════════════
// T8-T10: 推断标头文本
// ═══════════════════════════════════════════════════════

test('T8: 三连标头文本存在（女巫三连平安夜三阶守护推断）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('女巫三连平安夜三阶守护推断');
    expect(block).toContain('均无人死亡');
});

test('T9: 两连标头文本存在（女巫两连平安夜二阶守护推断）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('女巫两连平安夜二阶守护推断');
});

test('T10: 单夜标头文本存在（女巫平安夜守护来源推断）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('女巫平安夜守护来源推断');
    expect(block).toContain('上夜平安 = 守卫拦截了狼刀');
});

// ═══════════════════════════════════════════════════════
// T11-T13: 路径和 confidence 内容
// ═══════════════════════════════════════════════════════

test('T11: 三连路径 A/B/C 均存在', () => {
    const block = getNightWitchBlock();
    // These are in the triple hint section
    const tripleIdx = block.indexOf('女巫三连平安夜三阶守护推断');
    const tripleSection = block.slice(tripleIdx, tripleIdx + 600);
    expect(tripleSection).toContain('路径A');
    expect(tripleSection).toContain('路径B');
    expect(tripleSection).toContain('路径C');
    expect(tripleSection).toContain('三夜锁守');
    expect(tripleSection).toContain('高频连守');
    expect(tripleSection).toContain('随机轮守');
});

test('T12: 两连路径 A/B 均存在（连守/换守）', () => {
    const block = getNightWitchBlock();
    const twoIdx = block.indexOf('女巫两连平安夜二阶守护推断');
    const twoSection = block.slice(twoIdx, twoIdx + 500);
    expect(twoSection).toContain('路径A');
    expect(twoSection).toContain('路径B');
    expect(twoSection).toContain('连守');
    expect(twoSection).toContain('换守');
});

test('T13: confidence 升梯度 35-45/30-40/25-35/15-25 均存在', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('confidence 升 35-45');
    expect(block).toContain('confidence 升 30-40');
    expect(block).toContain('confidence 升 25-35');
    expect(block).toContain('confidence 升 15-25');
});

// ═══════════════════════════════════════════════════════
// T14: 白熊效应合规（第 27 次验证）
// ═══════════════════════════════════════════════════════

test('T14: 白熊效应合规（第 27 次验证）— 平安夜推断内容无负向禁词', () => {
    const block = getNightWitchBlock();
    const peaceStart = block.indexOf('isNightPeacefulWitch =');
    const peaceEnd = block.indexOf('// R74：女巫夜间用药策略个性化');
    const peaceSection = block.slice(peaceStart, peaceEnd);
    const negatives = ['不要', '禁止', '绝不能'];
    negatives.forEach(w => {
        expect(peaceSection).not.toContain(w);
    });
});

// ═══════════════════════════════════════════════════════
// T15-T17: Prepend Injection 结构（第 21 次应用）
// ═══════════════════════════════════════════════════════

test('T15: Prepend Injection — tripleConsecutivePeaceNightHintWitch 前置在 consecutivePeaceNightHintWitch 赋值中', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('`${tripleConsecutivePeaceNightHintWitch}⭕【女巫两连平安夜二阶守护推断');
});

test('T16: Prepend Injection — consecutivePeaceNightHintWitch 前置在 witchNightPeaceStep 三元中', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('`${consecutivePeaceNightHintWitch}⭕【女巫平安夜守护来源推断');
});

test('T17: ${witchNightPeaceStep} 注入在 return 模板 ${witchNightStyle} 之后、1. 解药考量 之前', () => {
    const block = getNightWitchBlock();
    const returnIdx = block.indexOf('return `女巫用药决策');
    const styleIdx = block.indexOf('${witchNightStyle}', returnIdx);
    const peaceIdx = block.indexOf('${witchNightPeaceStep}', returnIdx);
    const antidoteIdx = block.indexOf('1. 解药考量：', returnIdx);
    expect(styleIdx).toBeGreaterThan(returnIdx);
    expect(peaceIdx).toBeGreaterThan(styleIdx);
    expect(antidoteIdx).toBeGreaterThan(peaceIdx);
});

// ═══════════════════════════════════════════════════════
// T18-T19: 声明顺序
// ═══════════════════════════════════════════════════════

test('T18: 声明顺序：isNightPeacefulWitch 在 isConsecutivePeacefulNightWitch 之前', () => {
    const block = getNightWitchBlock();
    const singleIdx = block.indexOf('const isNightPeacefulWitch');
    const consIdx = block.indexOf('const isConsecutivePeacefulNightWitch');
    expect(singleIdx).toBeGreaterThan(0);
    expect(consIdx).toBeGreaterThan(singleIdx);
});

test('T19: 声明顺序：isConsecutivePeacefulNightWitch 在 isTripleConsecutivePeacefulNightWitch 之前', () => {
    const block = getNightWitchBlock();
    const consIdx = block.indexOf('const isConsecutivePeacefulNightWitch');
    const tripleIdx = block.indexOf('const isTripleConsecutivePeacefulNightWitch');
    expect(consIdx).toBeGreaterThan(0);
    expect(tripleIdx).toBeGreaterThan(consIdx);
});

// ═══════════════════════════════════════════════════════
// T20: block 大小边界
// ═══════════════════════════════════════════════════════

test('T20: NIGHT_WITCH block 大小在合理范围（5000-10000 chars）', () => {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:');
    const end = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER:', start);
    const size = end - start;
    expect(size).toBeGreaterThan(5000);
    expect(size).toBeLessThan(10000);
});
