/**
 * Round 83: 狼人 DAY_SPEECH 平安夜战术推断（wolfPeaceNightStep）
 * 补完好人/狼人平安夜感知对称缺口（好人侧 R80-R82 已完成，本轮补狼人侧）
 *
 * T1-T5:   变量声明验证（isPeacefulNightWolf / wolfPeaceNightStep 初值 / 条件 / 分支 / prevDay）
 * T6-T10:  内容验证（⭕标记 / 换刀建议 / 两分支推断路径 / 资源模型更新 / 次日叙事衔接）
 * T11-T15: 注入位置验证（${wolfPeaceNightStep}Step1 / 顺序 / thought 约束 / Step0 之后 / 模板中插值存在）
 * T16-T20: 回归验证（空初值 / 白熊合规 / prevDay 动态引用 / 块大小 / 与 R79 次日叙事并存）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── Wolf DAY_SPEECH block locator ──────────────────────────────────────────
const wolfDayStart = src.indexOf("'狼人': (ctx, params) =>");
const villagerDayStart = src.indexOf("'村民': (ctx, params) =>", wolfDayStart);
const wolfDayBlock = src.slice(wolfDayStart, villagerDayStart);

// ─── Wolf DAY_SPEECH pre-return variable declaration area ──────────────────
const wolfReturnIdx = wolfDayBlock.indexOf('return `${getBaseContext(ctx)}');
const wolfVarBlock = wolfDayBlock.slice(0, wolfReturnIdx);

// ─── Wolf DAY_SPEECH template (return string) ─────────────────────────────
const wolfTemplateBlock = wolfDayBlock.slice(wolfReturnIdx);

describe('R83 wolfPeaceNightStep: 变量声明验证', () => {
    // T1: isPeacefulNightWolf 变量声明存在
    test('T1: 变量声明 isPeacefulNightWolf 存在', () => {
        expect(wolfVarBlock).toContain('isPeacefulNightWolf');
    });

    // T2: wolfPeaceNightStep 初始化为空字符串
    test('T2: wolfPeaceNightStep 初始化为空字符串', () => {
        expect(wolfVarBlock).toContain("let wolfPeaceNightStep = ''");
    });

    // T3: isPeacefulNightWolf 使用 dayCount > 1 AND 平安夜 条件
    test('T3: isPeacefulNightWolf 条件包含 dayCount > 1 和 平安夜', () => {
        const condIdx = wolfVarBlock.indexOf('isPeacefulNightWolf');
        const condLine = wolfVarBlock.slice(condIdx, condIdx + 120);
        expect(condLine).toContain('dayCount > 1');
        expect(condLine).toContain('平安夜');
    });

    // T4: wolfPeaceNightStep 在 isPeacefulNightWolf if 块内被赋值
    test('T4: wolfPeaceNightStep 在 isPeacefulNightWolf 条件块内被赋值', () => {
        const ifIdx = wolfVarBlock.indexOf('if (isPeacefulNightWolf)');
        expect(ifIdx).toBeGreaterThan(-1);
        const assignIdx = wolfVarBlock.indexOf('wolfPeaceNightStep = `', ifIdx);
        expect(assignIdx).toBeGreaterThan(ifIdx);
    });

    // T5: prevDay 变量在 if 块内声明（用于动态插入前一天编号）
    test('T5: prevDay 变量在 isPeacefulNightWolf 块内声明', () => {
        const ifIdx = wolfVarBlock.indexOf('if (isPeacefulNightWolf)');
        const prevDayIdx = wolfVarBlock.indexOf('prevDay', ifIdx);
        expect(prevDayIdx).toBeGreaterThan(ifIdx);
    });
});

describe('R83 wolfPeaceNightStep: 内容验证', () => {
    // 获取赋值内容
    const assignStart = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
    const assignEnd = wolfVarBlock.indexOf('`;\n        }\n        return', assignStart);
    const stepContent = wolfVarBlock.slice(assignStart, assignEnd);

    // T6: 内容包含 ⭕ 标记（与其他平安夜推断步骤格式一致）
    test('T6: wolfPeaceNightStep 内容包含 ⭕ 标记', () => {
        expect(stepContent).toContain('⭕');
    });

    // T7: 高票存活者 = 刀口目标 → 换刀建议
    test('T7: 路径A：高票存活者=刀口目标 → 换刀建议', () => {
        expect(stepContent).toContain('换刀');
        expect(stepContent).toContain('连守');
    });

    // T8: 高票存活者 ≠ 刀口目标 → 女巫救药资源消耗推断
    test('T8: 路径B：高票存活者≠刀口目标 → 女巫救药资源推断', () => {
        expect(stepContent).toContain('女巫救药资源');
    });

    // T9: 资源模型更新指导存在
    test('T9: 资源模型更新指导包含 identity_table 追加说明', () => {
        expect(stepContent).toContain('资源模型更新');
        expect(stepContent).toContain('identity_table');
    });

    // T10: speech 层面引用 Step0 次日叙事预案（与 R79 机制衔接）
    test('T10: speech 层面说明按 Step0 次日叙事预案应对', () => {
        expect(stepContent).toContain('次日叙事预案');
    });
});

describe('R83 wolfPeaceNightStep: 注入位置验证', () => {
    // T11: 模板中 ${wolfPeaceNightStep}Step1 注入点存在
    test('T11: 模板包含 ${wolfPeaceNightStep}Step1 注入点', () => {
        expect(wolfTemplateBlock).toContain('${wolfPeaceNightStep}Step1');
    });

    // T12: wolfPeaceNightStep 注入点在 Step0 文本之后
    test('T12: wolfPeaceNightStep 注入点在 Step0 文本之后', () => {
        const step0pos = wolfTemplateBlock.indexOf('Step0:');
        const injectpos = wolfTemplateBlock.indexOf('${wolfPeaceNightStep}');
        expect(step0pos).toBeGreaterThan(-1);
        expect(injectpos).toBeGreaterThan(step0pos);
    });

    // T13: wolfPeaceNightStep 注入点在 Step1 文本之前（正确插入位置）
    test('T13: wolfPeaceNightStep 注入点在 Step1 局势评估 之前', () => {
        const injectpos = wolfTemplateBlock.indexOf('${wolfPeaceNightStep}');
        const step1pos = wolfTemplateBlock.indexOf('Step1 局势评估');
        expect(injectpos).toBeGreaterThan(-1);
        expect(step1pos).toBeGreaterThan(-1);
        expect(injectpos).toBeLessThan(step1pos);
    });

    // T14: 变量声明在 return 语句之前（正确代码结构）
    test('T14: wolfPeaceNightStep 变量声明在 return 之前', () => {
        const varIdx = wolfDayBlock.indexOf('let wolfPeaceNightStep');
        const retIdx = wolfDayBlock.indexOf('return `${getBaseContext(ctx)}');
        expect(varIdx).toBeGreaterThan(-1);
        expect(retIdx).toBeGreaterThan(varIdx);
    });

    // T15: thought 中完成约束（不在 speech 中展示推断过程）
    test('T15: wolfPeaceNightStep 包含 thought 中完成约束', () => {
        const assignStart = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
        const stepContent = wolfVarBlock.slice(assignStart, assignStart + 600);
        expect(stepContent).toContain('thought 中完成');
    });
});

describe('R83 wolfPeaceNightStep: 回归验证', () => {
    // T16: D1/非平安夜场景：wolfPeaceNightStep 为空字符串（不影响注入）
    test('T16: wolfPeaceNightStep 初始值为空字符串（D1/非平安夜无内容注入）', () => {
        // 确保 let wolfPeaceNightStep = '' 存在，模板中 ${wolfPeaceNightStep} 为空时不干扰内容
        expect(wolfVarBlock).toContain("let wolfPeaceNightStep = ''");
        // 模板中的注入点紧邻 Step1，空字符串时 Step1 正常渲染
        expect(wolfTemplateBlock).toContain('${wolfPeaceNightStep}Step1 局势评估');
    });

    // T17: 白熊效应合规 — wolfPeaceNightStep 赋值块中无负向禁词
    test('T17: wolfPeaceNightStep 赋值块无负向禁词（白熊效应合规）', () => {
        const assignStart = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
        const assignEnd = wolfVarBlock.indexOf('`;\n        }\n        return', assignStart);
        const stepContent = wolfVarBlock.slice(assignStart, assignEnd);
        // 正向描述，无"不要""禁止""绝不能"
        expect(stepContent).not.toContain('不要');
        expect(stepContent).not.toContain('禁止');
        expect(stepContent).not.toContain('绝不能');
    });

    // T18: prevDay 动态引用前一天编号（${prevDay} 出现在赋值内容中）
    test('T18: wolfPeaceNightStep 使用 ${prevDay} 动态引用前一天', () => {
        const assignStart = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
        const stepContent = wolfVarBlock.slice(assignStart, assignStart + 800);
        expect(stepContent).toContain('${prevDay}');
    });

    // T19: wolf DAY_SPEECH 块大小合理（R83 新增后应 > 23900 chars）
    test('T19: wolfDayBlock 大小在 R83 新增后 > 23900 chars', () => {
        expect(wolfDayBlock.length).toBeGreaterThan(23900);
    });

    // T20: R79 次日叙事预案机制仍然存在（与 wolfPeaceNightStep 共存，不覆盖）
    test('T20: Step0 次日叙事预案（R79）与 wolfPeaceNightStep（R83）共存', () => {
        // Step0 中的次日叙事读取仍完整
        expect(wolfTemplateBlock).toContain('次日叙事');
        // wolfPeaceNightStep 的 speech 层面说明也引用次日叙事
        const assignStart = wolfVarBlock.indexOf('wolfPeaceNightStep = `');
        const stepContent = wolfVarBlock.slice(assignStart, assignStart + 800);
        expect(stepContent).toContain('次日叙事预案');
    });
});
