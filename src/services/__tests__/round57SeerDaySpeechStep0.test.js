/**
 * Round 57: 预言家 DAY_SPEECH Step 0 — 读写闭环 DAY_SPEECH 侧补全（预言家）
 *
 * 问题：预言家 DAY_SPEECH identity_table 写指导已有"排队查验优先级：②③④⑤之一"关键词
 *       指向"下夜 Step 0 读取"（NIGHT_SEER Step 0 已建立）。但 DAY_SPEECH 思维链
 *       没有对称的 Step 0——白天发言前无法从历史积累的候选队列起步，导致每天重新分析
 *       而非延续上一轮的验证计划（NIGHT→DAY 存在但 DAY→DAY 断链）。
 *
 * 修复：
 * 1. 新增 seerDayHistoryStep 变量（D1=跳过；D2+=读取"排队查验优先级"历史候选起点）
 * 2. 思维链 Step 0 插入 ${seerDayHistoryStep} 占位符，Step1 之前
 * 3. Step3 更新引用 "Step0 历史候选" 投票优先级排序
 * 4. 写指导补全 DAY→DAY 前向引用：下轮 DAY Step 0 同样从此起点读取
 * 5. 写指导添加"追加不覆盖历史"规范 + 【追加示例】（R18/R19 格式对齐）
 *
 * 关键词对齐（三环）：
 * | 环节                  | 关键词                  |
 * |----------------------|------------------------|
 * | NIGHT_SEER write     | 排队查验优先级            |
 * | DAY_SPEECH Step 0 read | 排队查验优先级          |
 * | DAY_SPEECH write     | 排队查验优先级            |
 * | NIGHT_SEER Step 0 read | 排队查验优先级          |
 *
 * 博弈论依据：Wang 2025 信息链理论——跨轮行为模式积累的验证候选优先级比单轮临场判断
 *             更精准；预言家白天发言需要参照已规划的候选队列以保持验证策略一贯性。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const aiPromptsSrc = src;

// ─── 定位预言家 DAY_SPEECH 函数段落 ─────────────────────────────────────────
// 该函数已在 aiPrompts.js 的 ROLE_DAY_SPEECH_PROMPTS 中以函数体形式存在
// 使用 ROLE_DAY_SPEECH_PROMPTS 后面的 '预言家' 定位（排除 ROLE_PERSONAS 的 '预言家'）
const roleDaySpeechStart = src.indexOf('ROLE_DAY_SPEECH_PROMPTS');
const seerFnMarker = "'预言家': (ctx, params) => {";
const seerFnStart = src.indexOf(seerFnMarker, roleDaySpeechStart);

// 窗口：预言家 DAY_SPEECH 约 3500 chars → 窗口 4200（含余量）
const seerBlock = src.slice(seerFnStart, seerFnStart + 4200);

// 变量声明区（seerDayHistoryStep 在 return 之前）
const returnIdx = seerBlock.indexOf('return `');
const varDeclBlock = seerBlock.slice(0, returnIdx);

// 思维链区（在 return 模板字符串内）
const thinkChainMarker = '【思维链】';
const thinkStart = seerBlock.indexOf(thinkChainMarker, returnIdx);
const thinkBlock = seerBlock.slice(thinkStart, thinkStart + 500);

// identity_table 写指导区
const writeGuideMarker = '【identity_table 填写指导（预言家有确定性知识，应差异化填写）】';
const writeGuideStart = seerBlock.indexOf(writeGuideMarker, returnIdx);
const writeGuideBlock = seerBlock.slice(writeGuideStart, writeGuideStart + 700);

describe('R57: 预言家 DAY_SPEECH seerDayHistoryStep 变量（函数体预计算）', () => {
    test('T1: 预言家 DAY_SPEECH 函数体 marker 存在', () => {
        expect(seerFnStart).toBeGreaterThan(0);
    });

    test('T2: seerDayHistoryStep 变量在函数体 return 之前声明', () => {
        expect(varDeclBlock).toContain('seerDayHistoryStep');
    });

    test('T3: D2+ 条件判断存在（ctx.dayCount > 1）', () => {
        expect(varDeclBlock).toContain('ctx.dayCount > 1');
    });

    test('T4: D2+ 分支含"排队查验优先级"关键词（与 NIGHT_SEER Step 0 对齐）', () => {
        const d2Line = varDeclBlock.slice(varDeclBlock.indexOf('ctx.dayCount > 1') - 5, varDeclBlock.indexOf('ctx.dayCount > 1') + 400);
        expect(d2Line).toContain('排队查验优先级');
    });

    test('T5: D1 分支含"首日无历史候选队列"（首日跳过）', () => {
        expect(varDeclBlock).toContain('首日无历史候选队列');
    });

    test('T6: D2+ 分支含"身份推理表"（引导 AI 查阅历史）', () => {
        expect(varDeclBlock).toContain('身份推理表');
    });
});

describe('R57: 预言家 DAY_SPEECH 思维链 Step 0 位置正确', () => {
    test('T7: 思维链 marker 存在于模板字符串中', () => {
        expect(thinkStart).toBeGreaterThan(returnIdx);
    });

    test('T8: ${seerDayHistoryStep} 插值占位符在思维链中', () => {
        expect(thinkBlock).toContain('${seerDayHistoryStep}');
    });

    test('T9: ${seerDayHistoryStep} 出现在 Step1 之前', () => {
        const step0Pos = thinkBlock.indexOf('${seerDayHistoryStep}');
        const step1Pos = thinkBlock.indexOf('Step1:');
        expect(step0Pos).toBeGreaterThanOrEqual(0);
        expect(step1Pos).toBeGreaterThan(step0Pos);
    });

    test('T10: Step3 引用 Step0 历史候选', () => {
        expect(thinkBlock).toContain('Step0 历史候选');
    });

    test('T11: Step3 投票优先级顺序包含 Step0 历史候选', () => {
        const step3Idx = thinkBlock.indexOf('Step3:');
        const step3Line = thinkBlock.slice(step3Idx, step3Idx + 80);
        expect(step3Line).toContain('Step0 历史候选');
    });
});

describe('R57: identity_table 写指导 DAY→DAY 前向引用 + 追加格式', () => {
    test('T12: 写指导 marker 存在于模板字符串中', () => {
        expect(writeGuideStart).toBeGreaterThan(returnIdx);
    });

    test('T13: 写指导含"下轮 DAY Step 0 同样从此起点读取"（DAY→DAY 前向引用）', () => {
        expect(writeGuideBlock).toContain('下轮 DAY Step 0 同样从此起点读取');
    });

    test('T14: 写指导含"追加不覆盖历史"规范', () => {
        expect(writeGuideBlock).toContain('追加不覆盖历史');
    });

    test('T15: 写指导含【追加示例】', () => {
        expect(writeGuideBlock).toContain('【追加示例】');
    });

    test('T16: 【追加示例】含分号拼接格式示例', () => {
        const exampleIdx = writeGuideBlock.indexOf('【追加示例】');
        const exampleLine = writeGuideBlock.slice(exampleIdx, exampleIdx + 200);
        expect(exampleLine).toContain('→');
        expect(exampleLine).toContain('；');
    });

    test('T17: 写指导仍含"已查验玩家"条目（回归检查）', () => {
        expect(writeGuideBlock).toContain('已查验玩家');
    });

    test('T18: 写指导仍含"排队查验优先级"关键词（写侧关键词存在）', () => {
        expect(writeGuideBlock).toContain('排队查验优先级');
    });
});

describe('R57: 关键词对齐验证（DAY_SPEECH ↔ NIGHT_SEER Step 0）', () => {
    // NIGHT_SEER Step 0（R41 已建立）
    const nightSeerCaseMarker = 'case PROMPT_ACTIONS.NIGHT_SEER:';
    const nightSeerIdx = aiPromptsSrc.indexOf(nightSeerCaseMarker);
    const nightSeerBlock = aiPromptsSrc.slice(nightSeerIdx, nightSeerIdx + 2500);

    test('T19: NIGHT_SEER Step 0 仍使用"排队查验优先级"关键词（R41 回归检查）', () => {
        expect(nightSeerBlock).toContain('排队查验优先级');
    });

    test('T20: NIGHT_SEER Step 0 仍有历史读取步骤（seerHistoryStep）', () => {
        expect(nightSeerBlock).toContain('seerHistoryStep');
    });

    test('T21: DAY_SPEECH Step 0 与 NIGHT_SEER Step 0 使用相同关键词"排队查验优先级"', () => {
        // 两处都含此关键词（DAY→NIGHT→DAY 三环对齐）
        const dayStepHasKeyword = varDeclBlock.includes('排队查验优先级');
        const nightStepHasKeyword = nightSeerBlock.includes('排队查验优先级');
        expect(dayStepHasKeyword && nightStepHasKeyword).toBe(true);
    });

    test('T22: DAY_SPEECH 写指导关键词与 Step 0 读关键词一致（DAY 写→DAY 读对齐）', () => {
        expect(writeGuideBlock).toContain('排队查验优先级');
    });
});

describe('R57: 回归验证（关联 Step0 系统未受影响）', () => {
    test('T23: 狼人 DAY_SPEECH Step 0 仍存在（R55 回归）', () => {
        const wolfFnMarker = "'狼人': (ctx, params) => {";
        const wolfFnStart = aiPromptsSrc.indexOf(wolfFnMarker, roleDaySpeechStart);
        // 狼人 Step 0 直接内联于模板字符串（不使用独立变量），窗口 4500
        const wolfBlock = aiPromptsSrc.slice(wolfFnStart, wolfFnStart + 4500);
        expect(wolfBlock).toContain('高优先刀口');
    });

    test('T24: 猎人 DAY_SPEECH Step 0 仍存在（R56 回归）', () => {
        const hunterFnMarker = "'猎人': (ctx, params) => {";
        const hunterFnStart = aiPromptsSrc.indexOf(hunterFnMarker, roleDaySpeechStart);
        const hunterBlock = aiPromptsSrc.slice(hunterFnStart, hunterFnStart + 1600);
        expect(hunterBlock).toContain('hunterDayHistoryStep');
    });

    test('T25: 预言家函数体 marker 在 ROLE_DAY_SPEECH_PROMPTS 之后（不是 ROLE_PERSONAS 中的预言家）', () => {
        expect(seerFnStart).toBeGreaterThan(roleDaySpeechStart);
    });
});
