/**
 * Round 100: 村民 DAY_SPEECH 三连平安夜三阶推断框架
 * 在 R80（单夜）和 R88（两连）基础上，新增 D4+ 三连平安夜检测，
 * 提供最高层级的三夜票压交叉验证与守护链稳定性推断
 *
 * T1-T7:   变量声明与依赖链顺序（isTriple / threePrevDay / tripleHint / 声明顺序）
 * T8-T12:  三连推断内容验证（⭕标记 / 三路径 / confidence区间 / identity_table）
 * T13-T15: 注入结构（prepend injection / 声明顺序 / 白熊效应合规）
 * T16-T18: 条件门控（dayCount>=4 / 三元else / 依赖链非激活）
 * T19-T20: R88 两连推断内容保留 + R80 单夜推断保留
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── 村民 DAY_SPEECH block 定位 ────────────────────────────────────────────
const villagerDayStart = src.indexOf("'村民': (ctx, params) =>");
const knightDayStart = src.indexOf("    '骑士':", villagerDayStart);
const villagerBlock = src.slice(villagerDayStart, knightDayStart);

// 变量声明区（return 之前）
const villagerReturnIdx = villagerBlock.indexOf('return `');
const villagerVarBlock = villagerBlock.slice(0, villagerReturnIdx);

// ─── 三连推断内容定位 ────────────────────────────────────────────────────
const tripleAssignStart = villagerVarBlock.indexOf('tripleConsecutivePeaceHintVillager = isTripleConsecutivePeacefulVillager');
const tripleAssignEnd = villagerVarBlock.indexOf(": '';", tripleAssignStart);
const tripleContent = tripleAssignStart >= 0
    ? villagerVarBlock.slice(tripleAssignStart, tripleAssignEnd + 10)
    : '';

// ═══════════════════════════════════════════════════════════════════════
// T1-T7: 变量声明与依赖链顺序
// ═══════════════════════════════════════════════════════════════════════

describe('R100 村民三连平安夜: 变量声明', () => {
    // T1: isTripleConsecutivePeacefulVillager 声明存在
    test('T1: 村民函数中声明了 isTripleConsecutivePeacefulVillager 变量', () => {
        expect(villagerVarBlock).toContain('isTripleConsecutivePeacefulVillager');
    });

    // T2: isTripleConsecutivePeacefulVillager 使用 dayCount >= 4 条件
    test('T2: isTripleConsecutivePeacefulVillager 条件包含 dayCount >= 4', () => {
        const tripleIdx = villagerVarBlock.indexOf('isTripleConsecutivePeacefulVillager');
        const condLine = villagerVarBlock.slice(tripleIdx, tripleIdx + 200);
        expect(condLine).toContain('dayCount >= 4');
    });

    // T3: isTripleConsecutivePeacefulVillager 依赖 isConsecutivePeacefulVillager（超集原则）
    test('T3: isTripleConsecutivePeacefulVillager 条件包含 isConsecutivePeacefulVillager 依赖', () => {
        const tripleIdx = villagerVarBlock.indexOf('isTripleConsecutivePeacefulVillager =');
        const condBlock = villagerVarBlock.slice(tripleIdx, tripleIdx + 200);
        expect(condBlock).toContain('isConsecutivePeacefulVillager');
    });

    // T4: isTripleConsecutivePeacefulVillager 使用 fullGameTimeline 检测 N-3 平安夜
    test('T4: isTripleConsecutivePeacefulVillager 条件包含 fullGameTimeline 且检测 dayCount - 3', () => {
        const tripleIdx = villagerVarBlock.indexOf('isTripleConsecutivePeacefulVillager =');
        const condBlock = villagerVarBlock.slice(tripleIdx, tripleIdx + 200);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('dayCount - 3');
    });

    // T5: threePrevDay 在 if (isPeacefulNight) 块内声明
    test('T5: threePrevDay 在 if (isPeacefulNight) 块内声明', () => {
        const ifIdx = villagerVarBlock.indexOf('if (isPeacefulNight)');
        const threePrevIdx = villagerVarBlock.indexOf('threePrevDay', ifIdx);
        expect(ifIdx).toBeGreaterThan(-1);
        expect(threePrevIdx).toBeGreaterThan(ifIdx);
    });

    // T6: tripleConsecutivePeaceHintVillager 在 threePrevDay 之后声明
    test('T6: tripleConsecutivePeaceHintVillager 在 threePrevDay 之后声明（依赖顺序正确）', () => {
        const ifIdx = villagerVarBlock.indexOf('if (isPeacefulNight)');
        const threePrevIdx = villagerVarBlock.indexOf('threePrevDay', ifIdx);
        const tripleHintIdx = villagerVarBlock.indexOf('tripleConsecutivePeaceHintVillager', ifIdx);
        expect(tripleHintIdx).toBeGreaterThan(threePrevIdx);
    });

    // T7: tripleConsecutivePeaceHintVillager 在 consecutivePeaceHintVillager 之前声明
    test('T7: tripleConsecutivePeaceHintVillager 在 consecutivePeaceHintVillager 之前声明', () => {
        const ifIdx = villagerVarBlock.indexOf('if (isPeacefulNight)');
        const tripleHintIdx = villagerVarBlock.indexOf('tripleConsecutivePeaceHintVillager', ifIdx);
        const consecIdx = villagerVarBlock.indexOf('consecutivePeaceHintVillager = isConsecutivePeacefulVillager', ifIdx);
        expect(tripleHintIdx).toBeGreaterThan(-1);
        expect(consecIdx).toBeGreaterThan(tripleHintIdx);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T8-T12: 三连推断内容验证
// ═══════════════════════════════════════════════════════════════════════

describe('R100 村民三连平安夜: 内容验证', () => {
    // T8: 三连推断步骤包含 ⭕ 标记
    test('T8: 三连平安夜推断内容包含 ⭕ 标记', () => {
        expect(tripleContent).toContain('⭕');
    });

    // T9: 三连推断包含三路径框架（路径A/路径B/路径C）
    test('T9: 内容包含三路径框架（路径A / 路径B / 路径C）', () => {
        expect(tripleContent).toContain('路径A');
        expect(tripleContent).toContain('路径B');
        expect(tripleContent).toContain('路径C');
    });

    // T10: 路径A confidence 区间为 35-45（高于两连 25-35）
    test('T10: 路径A confidence 降值区间为 35-45（三夜最高层级）', () => {
        expect(tripleContent).toContain('35-45');
    });

    // T11: 路径B 包含两夜共同目标的处理（降 25-35），与两连一致
    test('T11: 路径B 包含两夜共同目标 confidence 降 25-35', () => {
        expect(tripleContent).toContain('25-35');
    });

    // T12: 包含 identity_table 追加指导
    test('T12: 内容包含 identity_table 追加指导（三连平安夜标记）', () => {
        expect(tripleContent).toContain('identity_table');
        expect(tripleContent).toContain('三连平安夜');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T13-T15: 注入结构与白熊效应合规
// ═══════════════════════════════════════════════════════════════════════

describe('R100 村民三连平安夜: 注入结构', () => {
    // T13: consecutivePeaceHintVillager 模板前置 ${tripleConsecutivePeaceHintVillager}（prepend injection 第15次）
    test('T13: consecutivePeaceHintVillager 模板以 ${tripleConsecutivePeaceHintVillager} 前置注入', () => {
        expect(villagerVarBlock).toContain('`${tripleConsecutivePeaceHintVillager}⭕【两连');
    });

    // T14: isTripleConsecutivePeacefulVillager 在 let peaceNightStep 之前声明（if 块外）
    test('T14: isTripleConsecutivePeacefulVillager 在 let peaceNightStep 之前声明（if 块外）', () => {
        const tripleCondIdx = villagerVarBlock.indexOf('isTripleConsecutivePeacefulVillager =');
        const peaceStepIdx = villagerVarBlock.indexOf("let peaceNightStep = '';");
        expect(tripleCondIdx).toBeGreaterThan(-1);
        expect(peaceStepIdx).toBeGreaterThan(tripleCondIdx);
    });

    // T15: 白熊效应合规：三连推断内容无负向禁词
    test('T15: 三连推断内容无白熊效应禁词（不能/禁止/不要擅）', () => {
        const forbiddenNegatives = ['不能', '禁止', '避免直接', '不要擅'];
        for (const word of forbiddenNegatives) {
            expect(tripleContent).not.toContain(word);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T16-T18: 条件门控
// ═══════════════════════════════════════════════════════════════════════

describe('R100 村民三连平安夜: 条件门控', () => {
    // T16: 三连检测依赖 dayCount >= 4 门控
    test('T16: isTripleConsecutivePeacefulVillager 要求 dayCount >= 4（D4+ 才激活）', () => {
        const tripleIdx = villagerVarBlock.indexOf('const isTripleConsecutivePeacefulVillager');
        const decl = villagerVarBlock.slice(tripleIdx, tripleIdx + 180);
        expect(decl).toContain('dayCount >= 4');
        // 确认非 dayCount >= 3（区分两连门控）
        expect(decl).not.toContain('dayCount >= 3');
    });

    // T17: tripleConsecutivePeaceHintVillager 三元表达式 else 分支为空字符串
    test('T17: tripleConsecutivePeaceHintVillager 三元 else 分支为空字符串', () => {
        expect(tripleContent).toContain(": '';");
    });

    // T18: isTripleConsecutivePeacefulVillager 非激活时 tripleHint 为空（依赖链非激活测试）
    test('T18: isTripleConsecutivePeacefulVillager 使用 fullGameTimeline 确保非连续时不激活（N-3 检测）', () => {
        const tripleIdx = villagerVarBlock.indexOf('const isTripleConsecutivePeacefulVillager');
        const decl = villagerVarBlock.slice(tripleIdx, tripleIdx + 200);
        // 必须检测 N-3 平安夜，确保只在连续三夜时激活
        expect(decl).toContain('dayCount - 3');
        expect(decl).toContain(':平安夜');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T19-T20: 回归保留验证
// ═══════════════════════════════════════════════════════════════════════

describe('R100 村民三连平安夜: 回归保留验证', () => {
    // T19: R88 两连推断内容保留（两夜高票存活者相同/不同分支，confidence 25-35/12-18）
    test('T19: R88 两连平安夜推断内容完整保留（25-35 / 12-18 / 女巫资源）', () => {
        expect(villagerVarBlock).toContain('两夜高票存活者相同');
        expect(villagerVarBlock).toContain('两夜高票存活者不同');
        expect(villagerVarBlock).toContain('12-18');
        expect(villagerVarBlock).toContain('女巫资源状态');
    });

    // T20: R80 单夜平安夜推断内容保留（peaceNightStep 注入到 Step1 之前）
    test('T20: R80 单夜平安夜推断保留（peaceNightStep 注入位置完整）', () => {
        expect(villagerBlock).toContain('${peaceNightStep}Step1:');
        expect(villagerBlock).toContain('⭕【平安夜推断');
        expect(villagerBlock).toContain('票压最高的存活玩家');
    });
});
