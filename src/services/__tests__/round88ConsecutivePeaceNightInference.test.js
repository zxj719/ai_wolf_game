/**
 * Round 88: 连续平安夜二阶推断框架
 * 在 R80（村民）和 R83（狼人）平安夜一阶推断基础上，新增 D3+ 两连平安夜检测，
 * 提供更强的守卫连守/女巫资源推断约束
 *
 * T1-T5:   村民侧变量声明（isConsecutivePeacefulVillager / prevPrevDay / consecutivePeaceHintVillager / 初值 / 条件）
 * T6-T10:  村民侧内容验证（⭕标记 / 两夜比对 / confidence降值 / 女巫资源 / 白熊合规）
 * T11-T15: 狼人侧变量声明（isConsecutivePeacefulWolf / prevPrevDay / consecutivePeaceHintWolf / 初值 / 条件）
 * T16-T20: 狼人侧内容验证（⭕标记 / 换刀建议 / 资源损耗 / identity_table 更新 / 白熊合规）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── 村民 DAY_SPEECH block 定位 ────────────────────────────────────────────
const villagerDayStart = src.indexOf("'村民': (ctx, params) =>");
const knightDayStart = src.indexOf("    '骑士':", villagerDayStart);
const villagerBlock = src.slice(villagerDayStart, knightDayStart);

// 村民变量声明区（return 之前）
const villagerReturnIdx = villagerBlock.indexOf('return `');
const villagerVarBlock = villagerBlock.slice(0, villagerReturnIdx);

// ─── Wolf DAY_SPEECH block 定位 ──────────────────────────────────────────
const wolfDayStart = src.indexOf("'狼人': (ctx, params) =>");
const villagerDayStart2 = src.indexOf("'村民': (ctx, params) =>", wolfDayStart);
const wolfDayBlock = src.slice(wolfDayStart, villagerDayStart2);

// 狼人变量声明区（return 之前）
const wolfReturnIdx = wolfDayBlock.indexOf('return `${getBaseContext(ctx)}');
const wolfVarBlock = wolfDayBlock.slice(0, wolfReturnIdx);

// ─── 村民两连平安夜赋值内容定位 ───────────────────────────────────────────
const villagerConsecAssignStart = villagerVarBlock.indexOf('consecutivePeaceHintVillager = isConsecutivePeacefulVillager');
const villagerConsecAssignEnd = villagerVarBlock.indexOf(': \'\';\n', villagerConsecAssignStart);
const villagerConsecContent = villagerConsecAssignStart >= 0
    ? villagerVarBlock.slice(villagerConsecAssignStart, villagerConsecAssignEnd + 50)
    : '';

// ─── 狼人两连平安夜赋值内容定位 ───────────────────────────────────────────
const wolfConsecAssignStart = wolfVarBlock.indexOf('consecutivePeaceHintWolf = isConsecutivePeacefulWolf');
const wolfConsecAssignEnd = wolfVarBlock.indexOf(': \'\';\n', wolfConsecAssignStart);
const wolfConsecContent = wolfConsecAssignStart >= 0
    ? wolfVarBlock.slice(wolfConsecAssignStart, wolfConsecAssignEnd + 50)
    : '';

// ═══════════════════════════════════════════════════════════════════════
// 村民侧（T1-T10）
// ═══════════════════════════════════════════════════════════════════════

describe('R88 村民侧: 变量声明验证', () => {
    // T1: isConsecutivePeacefulVillager 声明存在
    test('T1: 村民函数中声明了 isConsecutivePeacefulVillager 变量', () => {
        expect(villagerVarBlock).toContain('isConsecutivePeacefulVillager');
    });

    // T2: isConsecutivePeacefulVillager 使用 dayCount >= 3 条件
    test('T2: isConsecutivePeacefulVillager 条件包含 dayCount >= 3', () => {
        const condIdx = villagerVarBlock.indexOf('isConsecutivePeacefulVillager');
        const condLine = villagerVarBlock.slice(condIdx, condIdx + 150);
        expect(condLine).toContain('dayCount >= 3');
    });

    // T3: isConsecutivePeacefulVillager 使用 fullGameTimeline 检测前一夜平安夜
    test('T3: isConsecutivePeacefulVillager 条件包含 fullGameTimeline 检测', () => {
        const condIdx = villagerVarBlock.indexOf('isConsecutivePeacefulVillager');
        const condBlock = villagerVarBlock.slice(condIdx, condIdx + 200);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('平安夜');
    });

    // T4: prevPrevDay 变量在 if (isPeacefulNight) 块内声明
    test('T4: prevPrevDay 在 if (isPeacefulNight) 块内声明', () => {
        const ifIdx = villagerVarBlock.indexOf('if (isPeacefulNight)');
        const prevPrevIdx = villagerVarBlock.indexOf('prevPrevDay', ifIdx);
        expect(ifIdx).toBeGreaterThan(-1);
        expect(prevPrevIdx).toBeGreaterThan(ifIdx);
    });

    // T5: consecutivePeaceHintVillager 为三元表达式（isConsecutivePeacefulVillager 的ternary）
    test('T5: consecutivePeaceHintVillager 使用三元表达式赋值', () => {
        expect(villagerVarBlock).toContain('consecutivePeaceHintVillager = isConsecutivePeacefulVillager');
        // 三元表达式：两连时有内容，否则空字符串
        const ternaryIdx = villagerVarBlock.indexOf('consecutivePeaceHintVillager = isConsecutivePeacefulVillager');
        const ternaryChunk = villagerVarBlock.slice(ternaryIdx, ternaryIdx + 600);
        expect(ternaryChunk).toContain(": '';");
    });
});

describe('R88 村民侧: 内容验证', () => {
    // T6: 两连推断步骤包含 ⭕ 标记
    test('T6: 两连平安夜推断内容包含 ⭕ 标记', () => {
        expect(villagerConsecContent).toContain('⭕');
    });

    // T7: 步骤包含两夜高票存活者比对指导
    test('T7: 内容包含两夜高票存活者比对（两夜高票存活者相同/不同分支）', () => {
        expect(villagerConsecContent).toContain('两夜高票存活者相同');
        expect(villagerConsecContent).toContain('两夜高票存活者不同');
    });

    // T8: 步骤包含 confidence 降值指导（25-35 两夜相同，12-18 两夜不同）
    test('T8: 内容包含 confidence 降值（25-35 和 12-18）', () => {
        expect(villagerConsecContent).toContain('confidence');
        expect(villagerConsecContent).toContain('25-35');
        expect(villagerConsecContent).toContain('12-18');
    });

    // T9: 步骤包含女巫资源状态推断
    test('T9: 内容包含女巫资源状态推断', () => {
        expect(villagerConsecContent).toContain('女巫');
        expect(villagerConsecContent).toContain('解药');
    });

    // T10: 两连推断步骤无白熊效应禁词
    test('T10: 两连推断内容无白熊效应禁词（不能/禁止/避免）', () => {
        const forbiddenNegatives = ['不能', '禁止', '避免直接', '不要擅'];
        for (const word of forbiddenNegatives) {
            expect(villagerConsecContent).not.toContain(word);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 狼人侧（T11-T20）
// ═══════════════════════════════════════════════════════════════════════

describe('R88 狼人侧: 变量声明验证', () => {
    // T11: isConsecutivePeacefulWolf 声明存在
    test('T11: 狼人函数中声明了 isConsecutivePeacefulWolf 变量', () => {
        expect(wolfVarBlock).toContain('isConsecutivePeacefulWolf');
    });

    // T12: isConsecutivePeacefulWolf 使用 dayCount >= 3 条件
    test('T12: isConsecutivePeacefulWolf 条件包含 dayCount >= 3', () => {
        const condIdx = wolfVarBlock.indexOf('isConsecutivePeacefulWolf');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 150);
        expect(condLine).toContain('dayCount >= 3');
    });

    // T13: isConsecutivePeacefulWolf 使用 fullGameTimeline 检测
    test('T13: isConsecutivePeacefulWolf 条件包含 fullGameTimeline 检测', () => {
        const condIdx = wolfVarBlock.indexOf('isConsecutivePeacefulWolf');
        const condBlock = wolfVarBlock.slice(condIdx, condIdx + 200);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('平安夜');
    });

    // T14: prevPrevDay 在 if (isPeacefulNightWolf) 块内声明
    test('T14: prevPrevDay 在 if (isPeacefulNightWolf) 块内声明', () => {
        const ifIdx = wolfVarBlock.indexOf('if (isPeacefulNightWolf)');
        const prevPrevIdx = wolfVarBlock.indexOf('prevPrevDay', ifIdx);
        expect(ifIdx).toBeGreaterThan(-1);
        expect(prevPrevIdx).toBeGreaterThan(ifIdx);
    });

    // T15: consecutivePeaceHintWolf 为三元表达式
    test('T15: consecutivePeaceHintWolf 使用三元表达式赋值', () => {
        expect(wolfVarBlock).toContain('consecutivePeaceHintWolf = isConsecutivePeacefulWolf');
        const ternaryIdx = wolfVarBlock.indexOf('consecutivePeaceHintWolf = isConsecutivePeacefulWolf');
        const ternaryChunk = wolfVarBlock.slice(ternaryIdx, ternaryIdx + 600);
        expect(ternaryChunk).toContain(": '';");
    });
});

describe('R88 狼人侧: 内容验证', () => {
    // T16: 狼人两连推断包含 ⭕ 标记
    test('T16: 狼人两连平安夜推断内容包含 ⭕ 标记', () => {
        expect(wolfConsecContent).toContain('⭕');
    });

    // T17: 狼人内容包含换刀建议（两夜刀口相同 → 必须换刀）
    test('T17: 狼人内容包含换刀建议（两夜刀口相同分支）', () => {
        expect(wolfConsecContent).toContain('换刀');
        expect(wolfConsecContent).toContain('两夜刀口相同');
    });

    // T18: 狼人内容包含资源损耗评估
    test('T18: 狼人内容包含资源损耗评估（女巫解药推断）', () => {
        expect(wolfConsecContent).toContain('资源损耗评估');
        expect(wolfConsecContent).toContain('女巫解药资源');
    });

    // T19: 狼人内容包含 identity_table 更新指导
    test('T19: 狼人内容包含 identity_table 更新指导', () => {
        expect(wolfConsecContent).toContain('identity_table');
        expect(wolfConsecContent).toContain('两连平安夜');
    });

    // T20: 狼人两连推断无白熊效应禁词
    test('T20: 狼人两连推断内容无白熊效应禁词（不要/禁止/绝不能）', () => {
        const forbiddenNegatives = ['不要', '禁止', '绝不能'];
        for (const word of forbiddenNegatives) {
            expect(wolfConsecContent).not.toContain(word);
        }
    });
});
