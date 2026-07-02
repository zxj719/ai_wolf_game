/**
 * Round 105 tests: 女巫 DAY_SPEECH 三连平安夜三阶推断（isTripleConsecutivePeacefulWitch）
 *
 * 验证 R82（单夜）+ R92（两连）基础上新增的三连推断：
 * T1-T4   isTripleConsecutivePeacefulWitch 外层变量（D4+ / 依赖 isConsecutive / fullGameTimeline N-3）
 * T5-T7   if 块内变量（threePrevDay / tripleConsecutivePeaceHintWitch 三元 / 空串 fallback）
 * T8-T13  内容验证（三连标头 / 路径A/B/C / confidence 35-45/30-40 / identity_table）
 * T14     白熊效应合规（第 26 次验证，无负向禁词）
 * T15-T17 Prepend Injection 结构（false 分支为空串 / ${tripleConsecutivePeaceHintWitch} 存在 / 超集激活原则）
 * T18-T19 声明顺序（三连在两连之后 / R92 两连回归保留）
 * T20     block 大小（6500-9000）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf8');

const witchFuncMarkerIdx = src.lastIndexOf("'女巫': (ctx, params) => {");
// window 12000 — 女巫函数体约 6835 chars after R105，保留大量余量
const witchFuncBlock = src.slice(witchFuncMarkerIdx, witchFuncMarkerIdx + 12000);

const witchReturnIdx = witchFuncBlock.indexOf('return `');
const witchVarDeclBlock = witchFuncBlock.slice(0, witchReturnIdx);

// ── 定位 R105 区块 ───────────────────────────────────────
const r105Start = witchVarDeclBlock.indexOf('// R105');

// ── 定位 if 块 ───────────────────────────────────────────
const ifStart = witchVarDeclBlock.indexOf('if (isPeacefulNightWitch)');
const ifSection = witchVarDeclBlock.slice(ifStart);

// ══════════════════════════════════════════════════════════════
// T1-T4: isTripleConsecutivePeacefulWitch 外层变量
// ══════════════════════════════════════════════════════════════

test('T1: 女巫 DAY_SPEECH 函数 marker 存在', () => {
    expect(witchFuncMarkerIdx).toBeGreaterThan(-1);
});

test('T2: isTripleConsecutivePeacefulWitch 在 var block 中声明', () => {
    expect(witchVarDeclBlock).toContain('isTripleConsecutivePeacefulWitch');
});

test('T3: isTripleConsecutivePeacefulWitch 条件包含 dayCount >= 4 且依赖 isConsecutivePeacefulWitch', () => {
    const tripleDecl = witchVarDeclBlock.slice(
        witchVarDeclBlock.indexOf('isTripleConsecutivePeacefulWitch'),
        witchVarDeclBlock.indexOf(';', witchVarDeclBlock.indexOf('isTripleConsecutivePeacefulWitch')) + 1
    );
    expect(tripleDecl).toContain('ctx.dayCount >= 4');
    expect(tripleDecl).toContain('isConsecutivePeacefulWitch');
});

test('T4: isTripleConsecutivePeacefulWitch 使用 fullGameTimeline N-3 检测', () => {
    const tripleDecl = witchVarDeclBlock.slice(
        witchVarDeclBlock.indexOf('isTripleConsecutivePeacefulWitch'),
        witchVarDeclBlock.indexOf(';', witchVarDeclBlock.indexOf('isTripleConsecutivePeacefulWitch')) + 1
    );
    expect(tripleDecl).toContain('fullGameTimeline');
    expect(tripleDecl).toContain('dayCount - 3');
    expect(tripleDecl).toContain('平安夜');
});

// ══════════════════════════════════════════════════════════════
// T5-T7: if 块内变量
// ══════════════════════════════════════════════════════════════

test('T5: if 块内 threePrevDay 声明（dayCount >= 4 条件化）', () => {
    expect(ifSection).toContain('threePrevDay');
    // 检查三元条件化
    const threePrevDayDecl = ifSection.slice(
        ifSection.indexOf('threePrevDay'),
        ifSection.indexOf(';', ifSection.indexOf('threePrevDay')) + 1
    );
    expect(threePrevDayDecl).toContain('dayCount >= 4');
    expect(threePrevDayDecl).toContain('dayCount - 3');
    expect(threePrevDayDecl).toContain('0');
});

test('T6: if 块内 tripleConsecutivePeaceHintWitch 三元声明（isTripleConsecutivePeacefulWitch 激活）', () => {
    expect(ifSection).toContain('tripleConsecutivePeaceHintWitch');
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 120);
    expect(tripleHintBlock).toContain('isTripleConsecutivePeacefulWitch');
});

test('T7: tripleConsecutivePeaceHintWitch false 分支为空字符串', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    // Find the ternary false branch (': \'\';')
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain(": '';");
});

// ══════════════════════════════════════════════════════════════
// T8-T13: 内容验证
// ══════════════════════════════════════════════════════════════

test('T8: tripleConsecutivePeaceHintWitch 含三连标头（N+N+N均无死亡）', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('三连平安夜三阶推断');
    expect(tripleHintBlock).toContain('均无死亡');
});

test('T9: 路径A含 confidence 升 35-45（三夜相同锁守）', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('路径A');
    expect(tripleHintBlock).toContain('35-45');
});

test('T10: 路径B含 confidence 升 30-40（两夜相同+一夜不同）', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('路径B');
    expect(tripleHintBlock).toContain('30-40');
    expect(tripleHintBlock).toContain('两夜相同');
});

test('T11: 路径C含"轮守无固定模式"（三夜各不同回退单夜框架）', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('路径C');
    expect(tripleHintBlock).toContain('按单夜');
});

test('T12: tripleConsecutivePeaceHintWitch 含 identity_table 追加指导', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('identity_table');
    expect(tripleHintBlock).toContain('三连平安夜');
});

test('T13: tripleConsecutivePeaceHintWitch 含 D{threePrevDay} 日期引用', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    expect(tripleHintBlock).toContain('${threePrevDay}');
});

// ══════════════════════════════════════════════════════════════
// T14: 白熊效应合规（第 26 次验证）
// ══════════════════════════════════════════════════════════════

test('T14: 白熊效应合规——三连内容全正向，无负向禁词', () => {
    const tripleHintIdx = ifSection.indexOf('const tripleConsecutivePeaceHintWitch');
    const tripleHintBlock = ifSection.slice(tripleHintIdx, tripleHintIdx + 800);
    // 正向描述验证
    expect(tripleHintBlock).toContain('confidence 升 35-45');
    // 无负向禁词
    expect(tripleHintBlock).not.toContain('不要');
    expect(tripleHintBlock).not.toContain('禁止');
    expect(tripleHintBlock).not.toContain('绝不能');
    expect(tripleHintBlock).not.toContain('切勿');
});

// ══════════════════════════════════════════════════════════════
// T15-T17: Prepend Injection 结构（第 20 次应用）
// ══════════════════════════════════════════════════════════════

test('T15: consecutivePeaceHintWitch 存在 ${tripleConsecutivePeaceHintWitch} 前置注入', () => {
    expect(ifSection).toContain('${tripleConsecutivePeaceHintWitch}');
    // 确认在 consecutivePeaceHintWitch 的 true 分支中
    const consecutiveIdx = ifSection.indexOf('const consecutivePeaceHintWitch');
    const consecutiveBlock = ifSection.slice(consecutiveIdx, consecutiveIdx + 200);
    expect(consecutiveBlock).toContain('${tripleConsecutivePeaceHintWitch}');
});

test('T16: ${tripleConsecutivePeaceHintWitch} 在 ⭕【女巫连续两夜 之前（prepend 顺序）', () => {
    const consecutiveIdx = ifSection.indexOf('const consecutivePeaceHintWitch');
    const consecutiveBlock = ifSection.slice(consecutiveIdx, consecutiveIdx + 200);
    const triplePos = consecutiveBlock.indexOf('${tripleConsecutivePeaceHintWitch}');
    const twoConnectPos = consecutiveBlock.indexOf('⭕【女巫连续两夜');
    expect(triplePos).toBeGreaterThan(-1);
    expect(twoConnectPos).toBeGreaterThan(-1);
    expect(triplePos).toBeLessThan(twoConnectPos);
});

test('T17: 超集激活原则——isConsecutivePeacefulWitch false 时 consecutivePeaceHintWitch 为空串', () => {
    const consecutiveIdx = ifSection.indexOf('const consecutivePeaceHintWitch');
    const consecutiveBlock = ifSection.slice(consecutiveIdx, consecutiveIdx + 600);
    // false 分支 `: ''` 存在
    expect(consecutiveBlock).toContain(": '';");
});

// ══════════════════════════════════════════════════════════════
// T18-T19: 声明顺序验证
// ══════════════════════════════════════════════════════════════

test('T18: isTripleConsecutivePeacefulWitch 在 isConsecutivePeacefulWitch 之后声明（超集顺序）', () => {
    const consecutivePos = witchVarDeclBlock.indexOf('isConsecutivePeacefulWitch');
    const triplePos = witchVarDeclBlock.indexOf('isTripleConsecutivePeacefulWitch');
    expect(consecutivePos).toBeGreaterThan(-1);
    expect(triplePos).toBeGreaterThan(-1);
    expect(triplePos).toBeGreaterThan(consecutivePos);
});

test('T19: R92 两连推断内容保留（回归）——consecutivePeaceHintWitch 仍含 ⭕【女巫连续两夜', () => {
    expect(ifSection).toContain('⭕【女巫连续两夜平安夜二阶推断');
    expect(ifSection).toContain('路径A（相同）');
    expect(ifSection).toContain('路径B（不同）');
    expect(ifSection).toContain('confidence 升 25-35');
});

// ══════════════════════════════════════════════════════════════
// T20: block 大小验证
// ══════════════════════════════════════════════════════════════

test('T20: 女巫 DAY_SPEECH 函数体大小在合理范围（6500-10000 chars）', () => {
    const witchEnd = src.indexOf("    '猎人': (ctx, params)", witchFuncMarkerIdx);
    const blockSize = witchEnd - witchFuncMarkerIdx;
    expect(blockSize).toBeGreaterThan(6500);
    expect(blockSize).toBeLessThan(10000);
});
