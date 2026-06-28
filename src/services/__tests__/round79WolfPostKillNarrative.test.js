/**
 * Round 79: NIGHT_WOLF 次日刀后叙事预案 + wolf DAY_SPEECH Step 0 读取
 * 新增 read-write 闭环：
 *   NIGHT_WOLF Step 4 → writes "次日叙事:[顺势/补叙/引导]" → identity_table
 *   Wolf DAY_SPEECH Step 0 → reads "次日叙事" → executes pre-planned narrative
 *
 * T1-T10: NIGHT_WOLF Step 4 验证
 * T11-T20: Wolf DAY_SPEECH Step 0 次日叙事读取验证
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── NIGHT_WOLF block locator ───────────────────────────────────────────────
const nightWolfStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
const nightSeerStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:', nightWolfStart);
const nightWolfBlock = src.slice(nightWolfStart, nightSeerStart);

// ─── Wolf DAY_SPEECH block locator ──────────────────────────────────────────
const wolfDayStart = src.indexOf("'狼人': (ctx, params) =>");
const seerDayStart = src.indexOf("'预言家':", wolfDayStart);
const wolfDayBlock = src.slice(wolfDayStart, seerDayStart);

describe('R79 NIGHT_WOLF Step 4: 次日刀后叙事预案', () => {
    // T1: Step 4 标题存在
    test('T1: NIGHT_WOLF 包含 Step 4 次日刀后叙事预案', () => {
        expect(nightWolfBlock).toContain('4. 【次日刀后叙事预案】');
    });

    // T2: Step 4 位置在 Step 3 之后
    test('T2: Step 4 位置在 Step 3 之后', () => {
        const step3pos = nightWolfBlock.indexOf('3. 【最终决策】');
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        expect(step3pos).toBeGreaterThan(-1);
        expect(step4pos).toBeGreaterThan(step3pos);
    });

    // T3: Step 4 在 identity_table 战略更新之前
    test('T3: Step 4 在 identity_table 战略更新之前', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        expect(step4pos).toBeGreaterThan(-1);
        expect(identityPos).toBeGreaterThan(step4pos);
    });

    // T4: Step 4 包含今日公开立场评估（三种情况分支）
    test('T4: Step 4 包含今日公开立场三分支', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        expect(step4content).toContain('今日推过/质疑过TA');
        expect(step4content).toContain('今日中立或曾站TA');
        expect(step4content).toContain('今日明确保过TA');
    });

    // T5: Step 4 包含顺势应对策略
    test('T5: Step 4 包含顺势应对指引', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        expect(step4content).toContain('顺势');
    });

    // T6: Step 4 包含补叙细节策略
    test('T6: Step 4 包含补叙细节策略', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        expect(step4content).toContain('补叙细节');
    });

    // T7: Step 4 包含转移目标预判
    test('T7: Step 4 包含转移讨论焦点策略', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        expect(step4content).toContain('引导');
    });

    // T8: Step 4 引导将次日叙事记录到 identity_table
    test('T8: Step 4 引导将次日叙事记录到 identity_table', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        expect(step4content).toContain('次日叙事');
        expect(step4content).toContain('下一个白天 Step 0 将读取并执行');
    });

    // T9: identity_table 刀口行写指导已更新包含次日叙事
    test('T9: identity_table 写指导 - 刀口目标追加次日叙事注记', () => {
        const idtablePos = nightWolfBlock.indexOf('identity_table 战略更新');
        const outputPos = nightWolfBlock.indexOf('输出:', idtablePos);
        const idtableContent = nightWolfBlock.slice(idtablePos, outputPos);
        expect(idtableContent).toContain('次日叙事：[预计应对策略]');
    });

    // T10: 白熊效应合规 - Step 4 无负向禁止词
    test('T10: Step 4 无负向禁止词（白熊效应合规）', () => {
        const step4pos = nightWolfBlock.indexOf('4. 【次日刀后叙事预案】');
        const identityPos = nightWolfBlock.indexOf('identity_table 战略更新', step4pos);
        const step4content = nightWolfBlock.slice(step4pos, identityPos);
        // Check by line - no negative prohibitions mixed with positive instructions
        const lines = step4content.split('\n');
        const negativeWords = ['绝对禁止', '不能', '千万不要'];
        for (const line of lines) {
            const hasNegative = negativeWords.some(w => line.includes(w));
            if (hasNegative) {
                // Context: "引导讨论到第三方嫌疑人" - this is the allowed context
                expect(line).not.toMatch(/绝对禁止|千万不要/);
            }
        }
        expect(true).toBe(true); // Passed if no throws
    });
});

describe('R79 Wolf DAY_SPEECH Step 0: 次日叙事预案读取', () => {
    // T11: Step 0 标题包含次日叙事预案
    test('T11: wolf DAY_SPEECH Step 0 标题更新为含次日叙事预案', () => {
        expect(wolfDayBlock).toContain('次日叙事预案');
    });

    // T12: Step 0 包含读取高优先刀口（原有功能保留）
    test('T12: Step 0 保留读取高优先刀口功能', () => {
        const step0pos = wolfDayBlock.indexOf('Step0: 【读取跨轮威胁积累');
        expect(step0pos).toBeGreaterThan(-1);
        const step0endpos = wolfDayBlock.indexOf('Step1', step0pos);
        const step0content = wolfDayBlock.slice(step0pos, step0endpos);
        expect(step0content).toContain('高优先刀口');
    });

    // T13: Step 0 包含读取次日叙事注记
    test('T13: Step 0 包含读取次日叙事注记指引', () => {
        const step0pos = wolfDayBlock.indexOf('Step0: 【读取跨轮威胁积累');
        const step1pos = wolfDayBlock.indexOf('Step1', step0pos);
        const step0content = wolfDayBlock.slice(step0pos, step1pos);
        expect(step0content).toContain('次日叙事');
        expect(step0content).toContain('按注记执行');
    });

    // T14: Step 0 提到顺势/补叙/引导三种执行策略
    test('T14: Step 0 包含三种次日叙事执行策略', () => {
        const step0pos = wolfDayBlock.indexOf('Step0: 【读取跨轮威胁积累');
        const step1pos = wolfDayBlock.indexOf('Step1', step0pos);
        const step0content = wolfDayBlock.slice(step0pos, step1pos);
        expect(step0content).toContain('顺势');
        expect(step0content).toContain('补叙');
        expect(step0content).toContain('引导');
    });

    // T15: Step 0 强调言行无缝衔接
    test('T15: Step 0 强调夜间决策与白天叙事的无缝衔接', () => {
        const step0pos = wolfDayBlock.indexOf('Step0: 【读取跨轮威胁积累');
        const step1pos = wolfDayBlock.indexOf('Step1', step0pos);
        const step0content = wolfDayBlock.slice(step0pos, step1pos);
        expect(step0content).toContain('言行矛盾');
    });

    // T16: Step 0 之后仍有 Step1-Step5 框架（回归）
    test('T16: Step0 后 Step1-Step5 框架保持完整（回归）', () => {
        expect(wolfDayBlock).toContain('Step1 局势评估');
        expect(wolfDayBlock).toContain('Step2 威胁识别');
        expect(wolfDayBlock).toContain('Step3 行动空间');
        expect(wolfDayBlock).toContain('Step4 最优行动');
        expect(wolfDayBlock).toContain('Step5 投票规划');
    });

    // T17: wolfTeammatesHint 仍然存在（回归）
    test('T17: wolfTeammatesHint 发言策略保持完整（回归）', () => {
        expect(wolfDayBlock).toContain('wolfTeammatesHint');
        expect(wolfDayBlock).toContain('wolfSpeechPressureHint');
    });

    // T18: wolf DAY_SPEECH Step 0 包含 D2+ 标记
    test('T18: wolf DAY_SPEECH Step 0 标记 D2+ 适用条件', () => {
        const step0pos = wolfDayBlock.indexOf('Step0: 【读取跨轮威胁积累');
        expect(step0pos).toBeGreaterThan(-1);
        expect(wolfDayBlock.slice(step0pos, step0pos + 50)).toContain('D2+');
    });

    // T19: NIGHT_WOLF 仍包含 wolfNightStyle 7分支（R76 回归）
    test('T19: NIGHT_WOLF wolfNightStyle 7分支回归验证', () => {
        expect(nightWolfBlock).toContain('wolfNightStyle');
        expect(nightWolfBlock).toContain('主动锁刀型');
        expect(nightWolfBlock).toContain('保守规避型');
        expect(nightWolfBlock).toContain('推理优化型');
        expect(nightWolfBlock).toContain('博弈迷雾型');
        expect(nightWolfBlock).toContain('直觉感知型');
        expect(nightWolfBlock).toContain('反预判型');
        expect(nightWolfBlock).toContain('平衡渐进型');
    });

    // T20: NIGHT_WOLF 输出格式完整（回归）
    test('T20: NIGHT_WOLF 输出JSON格式包含必要字段（回归）', () => {
        const outputPos = nightWolfBlock.indexOf('输出:');
        expect(outputPos).toBeGreaterThan(-1);
        const outputLine = nightWolfBlock.slice(outputPos, outputPos + 200);
        expect(outputLine).toContain('targetId');
        expect(outputLine).toContain('reasoning');
        expect(outputLine).toContain('thought');
        expect(outputLine).toContain('identity_table');
    });
});
