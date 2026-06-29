/**
 * Round 73: 守卫夜间守护决策个性化（guardNightStyle）
 *
 * T1      NIGHT_GUARD case 定位可用
 * T2      guardNightPersonalityType 变量声明（从 currentPlayer?.personality?.type）
 * T3      guardNightStyle 变量声明
 * T4      aggressive 分支：主动探索型
 * T5      cautious 分支：稳健连守型
 * T6      logical/analytical 分支：信息挖掘型
 * T7      cunning 分支：博弈欺骗型
 * T8      emotional 分支：直觉感知型
 * T9      contrarian 分支：反预判型
 * T10     steady 分支：平衡渐进型
 * T11     注入位置：在 guardHistoryStep 之后、Step 1 守护优先级之前
 * T12     白熊效应合规：所有守护风格为正向描述（无"不要""禁止""不能"等负向词）
 * T13     无 params.personalityType 依赖（直接用 currentPlayer 闭包，不影响调用端）
 * T14     回归：guardHistoryStep 仍然存在
 * T15     回归：guardSubsequentHint 仍然存在
 * T16     回归：identity_table 填写指导仍然存在
 * T17     回归：禁止连守逻辑仍然存在
 * T18     回归：空守选项（null）仍然存在
 * T19     向下兼容：无个性类型时 guardNightStyle 为空字符串（不影响基本输出）
 * T20     全量：6 种守护风格关键词全部存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightGuardBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {');
    if (start === -1) throw new Error('NIGHT_GUARD case 未找到');
    // NIGHT_GUARD case 约 4450 chars（R85 新增 guardNightPeaceStep ~650 chars），用 5500 留余量
    return src.slice(start, start + 5500);
}

// ═══════════════════════════════════════════════════════
// T1: case 定位
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_GUARD case 使用花括号封闭形式可定位', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_GUARD: {')).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════
// T2-T3: 变量声明
// ═══════════════════════════════════════════════════════

test('T2: 声明 guardNightPersonalityType（从 currentPlayer?.personality?.type 读取）', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("const guardNightPersonalityType = currentPlayer?.personality?.type || ''");
});

test('T3: 声明 guardNightStyle 变量', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("let guardNightStyle = ''");
});

// ═══════════════════════════════════════════════════════
// T4-T10: 7 种个性类型分支
// ═══════════════════════════════════════════════════════

test('T4: aggressive 分支——主动探索型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'aggressive'");
    expect(block).toContain('主动探索型');
    expect(block).toContain('换守');
});

test('T5: cautious 分支——稳健连守型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'cautious'");
    expect(block).toContain('稳健连守型');
    expect(block).toContain('连守');
});

test('T6: logical/analytical 分支——信息挖掘型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'logical' || guardNightPersonalityType === 'analytical'");
    expect(block).toContain('信息挖掘型');
    expect(block).toContain('守护结果视为信息来源');
});

test('T7: cunning 分支——博弈欺骗型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'cunning'");
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('守护模式难以预测');
});

test('T8: emotional 分支——直觉感知型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
    expect(block).toContain('感知判断');
});

test('T9: contrarian 分支——反预判型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('出乎意料');
});

test('T10: steady 分支——平衡渐进型', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("guardNightPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
    expect(block).toContain('有充足理由时坚持连守');
});

// ═══════════════════════════════════════════════════════
// T11: 注入位置
// ═══════════════════════════════════════════════════════

test('T11: guardNightStyle 注入在 guardHistoryStep 之后、Step 1 守护优先级之前', () => {
    const block = getNightGuardBlock();
    const historyStepInject = block.indexOf('${guardHistoryStep}');
    const styleInject = block.indexOf('${guardNightStyle}');
    const step1 = block.indexOf('1. 【守护优先级】');
    expect(historyStepInject).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(0);
    expect(step1).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(historyStepInject);
    expect(styleInject).toBeLessThan(step1);
});

// ═══════════════════════════════════════════════════════
// T12: 白熊效应合规（正向描述）
// ═══════════════════════════════════════════════════════

test('T12: 守护风格分支均为正向描述——无"不要""禁止""不能"等负向词', () => {
    const block = getNightGuardBlock();
    // 找到 guardNightStyle 赋值区域（从声明到 return 之间）
    const styleStart = block.indexOf("let guardNightStyle = ''");
    const returnStart = block.indexOf('return `守卫守护选择');
    const styleSection = block.slice(styleStart, returnStart);
    // 白熊效应禁词（如果出现则 fail）
    expect(styleSection).not.toContain('不要频繁');
    expect(styleSection).not.toContain('禁止');
    // 正向关键词必须存在
    expect(styleSection).toContain('主动探索型');
    expect(styleSection).toContain('稳健连守型');
    expect(styleSection).toContain('信息挖掘型');
    expect(styleSection).toContain('博弈欺骗型');
    expect(styleSection).toContain('直觉感知型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡渐进型');
});

// ═══════════════════════════════════════════════════════
// T13: 调用端无需修改（currentPlayer 闭包，非 params）
// ═══════════════════════════════════════════════════════

test('T13: guardNightPersonalityType 从 currentPlayer 读取，不从 params.personalityType 读取', () => {
    const block = getNightGuardBlock();
    // 变量声明必须使用 currentPlayer，不能用 params
    const decl = block.match(/const guardNightPersonalityType\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('currentPlayer');
    expect(decl).not.toContain('params.personalityType');
});

// ═══════════════════════════════════════════════════════
// T14-T18: 回归验证
// ═══════════════════════════════════════════════════════

test('T14: 回归——guardHistoryStep 仍然存在', () => {
    const block = getNightGuardBlock();
    expect(block).toContain('guardHistoryStep');
    expect(block).toContain('守护优先级：高');
    expect(block).toContain('守护优先级：中');
});

test('T15: 回归——guardSubsequentHint 仍然存在', () => {
    const block = getNightGuardBlock();
    expect(block).toContain('guardSubsequentHint');
});

test('T16: 回归——identity_table 填写指导仍然存在', () => {
    const block = getNightGuardBlock();
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('不覆盖历史');
    expect(block).toContain('追加示例');
});

test('T17: 回归——禁止连守逻辑仍然存在', () => {
    const block = getNightGuardBlock();
    expect(block).toContain('cannotGuard');
    expect(block).toContain('禁止连守');
});

test('T18: 回归——空守选项（null）仍然存在', () => {
    const block = getNightGuardBlock();
    expect(block).toContain('数字或null(空守)');
});

// ═══════════════════════════════════════════════════════
// T19: 向下兼容
// ═══════════════════════════════════════════════════════

test('T19: 向下兼容——无个性类型时 guardNightStyle 初始化为空字符串', () => {
    const block = getNightGuardBlock();
    expect(block).toContain("let guardNightStyle = ''");
    // 确保 else 分支不存在（else 之后不加 = '' 的赋值，保持初始值）
    // 7 种 if/else if 链中无最终 else 赋值（无类型时保持 ''）
    const styleSection = block.slice(
        block.indexOf("let guardNightStyle = ''"),
        block.indexOf('return `守卫守护选择')
    );
    // 最后一个 else if 是 steady，之后不应该有 else { guardNightStyle = ... }
    const elseIdx = styleSection.lastIndexOf('} else if');
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    // 确保 else if 链结束后没有 else { 赋值
    expect(elseOnlyIdx).toBe(-1);
});

// ═══════════════════════════════════════════════════════
// T20: 全量覆盖确认
// ═══════════════════════════════════════════════════════

test('T20: 全量——6 种守护风格关键词全部在 NIGHT_GUARD case 中', () => {
    const block = getNightGuardBlock();
    const styles = ['主动探索型', '稳健连守型', '信息挖掘型', '博弈欺骗型', '直觉感知型', '反预判型', '平衡渐进型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});
