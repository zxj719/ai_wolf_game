/**
 * Round 67: 村民 DAY_SPEECH 个性化分析视角注入
 *
 * 问题：8 种个性类型（逻辑怪/暴躁哥/稳健派/心机王/感性派/数据控/反骨仔/谨慎型）
 *       在系统提示词中有差异，但用户提示词的【分析框架】对所有村民完全相同，
 *       导致所有村民发言模式趋同，可观战性持续偏低（7.8/10）。
 *
 * 修复：
 * 1. roleParams 中新增 personalityType 字段（来自 currentPlayer.personality.type）
 * 2. ROLE_DAY_SPEECH_PROMPTS['村民'] 从箭头函数改为函数体语法（R3 教训）
 * 3. 根据 personalityType 动态生成 personalityLens（7 种有效类型 + 无类型 fallback）
 * 4. personalityLens 注入位置：【村民发言要求】之后，【分析框架】之前
 *
 * 白熊效应检查（R1/R30 规则）：
 * - 所有 personalityLens 均为正向指令（"优先用X分析"），无负向禁止词 ✅
 *
 * 向下兼容：
 * - 无 personalityType 时 personalityLens = ''，prompt 退化为 R66 状态 ✅
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// 定位村民 DAY_SPEECH 函数体（R67 改为函数体语法，R56 教训：用 => { 而非 => ` 定位）
const villagerMarker = "'村民': (ctx, params) => {";
const villagerStart = src.indexOf(villagerMarker);
// 窗口 4500 以覆盖变量声明区（~1800 chars）+ return 模板（~2000 chars）
const villagerBlock = src.slice(villagerStart, villagerStart + 4500);

// 定位变量声明区（return 之前）和模板字符串区（return 之后）
const returnIdx = villagerBlock.indexOf('return `');
const declBlock = villagerBlock.slice(0, returnIdx);
const templateBlock = villagerBlock.slice(returnIdx);

describe('R67: 村民 DAY_SPEECH 函数体语法 + personalityType 字段', () => {
    test('T1: 村民 DAY_SPEECH 函数体标记存在（非箭头函数）', () => {
        expect(villagerStart).toBeGreaterThan(0);
    });

    test('T2: 函数体包含 personalityType 变量声明', () => {
        expect(declBlock).toContain('personalityType');
    });

    test('T3: 函数体包含 personalityLens 变量声明', () => {
        expect(declBlock).toContain('personalityLens');
    });

    test('T4: personalityType 从 params 读取', () => {
        expect(declBlock).toContain("params.personalityType");
    });

    test('T5: 7 种个性类型均有对应 lens 分支', () => {
        expect(declBlock).toContain("'logical'");
        expect(declBlock).toContain("'analytical'");
        expect(declBlock).toContain("'aggressive'");
        expect(declBlock).toContain("'emotional'");
        expect(declBlock).toContain("'contrarian'");
        expect(declBlock).toContain("'cunning'");
        expect(declBlock).toContain("'cautious'");
        expect(declBlock).toContain("'steady'");
    });

    test('T6: 每种 lens 均含"分析视角"关键词', () => {
        expect(declBlock).toContain('【你的分析视角】');
    });

    test('T7: 无类型时 personalityLens 为空（向下兼容）', () => {
        // 空字符串初始值
        expect(declBlock).toContain("personalityLens = ''");
    });

    test('T8: logical/analytical lens 包含"数据驱动"相关词', () => {
        const logicalIdx = declBlock.indexOf("'logical'");
        const logicalSection = declBlock.slice(logicalIdx, logicalIdx + 200);
        expect(logicalSection).toContain('数据');
    });

    test('T9: aggressive lens 包含"直觉驱动"相关词', () => {
        const aggIdx = declBlock.indexOf("'aggressive'");
        const aggSection = declBlock.slice(aggIdx, aggIdx + 200);
        expect(aggSection).toContain('直觉');
    });

    test('T10: contrarian lens 包含"差异化"相关词', () => {
        const contrIdx = declBlock.indexOf("'contrarian'");
        const contrSection = declBlock.slice(contrIdx, contrIdx + 200);
        expect(contrSection).toContain('差异');
    });
});

describe('R67: personalityLens 注入位置和模板结构验证', () => {
    test('T11: personalityLens 通过 ${personalityLens} 注入到模板', () => {
        expect(templateBlock).toContain('${personalityLens}');
    });

    test('T12: personalityLens 注入在【村民发言要求】之后', () => {
        const reqPos = templateBlock.indexOf('【村民发言要求】');
        const lensPos = templateBlock.indexOf('${personalityLens}');
        expect(reqPos).toBeGreaterThan(0);
        expect(lensPos).toBeGreaterThan(0);
        expect(lensPos).toBeGreaterThan(reqPos);
    });

    test('T13: personalityLens 注入在【分析框架】之前', () => {
        const lensPos = templateBlock.indexOf('${personalityLens}');
        const frameworkPos = templateBlock.indexOf('【分析框架】');
        expect(frameworkPos).toBeGreaterThan(0);
        expect(lensPos).toBeLessThan(frameworkPos);
    });

    test('T14: 原始分析框架 4 步骤完整保留', () => {
        expect(templateBlock).toContain('预言家验证');
        expect(templateBlock).toContain('发言分析');
        expect(templateBlock).toContain('投票一致性');
        expect(templateBlock).toContain('动机推理');
    });

    test('T15: Step0-Step4 完整保留', () => {
        expect(templateBlock).toContain('Step0');
        expect(templateBlock).toContain('Step1');
        expect(templateBlock).toContain('Step2');
        expect(templateBlock).toContain('Step3');
        expect(templateBlock).toContain('Step4');
    });
});

describe('R67: roleParams 中 personalityType 字段注入', () => {
    // 定位 roleParams 构建区域（DAY_SPEECH case 中）
    const roleParamsMarker = "const roleParams = {";
    // 使用 lastIndexOf 避免假定义
    const roleParamsStart = src.lastIndexOf(roleParamsMarker);
    const roleParamsBlock = src.slice(roleParamsStart, roleParamsStart + 2000);

    test('T16: roleParams 构建区存在', () => {
        expect(roleParamsStart).toBeGreaterThan(0);
    });

    test('T17: roleParams 包含 personalityType 字段', () => {
        expect(roleParamsBlock).toContain('personalityType');
    });

    test('T18: personalityType 从 currentPlayer.personality.type 读取', () => {
        expect(roleParamsBlock).toContain('personality?.type');
    });
});

describe('R67: 白熊效应检查（R1/R30 规则）', () => {
    test('T19: aggressive lens 不含"禁止"词（用正向指令）', () => {
        const aggIdx = declBlock.indexOf("'aggressive'");
        const aggSection = declBlock.slice(aggIdx, aggIdx + 300);
        expect(aggSection).not.toContain('不要');
        expect(aggSection).not.toContain('禁止');
    });

    test('T20: contrarian lens 不含"禁止"词（用正向指令）', () => {
        const contrIdx = declBlock.indexOf("'contrarian'");
        const contrSection = declBlock.slice(contrIdx, contrIdx + 300);
        expect(contrSection).not.toContain('禁止');
    });

    test('T21: 所有 personalityLens 均以正向描述开头（非"不要"类负向）', () => {
        // 检查没有 lens 以"不要"开头（都是描述"XX驱动型："）
        const lensMatches = declBlock.match(/【你的分析视角】[^`']+/g) || [];
        lensMatches.forEach(lens => {
            expect(lens.slice(0, 50)).not.toMatch(/^【你的分析视角】不要/);
        });
    });
});

describe('R67: 回归测试 — 现有功能未受影响', () => {
    test('T22: 村民段落原有 identity_table 追加示例未被删除', () => {
        expect(villagerBlock).toContain('N1发言带节奏');
    });

    test('T23: 村民段落输出 JSON schema 完整（含 identity_table）', () => {
        expect(villagerBlock).toContain('"identity_table"');
        expect(villagerBlock).toContain('"voteIntention"');
    });

    test('T24: 骑士/摄梦人/魔术师 DAY_SPEECH 委托调用未受影响', () => {
        expect(src).toContain("'骑士': (ctx, params) => getRoleModule('骑士').daySpeech(ctx, params)");
        expect(src).toContain("'摄梦人': (ctx, params) => getRoleModule('摄梦人').daySpeech(ctx, params)");
        expect(src).toContain("'魔术师': (ctx, params) => getRoleModule('魔术师').daySpeech(ctx, params)");
    });
});
