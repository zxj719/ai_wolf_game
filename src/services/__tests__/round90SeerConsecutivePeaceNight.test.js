/**
 * Round 90: 预言家两连平安夜二阶推断框架
 * 在 R81（预言家）平安夜一阶推断基础上，新增 D3+ 两连平安夜检测，
 * 利用查验历史精确定位双夜刀口目标并进行查验记录交叉验证
 *
 * T1-T5:   变量声明（isConsecutivePeacefulSeer / prevPrevDay / consecutivePeaceHintSeer / 初值 / 条件）
 * T6-T10:  内容验证（⭕标记 / 两夜比对 / confidence升值 / 查验记录交叉验证 / identity_table更新）
 * T11-T20: 集成验证（prepend 注入 / 白熊合规 / R81 回归 / 条件门控 / 三元else / R88结构对比）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── 预言家 NIGHT_SEER block 定位 ─────────────────────────────────────────────
// 使用 NIGHT_SEER case 定位预言家夜间函数
const nightSeerCaseMarker = 'case PROMPT_ACTIONS.NIGHT_SEER:';
const nightSeerIdx = src.indexOf(nightSeerCaseMarker);
const nightSeerBlock = src.slice(nightSeerIdx, nightSeerIdx + 4000);

// ─── 预言家 DAY_SPEECH block 定位 ─────────────────────────────────────────────
const roleDaySpeechStart = src.indexOf('ROLE_DAY_SPEECH_PROMPTS');
const seerDayFnMarker = "'预言家': (ctx, params) => {";
const seerDayFnStart = src.indexOf(seerDayFnMarker, roleDaySpeechStart);
// 使用女巫 DAY_SPEECH 作为结束边界
const witchDayFnMarker = "'女巫': (ctx, params)";
const witchDayFnStart = src.indexOf(witchDayFnMarker, seerDayFnStart);
const seerDayBlock = src.slice(seerDayFnStart, witchDayFnStart);

// 预言家 DAY_SPEECH 变量声明区（return 之前）
const seerDayReturnIdx = seerDayBlock.indexOf('return `');
const seerDayVarBlock = seerDayBlock.slice(0, seerDayReturnIdx);

// ─── 两连推断赋值内容定位 ─────────────────────────────────────────────────────
const consecAssignStart = seerDayVarBlock.indexOf('consecutivePeaceHintSeer = isConsecutivePeacefulSeer');
const consecAssignEnd = seerDayVarBlock.indexOf(": '';\n", consecAssignStart);
const consecContent = consecAssignStart >= 0
    ? seerDayVarBlock.slice(consecAssignStart, consecAssignEnd + 50)
    : '';

// ═══════════════════════════════════════════════════════════════════════
// 变量声明验证（T1-T5）
// ═══════════════════════════════════════════════════════════════════════

describe('R90 预言家: 变量声明验证', () => {
    test('T1: 预言家函数中声明了 isConsecutivePeacefulSeer 变量', () => {
        expect(seerDayVarBlock).toContain('isConsecutivePeacefulSeer');
    });

    test('T2: isConsecutivePeacefulSeer 条件包含 dayCount >= 3', () => {
        const condIdx = seerDayVarBlock.indexOf('isConsecutivePeacefulSeer');
        const condLine = seerDayVarBlock.slice(condIdx, condIdx + 150);
        expect(condLine).toContain('dayCount >= 3');
    });

    test('T3: isConsecutivePeacefulSeer 条件包含 fullGameTimeline 检测', () => {
        const condIdx = seerDayVarBlock.indexOf('isConsecutivePeacefulSeer');
        const condBlock = seerDayVarBlock.slice(condIdx, condIdx + 200);
        expect(condBlock).toContain('fullGameTimeline');
        expect(condBlock).toContain('平安夜');
    });

    test('T4: prevPrevDay 在 if (isPeacefulNightSeer) 块内声明', () => {
        const ifIdx = seerDayVarBlock.indexOf('if (isPeacefulNightSeer)');
        const prevPrevIdx = seerDayVarBlock.indexOf('prevPrevDay', ifIdx);
        expect(ifIdx).toBeGreaterThan(-1);
        expect(prevPrevIdx).toBeGreaterThan(ifIdx);
    });

    test('T5: consecutivePeaceHintSeer 使用三元表达式赋值', () => {
        expect(seerDayVarBlock).toContain('consecutivePeaceHintSeer = isConsecutivePeacefulSeer');
        // 三元表达式：两连时有内容，否则空字符串
        const ternaryIdx = seerDayVarBlock.indexOf('consecutivePeaceHintSeer = isConsecutivePeacefulSeer');
        const ternaryChunk = seerDayVarBlock.slice(ternaryIdx, ternaryIdx + 1000);
        expect(ternaryChunk).toContain(": '';");
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 内容验证（T6-T10）
// ═══════════════════════════════════════════════════════════════════════

describe('R90 预言家: 内容验证', () => {
    test('T6: 两连平安夜推断内容包含 ⭕ 标记', () => {
        expect(consecContent).toContain('⭕');
    });

    test('T7: 内容包含两夜高票存活者比对（两夜高票存活者相同/不同分支）', () => {
        expect(consecContent).toContain('两夜高票存活者相同');
        expect(consecContent).toContain('两夜高票存活者不同');
    });

    test('T8: 内容包含 confidence 升值指导（95-100 两夜相同，查验优先级②两夜不同）', () => {
        expect(consecContent).toContain('confidence');
        expect(consecContent).toContain('95-100');
        expect(consecContent).toContain('优先级②');
    });

    test('T9: 内容包含查验记录交叉验证（预言家专属：金水/查杀目标与高票存活者比对）', () => {
        expect(consecContent).toContain('查验记录交叉验证');
        expect(consecContent).toContain('金水');
    });

    test('T10: 内容包含 identity_table 更新指导（守卫/女巫信任度上调）', () => {
        expect(consecContent).toContain('identity_table');
        expect(consecContent).toContain('两连平安夜');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 集成验证（T11-T20）
// ═══════════════════════════════════════════════════════════════════════

describe('R90 预言家: 集成验证', () => {
    test('T11: consecutivePeaceHintSeer 以 prepend 方式注入到 seerPeaceNightStep', () => {
        // seerPeaceNightStep = `${consecutivePeaceHintSeer}⭕...` — needs window ≥50 chars
        const assignIdx = seerDayVarBlock.indexOf('seerPeaceNightStep = `');
        const assignChunk = seerDayVarBlock.slice(assignIdx, assignIdx + 50);
        expect(assignChunk).toContain('${consecutivePeaceHintSeer}');
    });

    test('T12: 两连推断包含 N${prevPrevDay}+N${prevDay} 格式（两夜编号插值）', () => {
        expect(consecContent).toContain('N${prevPrevDay}+N${prevDay}');
    });

    test('T13: 两连推断内容包含 D${prevPrevDay} 和 D${prevDay} 投票记录引用', () => {
        expect(consecContent).toContain('D${prevPrevDay}');
        expect(consecContent).toContain('D${prevDay}');
    });

    test('T14: 两连推断说明 thought 中完成，speech 正常报验', () => {
        expect(consecContent).toContain('thought');
        expect(consecContent).toContain('speech');
        const thoughtIdx = consecContent.indexOf('thought');
        const speechIdx = consecContent.indexOf('speech');
        expect(thoughtIdx).toBeLessThan(speechIdx);
    });

    test('T15: 两连推断包含排队查验优先级：①（紧急，两夜被针对）', () => {
        expect(consecContent).toContain('排队查验优先级：①');
        expect(consecContent).toContain('两夜被针对');
    });

    test('T16: 两连推断内容无白熊效应禁词（不要/禁止/绝不能）', () => {
        const forbiddenNegatives = ['不要', '禁止', '绝不能'];
        for (const word of forbiddenNegatives) {
            expect(consecContent).not.toContain(word);
        }
    });

    test('T17: R81 一阶推断仍存在（回归检查：⭕【预言家平安夜推断 marker）', () => {
        // 两连 hint prepend 后，原一阶推断仍保留在 seerPeaceNightStep
        const assignIdx = seerDayVarBlock.indexOf('seerPeaceNightStep = `');
        const assignChunk = seerDayVarBlock.slice(assignIdx, assignIdx + 100);
        expect(assignChunk).toContain('⭕【预言家平安夜推断');
    });

    test('T18: isConsecutivePeacefulSeer 通过 isPeacefulNightSeer 间接检查（D2不触发）', () => {
        // isConsecutivePeacefulSeer = ctx.dayCount >= 3 && isPeacefulNightSeer && ...
        const condIdx = seerDayVarBlock.indexOf('isConsecutivePeacefulSeer');
        const condLine = seerDayVarBlock.slice(condIdx, condIdx + 200);
        expect(condLine).toContain('isPeacefulNightSeer');
        expect(condLine).toContain('dayCount >= 3');
    });

    test('T19: R88 结构对齐 — 与村民/狼人两连推断使用相同条件模式（dayCount >= 3 + fullGameTimeline）', () => {
        // 验证预言家使用与 R88 村民/狼人完全一致的条件检测模式
        // 村民和狼人函数较长，需要提取各自变量声明区（return 之前）
        const villagerDayStart = src.indexOf("'村民': (ctx, params) =>");
        const villagerReturnOffset = src.indexOf('return `', villagerDayStart);
        const villagerVarBlock = src.slice(villagerDayStart, villagerReturnOffset);

        const wolfDayStart = src.indexOf("'狼人': (ctx, params) =>");
        const wolfReturnOffset = src.indexOf("return `${getBaseContext(ctx)}", wolfDayStart);
        const wolfVarBlock = src.slice(wolfDayStart, wolfReturnOffset);

        // 三者均使用 dayCount >= 3 + fullGameTimeline 双重条件（R88 既定格式）
        expect(villagerVarBlock).toContain('dayCount >= 3');
        expect(villagerVarBlock).toContain('fullGameTimeline');
        expect(wolfVarBlock).toContain('dayCount >= 3');
        expect(wolfVarBlock).toContain('fullGameTimeline');
        expect(seerDayVarBlock).toContain('dayCount >= 3');
        expect(seerDayVarBlock).toContain('fullGameTimeline');
    });

    test('T20: NIGHT_SEER Step 0 排队查验优先级关键词仍存在（R41 回归检查）', () => {
        expect(nightSeerBlock).toContain('排队查验优先级');
    });
});
