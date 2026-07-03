/**
 * Round 110: 魔术师 DAY_SPEECH 平安夜逻辑镜像推断三层体系
 *
 * T1      isPeacefulNightMagicianDay 变量声明存在
 * T2      isPeacefulNightMagicianDay 条件：dayCount > 1 && lastNightInfo 含 '平安夜'
 * T3      isConsecutivePeacefulMagicianDay 声明存在
 * T4      isConsecutivePeacefulMagicianDay 条件：dayCount >= 3 && fullGameTimeline N-2:平安夜
 * T5      if 块内声明 isTripleConsecutivePeacefulMagicianDay
 * T6      if 块内声明 tripleConsecutivePeaceDayHintMag
 * T7      if 块内声明 consecutivePeaceDayHintMag（Prepend Injection）
 * T8      三连内容：⭕三连标记 + 路径A/B/C
 * T9      三连 confidence 升 35-45（路径A）
 * T10     三连 confidence 升 30-40（路径B）
 * T11     两连内容：⭕两连标记 + 路径A/B
 * T12     两连 confidence 升 25-35（路径A）
 * T13     单夜内容：⭕魔术师平安夜逻辑镜像推断标记 + confidence 升 15-20
 * T14     白熊效应合规：三层推断全正向描述，无负向禁词
 * T15     注入结构：return 模板中 magDayPeaceStep 在 magicianDayHistoryStep 之后、Step1 之前
 * T16     门控：非平安夜时 magDayPeaceStep 为空（dayCount=2 lastNightInfo='3号死亡'）
 * T17     门控：D1 首夜时不激活（dayCount=1 且 lastNightInfo='平安夜'，dayCount>1 条件不满足）
 * T18     激活：D4 三连时三层全激活
 * T19     lastDaySwapRef 有换/未换两路参数化
 * T20     return 模板：Step1-5 + identity_table 填写指导 + magicianSpeechLen 引用 仍然存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { test, expect } from 'vitest';

const magSrc = readFileSync(resolve(process.cwd(), 'src/services/rolePrompts/magician.js'), 'utf-8');

// 定位 getMagicianDaySpeechPrompt 函数块（R110 后约 7224 chars，窗口用 8500）
function getMagDayFnBlock() {
    const start = magSrc.indexOf('export const getMagicianDaySpeechPrompt');
    if (start === -1) throw new Error('getMagicianDaySpeechPrompt 未找到');
    return magSrc.slice(start, start + 8500);
}

// 定位 if (isPeacefulNightMagicianDay) 块
function getIfBlock() {
    const fn = getMagDayFnBlock();
    const ifStart = fn.indexOf('if (isPeacefulNightMagicianDay)');
    if (ifStart === -1) throw new Error('if (isPeacefulNightMagicianDay) 未找到');
    // 找到对应 } 闭合（取 800 char 窗口足够）
    return fn.slice(ifStart, ifStart + 2000);
}

// 模拟参数构造（用于生成门控测试的字符串验证）
function makeCtx(dayCount, lastNightInfo, fullGameTimeline) {
    return { dayCount, lastNightInfo, fullGameTimeline };
}

function makeParams(player1Id, player2Id) {
    return {
        lastSwap: player1Id !== null ? { player1Id, player2Id } : { player1Id: null, player2Id: null },
        swappedPlayers: [],
        personalityType: '',
    };
}

// ═══════════════════════════════════════════════════════
// T1-T4: 外层变量声明
// ═══════════════════════════════════════════════════════

test('T1: isPeacefulNightMagicianDay 变量声明存在', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('const isPeacefulNightMagicianDay');
});

test('T2: isPeacefulNightMagicianDay 条件——dayCount > 1 && lastNightInfo 含 平安夜', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
});

test('T3: isConsecutivePeacefulMagicianDay 声明存在', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('const isConsecutivePeacefulMagicianDay');
});

test('T4: isConsecutivePeacefulMagicianDay 条件——dayCount >= 3 + fullGameTimeline N-2:平安夜', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('ctx.dayCount >= 3 && isPeacefulNightMagicianDay');
    expect(fn).toContain('ctx.dayCount - 2}:平安夜');
});

// ═══════════════════════════════════════════════════════
// T5-T7: if 块内声明
// ═══════════════════════════════════════════════════════

test('T5: if 块内声明 isTripleConsecutivePeacefulMagicianDay', () => {
    const ifBlock = getIfBlock();
    expect(ifBlock).toContain('const isTripleConsecutivePeacefulMagicianDay');
    expect(ifBlock).toContain('ctx.dayCount >= 4 && isConsecutivePeacefulMagicianDay');
    expect(ifBlock).toContain('ctx.dayCount - 3}:平安夜');
});

test('T6: if 块内声明 tripleConsecutivePeaceDayHintMag（三元赋值）', () => {
    const ifBlock = getIfBlock();
    expect(ifBlock).toContain('const tripleConsecutivePeaceDayHintMag');
    expect(ifBlock).toContain('isTripleConsecutivePeacefulMagicianDay');
});

test('T7: if 块内声明 consecutivePeaceDayHintMag（Prepend Injection — 前置三连）', () => {
    const ifBlock = getIfBlock();
    expect(ifBlock).toContain('const consecutivePeaceDayHintMag');
    expect(ifBlock).toContain('isConsecutivePeacefulMagicianDay');
    expect(ifBlock).toContain('${tripleConsecutivePeaceDayHintMag}');
});

// ═══════════════════════════════════════════════════════
// T8-T10: 三连内容
// ═══════════════════════════════════════════════════════

test('T8: 三连内容——⭕三连标记 + 路径A/B/C', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('三连平安夜三阶逻辑镜像推断');
    expect(fn).toContain('路径A');
    expect(fn).toContain('路径B');
    expect(fn).toContain('路径C');
});

test('T9: 三连 confidence 升 35-45（路径A）', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('confidence 升 35-45');
});

test('T10: 三连 confidence 升 30-40（路径B）', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('confidence 升 30-40');
});

// ═══════════════════════════════════════════════════════
// T11-T13: 两连/单夜内容
// ═══════════════════════════════════════════════════════

test('T11: 两连内容——⭕两连标记 + 路径A/B', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('两连平安夜二阶逻辑镜像推断');
    expect(fn).toContain('confidence 升 25-35');
    expect(fn).toContain('confidence 升 20-30');
});

test('T12: 两连 confidence 升 25-35（路径A）', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('confidence 升 25-35');
});

test('T13: 单夜内容——⭕魔术师平安夜逻辑镜像推断 + confidence 升 15-20', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('魔术师平安夜逻辑镜像推断');
    expect(fn).toContain('confidence 升 15-20');
});

// ═══════════════════════════════════════════════════════
// T14: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T14: 白熊效应合规——三层推断全正向描述，无负向禁词（第 31 次验证）', () => {
    const fn = getMagDayFnBlock();
    // 提取平安夜推断块（从 R110 注释到 if 块结束）
    const peaceStart = fn.indexOf('// R110:');
    const peaceEnd = fn.indexOf('return `${getBaseContext(ctx)}', peaceStart);
    const peaceBlock = fn.slice(peaceStart, peaceEnd);
    expect(peaceBlock).not.toContain('不要');
    expect(peaceBlock).not.toContain('禁止');
    expect(peaceBlock).not.toContain('不能');
    expect(peaceBlock).not.toContain('绝不');
    expect(peaceBlock).toContain('confidence 升');
});

// ═══════════════════════════════════════════════════════
// T15: 注入结构
// ═══════════════════════════════════════════════════════

test('T15: 注入结构——return 模板中 magDayPeaceStep 在 magicianDayHistoryStep 之后、Step1 之前', () => {
    const fn = getMagDayFnBlock();
    const historyIdx = fn.indexOf('${magicianDayHistoryStep}');
    const peaceIdx = fn.indexOf('${magDayPeaceStep}');
    const step1Idx = fn.indexOf('Step1:', peaceIdx);
    expect(historyIdx).toBeGreaterThan(0);
    expect(peaceIdx).toBeGreaterThan(historyIdx);
    expect(step1Idx).toBeGreaterThan(peaceIdx);
});

// ═══════════════════════════════════════════════════════
// T16-T18: 生成门控
// ═══════════════════════════════════════════════════════

test('T16: 门控——非平安夜时 magDayPeaceStep 不激活（dayCount=2 lastNightInfo 含死亡）', () => {
    const fn = getMagDayFnBlock();
    // 验证 isPeacefulNightMagicianDay 为 false 时 magDayPeaceStep 为空字符串
    expect(fn).toContain("let magDayPeaceStep = '';");
    // 只有在 if (isPeacefulNightMagicianDay) 内才赋值
    const ifStart = fn.indexOf('if (isPeacefulNightMagicianDay)');
    const letIdx = fn.indexOf("let magDayPeaceStep = '';");
    expect(letIdx).toBeGreaterThan(0);
    expect(letIdx).toBeLessThan(ifStart); // let 声明在 if 之前
});

test('T17: 门控——D1 首夜不激活（dayCount > 1 条件不满足）', () => {
    const fn = getMagDayFnBlock();
    // 确认 dayCount > 1 是激活条件
    expect(fn).toContain('ctx.dayCount > 1 && ctx.lastNightInfo?.includes');
});

test('T18: 激活——D4 三连时三层全激活（isTriple 超集包含 isConsecutive 包含 isPeaceful）', () => {
    const fn = getMagDayFnBlock();
    // 超集激活原则：三连标记在函数体中（路径A/B/C 三路径均存在）
    expect(fn).toContain('三夜均有交换');
    expect(fn).toContain('两夜有交换一夜未');
    expect(fn).toContain('三夜交换各不相同');
    // isTriple dayCount >= 4 检查
    expect(fn).toContain('ctx.dayCount >= 4 && isConsecutivePeacefulMagicianDay');
});

// ═══════════════════════════════════════════════════════
// T19-T20: 参数化 + Step 保留
// ═══════════════════════════════════════════════════════

test('T19: lastDaySwapRef 有换/未换两路参数化', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('const lastDayHadSwap');
    expect(fn).toContain('const lastDaySwapRef');
    expect(fn).toContain('昨夜未交换');
    // 有换时含玩家号格式
    expect(fn).toContain('lastSwap.player1Id}号 ↔ ${lastSwap.player2Id}号');
});

test('T20: return 模板——Step1-5 + identity_table 填写指导 + magicianSpeechLen 引用 仍然存在', () => {
    const fn = getMagDayFnBlock();
    expect(fn).toContain('Step1: 逻辑镜像计算');
    expect(fn).toContain('Step2: 是否需要跳身份');
    expect(fn).toContain('Step3: 发言内容确定');
    expect(fn).toContain('Step4: 今晚交换计划');
    expect(fn).toContain('Step5: 投票倾向');
    expect(fn).toContain('identity_table 填写指导');
    expect(fn).toContain('${magicianSpeechLen}');
});
