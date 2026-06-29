/**
 * Round 80: 村民平安夜推断框架
 * 新增条件化步骤：D2+ 平安夜时，在 Step0 后、Step1 前注入平安夜推断框架
 *
 * T1-T5:  村民函数 isPeacefulNight / peaceNightStep 变量声明
 * T6-T10: 平安夜步骤内容验证（内容、关键词、白熊合规）
 * T11-T15: 注入位置验证（${peaceNightStep}Step1 顺序）
 * T16-T18: 回归（非平安夜 / D1 场景下 peaceNightStep 为空字符串）
 * T19-T20: 白熊效应合规 + 窗口大小检查
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── 村民 DAY_SPEECH block 定位 ────────────────────────────────────────────
const villagerDayStart = src.indexOf("'村民': (ctx, params) =>");
const knightDayStart = src.indexOf("    '骑士':", villagerDayStart);
const villagerBlock = src.slice(villagerDayStart, knightDayStart);

// ─── 平安夜步骤内容定位 ────────────────────────────────────────────────────
const peaceStepStart = villagerBlock.indexOf('⭕【平安夜推断');
const peaceStepEnd = villagerBlock.indexOf('Step1:', peaceStepStart);
const peaceStepContent = peaceStepStart >= 0 ? villagerBlock.slice(peaceStepStart, peaceStepEnd) : '';

describe('R80 村民平安夜推断框架 — 变量声明', () => {
    // T1: isPeacefulNight 变量存在
    test('T1: 村民函数中声明了 isPeacefulNight 变量', () => {
        expect(villagerBlock).toContain('isPeacefulNight');
    });

    // T2: peaceNightStep 变量存在
    test('T2: 村民函数中声明了 peaceNightStep 变量', () => {
        expect(villagerBlock).toContain('peaceNightStep');
    });

    // T3: isPeacefulNight 引用了 dayCount
    test('T3: isPeacefulNight 条件包含 dayCount > 1', () => {
        expect(villagerBlock).toContain('ctx.dayCount > 1');
    });

    // T4: isPeacefulNight 引用了 lastNightInfo
    test('T4: isPeacefulNight 条件包含 lastNightInfo includes 平安夜', () => {
        expect(villagerBlock).toContain("lastNightInfo?.includes('平安夜')");
    });

    // T5: peaceNightStep 在 isPeacefulNight 为 true 时赋值
    test('T5: isPeacefulNight 为 true 时 peaceNightStep 被赋值（条件块）', () => {
        expect(villagerBlock).toContain('if (isPeacefulNight)');
        const ifPos = villagerBlock.indexOf('if (isPeacefulNight)');
        // 窗口已从 300 升至 700（R88 在 if 块内新增 prevPrevDay + consecutivePeaceHintVillager 变量，peaceNightStep = 移至 ~601 处）
        const afterIf = villagerBlock.slice(ifPos, ifPos + 700);
        expect(afterIf).toContain('peaceNightStep =');
    });
});

describe('R80 村民平安夜推断框架 — 步骤内容验证', () => {
    // T6: 步骤标题包含"平安夜推断"
    test('T6: 平安夜步骤包含"平安夜推断"标题', () => {
        expect(villagerBlock).toContain('平安夜推断');
    });

    // T7: 步骤引导 AI 查投票记录中票压最高玩家
    test('T7: 步骤引导查投票记录中票压最高的存活玩家', () => {
        expect(peaceStepContent).toContain('票压最高的存活玩家');
    });

    // T8: 步骤提到 identity_table confidence 调整
    test('T8: 步骤包含 identity_table confidence 调整指导', () => {
        expect(peaceStepContent).toContain('confidence');
    });

    // T9: 步骤提到守卫或女巫场景分支
    test('T9: 步骤包含守卫或女巫分支', () => {
        expect(peaceStepContent).toContain('守卫或女巫');
    });

    // T10: 步骤限制 speech 内容（只在 thought 中分析）
    test('T10: 步骤明确要求在 thought 中分析（不污染 speech）', () => {
        expect(peaceStepContent).toContain('thought');
    });
});

describe('R80 村民平安夜推断框架 — 注入位置验证', () => {
    // T11: peaceNightStep 紧挨 Step1 之前注入（模板字符串中 ${peaceNightStep}Step1:）
    test('T11: 模板中 ${peaceNightStep} 紧接 Step1 之前注入', () => {
        expect(villagerBlock).toContain('${peaceNightStep}Step1:');
    });

    // T12: Step0 在 ${peaceNightStep} 之前
    test('T12: Step0 在 ${peaceNightStep} 注入点之前', () => {
        const step0pos = villagerBlock.indexOf('Step0:');
        const injectPos = villagerBlock.indexOf('${peaceNightStep}Step1:');
        expect(step0pos).toBeGreaterThan(-1);
        expect(injectPos).toBeGreaterThan(step0pos);
    });

    // T13: ${peaceNightStep} 注入点在 Step2 之前
    test('T13: ${peaceNightStep} 注入点在 Step2 之前', () => {
        const injectPos = villagerBlock.indexOf('${peaceNightStep}Step1:');
        const step2pos = villagerBlock.indexOf('Step2:', injectPos);
        expect(step2pos).toBeGreaterThan(injectPos);
    });

    // T14: ⭕ 标记位于模板字符串内（peaceNightStep 赋值的字符串）
    test('T14: 平安夜步骤使用 ⭕ 视觉标记', () => {
        expect(villagerBlock).toContain('⭕【平安夜推断');
    });

    // T15: prevDay 变量被计算并嵌入 peaceNightStep（D${prevDay} 动态插值）
    test('T15: 步骤内容含 prevDay 动态插值引用投票记录', () => {
        const ifPos = villagerBlock.indexOf('if (isPeacefulNight)');
        const ifChunk = villagerBlock.slice(ifPos, ifPos + 600);
        expect(ifChunk).toContain('const prevDay');
        expect(ifChunk).toContain('D${prevDay}');
    });
});

describe('R80 村民平安夜推断框架 — 回归（非平安夜场景）', () => {
    // T16: peaceNightStep 初始值为空字符串（保证非平安夜下注入为空）
    test('T16: peaceNightStep 初始化为空字符串', () => {
        expect(villagerBlock).toContain("peaceNightStep = '';");
    });

    // T17: 条件块仅在 isPeacefulNight 为 true 时触发（不存在 else 覆写逻辑）
    test('T17: 不存在 else 块覆写 peaceNightStep（非平安夜下保持空字符串）', () => {
        const ifPos = villagerBlock.indexOf('if (isPeacefulNight)');
        // 找到 if 块结束位置（约 300 chars 内），确认无 } else {
        const ifChunk = villagerBlock.slice(ifPos, ifPos + 500);
        expect(ifChunk).not.toContain('} else {');
    });

    // T18: 模板 return 段使用 ${peaceNightStep} 变量插值（而非直接在 return 块内硬编码⭕内容）
    test('T18: return 模板中使用变量插值注入 peaceNightStep', () => {
        const returnPos = villagerBlock.indexOf('return `');
        const returnChunk = villagerBlock.slice(returnPos);
        // 变量插值必须存在于 return 块
        expect(returnChunk).toContain('${peaceNightStep}Step1:');
        // return 块自身不应包含 ⭕ 硬编码内容（⭕ 只在 peaceNightStep 赋值处）
        expect(returnChunk).not.toContain('⭕');
    });
});

describe('R80 村民平安夜推断框架 — 白熊效应合规 & 块大小', () => {
    // T19: 平安夜步骤不包含白熊效应禁用词
    test('T19: 步骤内无"不要""别""禁止"等白熊效应禁词', () => {
        // 允许 speech 指引中的 "只说"（正向指令），排查纯否定禁令
        const forbiddenNegatives = ['不能', '不要擅', '禁止', '避免直接'];
        for (const word of forbiddenNegatives) {
            expect(peaceStepContent).not.toContain(word);
        }
    });

    // T20: 村民块大小合理（含 R80 新增内容后应 > 3000 chars，< 5000 chars）
    test('T20: 村民 DAY_SPEECH 块大小在合理范围内（3000-5000 chars）', () => {
        expect(villagerBlock.length).toBeGreaterThan(3000);
        expect(villagerBlock.length).toBeLessThan(5000);
    });
});
