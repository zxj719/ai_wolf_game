/**
 * Round 99: 预言家 DAY_SPEECH 三连平安夜三阶推断框架
 * 在 R90（两连推断）基础上，新增 D4+ 三连平安夜检测，
 * 通过三夜投票记录交叉验证 + 查验记录叠加确认最高优先级守护目标
 *
 * T1-T7:   变量声明（isTripleConsecutivePeacefulSeer / threePrevDay / tripleHint / 条件 / 依赖链）
 * T8-T12:  内容验证（⭕标记 / 三路径 / 三夜交叉验证 / confidence区间 / identity_table更新）
 * T13-T15: 注入结构（prepend到consecutivePeaceHintSeer / 层级嵌套 / 白熊效应合规）
 * T16-T18: 条件门控（dayCount<4不激活 / 非连续不激活 / 双连不激活三连）
 * T19-T20: 回归（R90两连推断内容保留 / R81单夜推断保留）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── 预言家 DAY_SPEECH block 定位 ─────────────────────────────────────────────
const roleDaySpeechStart = src.indexOf('ROLE_DAY_SPEECH_PROMPTS');
const seerDayFnMarker = "'预言家': (ctx, params) => {";
const seerDayFnStart = src.indexOf(seerDayFnMarker, roleDaySpeechStart);
const witchDayFnMarker = "'女巫': (ctx, params)";
const witchDayFnStart = src.indexOf(witchDayFnMarker, seerDayFnStart);
const seerDayBlock = src.slice(seerDayFnStart, witchDayFnStart);

// 变量声明区（return 之前）
const seerDayReturnIdx = seerDayBlock.indexOf('return `');
const seerDayVarBlock = seerDayBlock.slice(0, seerDayReturnIdx);

// if (isPeacefulNightSeer) 块定位
const ifPeaceIdx = seerDayVarBlock.indexOf('if (isPeacefulNightSeer)');
const ifPeaceBlock = seerDayVarBlock.slice(ifPeaceIdx);

// tripleConsecutivePeaceHintSeer 赋值内容
const tripleHintStart = seerDayVarBlock.indexOf('tripleConsecutivePeaceHintSeer = isTriple');
const tripleHintEnd = seerDayVarBlock.indexOf(": '';\n", tripleHintStart);
const tripleHintContent = tripleHintStart >= 0
    ? seerDayVarBlock.slice(tripleHintStart, tripleHintEnd + 50)
    : '';

// consecutivePeaceHintSeer 赋值内容
const consecHintStart = seerDayVarBlock.indexOf('const consecutivePeaceHintSeer = isConsecutive');
const consecHintEnd = seerDayVarBlock.indexOf(": '';\n", consecHintStart);
const consecHintContent = consecHintStart >= 0
    ? seerDayVarBlock.slice(consecHintStart, consecHintEnd + 50)
    : '';

// ═══════════════════════════════════════════════════════════════════════
// 变量声明验证（T1-T7）
// ═══════════════════════════════════════════════════════════════════════

describe('R99 预言家 DAY_SPEECH: 变量声明验证', () => {
    test('T1: 声明了 isTripleConsecutivePeacefulSeer 变量', () => {
        expect(seerDayVarBlock).toContain('isTripleConsecutivePeacefulSeer');
    });

    test('T2: isTripleConsecutivePeacefulSeer 条件包含 dayCount >= 4', () => {
        const condIdx = seerDayVarBlock.indexOf('isTripleConsecutivePeacefulSeer =');
        const condLine = seerDayVarBlock.slice(condIdx, condIdx + 200);
        expect(condLine).toContain('dayCount >= 4');
    });

    test('T3: isTripleConsecutivePeacefulSeer 条件引用 isConsecutivePeacefulSeer', () => {
        const condIdx = seerDayVarBlock.indexOf('isTripleConsecutivePeacefulSeer =');
        const condLine = seerDayVarBlock.slice(condIdx, condIdx + 200);
        expect(condLine).toContain('isConsecutivePeacefulSeer');
    });

    test('T4: isTripleConsecutivePeacefulSeer 条件包含 fullGameTimeline N-3 检测', () => {
        const condIdx = seerDayVarBlock.indexOf('isTripleConsecutivePeacefulSeer =');
        const condBlock = seerDayVarBlock.slice(condIdx, condIdx + 250);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('dayCount - 3');
        expect(condBlock).toContain('平安夜');
    });

    test('T5: threePrevDay 在 if (isPeacefulNightSeer) 块内声明', () => {
        expect(ifPeaceBlock).toContain('threePrevDay');
        expect(ifPeaceBlock).toContain('dayCount - 3');
    });

    test('T6: tripleConsecutivePeaceHintSeer 在 if 块内声明', () => {
        expect(ifPeaceBlock).toContain('tripleConsecutivePeaceHintSeer');
        expect(tripleHintContent).toBeTruthy();
    });

    test('T7: 变量声明顺序正确（isTriple 在 isConsecutive 之后，在 if 块之外）', () => {
        const isConsecPos = seerDayVarBlock.indexOf('const isConsecutivePeacefulSeer');
        const isTriplePos = seerDayVarBlock.indexOf('const isTripleConsecutivePeacefulSeer');
        const ifBlockPos = seerDayVarBlock.indexOf('if (isPeacefulNightSeer)');
        expect(isConsecPos).toBeGreaterThan(0);
        expect(isTriplePos).toBeGreaterThan(isConsecPos);
        expect(isTriplePos).toBeLessThan(ifBlockPos);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 内容验证（T8-T12）
// ═══════════════════════════════════════════════════════════════════════

describe('R99 预言家 DAY_SPEECH: 内容验证', () => {
    test('T8: tripleHint 包含三连⭕标记和三夜注明', () => {
        expect(tripleHintContent).toContain('⭕【预言家三连平安夜三阶推断');
        expect(tripleHintContent).toContain('三夜');
    });

    test('T9: tripleHint 包含三路径（路径A/路径B/路径C）', () => {
        expect(tripleHintContent).toContain('路径A');
        expect(tripleHintContent).toContain('路径B');
        expect(tripleHintContent).toContain('路径C');
    });

    test('T10: tripleHint 路径A 包含极高 confidence 区间（35-45）', () => {
        expect(tripleHintContent).toContain('35-45');
    });

    test('T11: tripleHint 包含三夜查验记录交叉验证逻辑', () => {
        expect(tripleHintContent).toContain('三夜交叉验证');
        expect(tripleHintContent).toContain('①②③');
    });

    test('T12: tripleHint 包含 identity_table 更新指导（三连平安夜 + confidence 升 30-40）', () => {
        expect(tripleHintContent).toContain('三连平安夜');
        expect(tripleHintContent).toContain('confidence 升 30-40');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 注入结构验证（T13-T15）
// ═══════════════════════════════════════════════════════════════════════

describe('R99 预言家 DAY_SPEECH: 注入结构验证', () => {
    test('T13: consecutivePeaceHintSeer 以 ${tripleConsecutivePeaceHintSeer} 前置注入', () => {
        expect(consecHintContent).toContain('${tripleConsecutivePeaceHintSeer}⭕【预言家两连');
    });

    test('T14: tripleHint 在 if 块内声明位置早于 consecutivePeaceHintSeer', () => {
        const triplePos = ifPeaceBlock.indexOf('tripleConsecutivePeaceHintSeer');
        const consecPos = ifPeaceBlock.indexOf('const consecutivePeaceHintSeer');
        expect(triplePos).toBeGreaterThanOrEqual(0);
        expect(consecPos).toBeGreaterThan(triplePos);
    });

    test('T15: 白熊效应合规——tripleHint 无负向禁词（不要/禁止/千万不/不能展示）', () => {
        const negativeWords = ['不要', '禁止', '千万不', '不能展示', '不得'];
        const hasNegativeWord = negativeWords.some(w => tripleHintContent.includes(w));
        expect(hasNegativeWord).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 条件门控验证（T16-T18）
// ═══════════════════════════════════════════════════════════════════════

describe('R99 预言家 DAY_SPEECH: 条件门控验证', () => {
    test('T16: isTripleConsecutivePeacefulSeer 在 dayCount < 4 时不激活（dayCount >= 4 约束）', () => {
        const condIdx = seerDayVarBlock.indexOf('isTripleConsecutivePeacefulSeer =');
        const condBlock = seerDayVarBlock.slice(condIdx, condIdx + 200);
        expect(condBlock).toContain('dayCount >= 4');
        expect(condBlock).not.toContain('dayCount >= 5');
    });

    test('T17: tripleConsecutivePeaceHintSeer 是三元表达式（else 分支为空字符串）', () => {
        expect(tripleHintContent).toContain(": ''");
    });

    test('T18: consecutivePeaceHintSeer 的三元 else 分支为空字符串（确保非两连时无三连内容）', () => {
        expect(consecHintContent).toContain(": ''");
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 回归验证（T19-T20）
// ═══════════════════════════════════════════════════════════════════════

describe('R99 预言家 DAY_SPEECH: 回归验证', () => {
    test('T19: R90 两连推断内容保留（两连⭕标记 / 两夜高票比对 / 交叉验证）', () => {
        expect(consecHintContent).toContain('⭕【预言家两连平安夜二阶推断');
        expect(consecHintContent).toContain('两夜高票存活者相同');
        expect(consecHintContent).toContain('查验记录交叉验证');
    });

    test('T20: R81 单夜推断内容保留（seerPeaceNightStep 包含路径A/B/C）', () => {
        const peacePosInBlock = ifPeaceBlock.indexOf('seerPeaceNightStep =');
        const peaceStepContent = ifPeaceBlock.slice(peacePosInBlock, peacePosInBlock + 800);
        expect(peaceStepContent).toContain('路径A');
        expect(peaceStepContent).toContain('路径B');
        expect(peaceStepContent).toContain('路径C');
    });
});
