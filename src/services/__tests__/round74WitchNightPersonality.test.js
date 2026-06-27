/**
 * Round 74: 女巫夜间用药策略个性化（witchNightStyle）
 *
 * T1      NIGHT_WITCH case 定位可用
 * T2      witchNightPersonalityType 变量声明（从 currentPlayer?.personality?.type）
 * T3      witchNightStyle 变量声明（初始为空字符串）
 * T4      aggressive 分支：激进出手型
 * T5      cautious 分支：保守持药型
 * T6      logical/analytical 分支：推理验证型
 * T7      cunning 分支：博弈伪装型
 * T8      emotional 分支：直觉感知型
 * T9      contrarian 分支：反预判型
 * T10     steady 分支：平衡节药型
 * T11     注入位置：在 witchHistoryStep 之后、1. 解药考量之前
 * T12     白熊效应合规：所有用药风格为正向描述（无"不要""禁止""不能"等负向词）
 * T13     无 params.personalityType 依赖（直接用 currentPlayer 闭包，不影响调用端）
 * T14     回归：witchHistoryStep 仍然存在（读取历史毒药候选）
 * T15     回归：criticalGuidance 临界推理仍然存在
 * T16     回归：identity_table 填写指导仍然存在
 * T17     回归：witchHint 首夜警告仍然存在
 * T18     回归：输出 schema（useSave/usePoison）仍然存在
 * T19     向下兼容：无个性类型时 witchNightStyle 初始化为空字符串（无 else 赋值）
 * T20     全量：7 种用药风格关键词全部存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightWitchBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:');
    if (start === -1) throw new Error('NIGHT_WITCH case 未找到');
    // NIGHT_WITCH block 原 2209 chars，新增个性块后约 4023 chars，用 5200 留余量
    return src.slice(start, start + 5200);
}

// ═══════════════════════════════════════════════════════
// T1: case 定位
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_WITCH case 可定位', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_WITCH:')).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════
// T2-T3: 变量声明
// ═══════════════════════════════════════════════════════

test('T2: 声明 witchNightPersonalityType（从 currentPlayer?.personality?.type 读取）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("const witchNightPersonalityType = currentPlayer?.personality?.type || ''");
});

test('T3: 声明 witchNightStyle 变量，初始为空字符串', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("let witchNightStyle = ''");
});

// ═══════════════════════════════════════════════════════
// T4-T10: 7 种个性类型分支
// ═══════════════════════════════════════════════════════

test('T4: aggressive 分支——激进出手型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'aggressive'");
    expect(block).toContain('激进出手型');
    expect(block).toContain('出现机会立即行动');
});

test('T5: cautious 分支——保守持药型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'cautious'");
    expect(block).toContain('保守持药型');
    expect(block).toContain('倾向保留药物');
});

test('T6: logical/analytical 分支——推理验证型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'logical' || witchNightPersonalityType === 'analytical'");
    expect(block).toContain('推理验证型');
    expect(block).toContain('量化判断再行动');
});

test('T7: cunning 分支——博弈伪装型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'cunning'");
    expect(block).toContain('博弈伪装型');
    expect(block).toContain('女巫保守');
});

test('T8: emotional 分支——直觉感知型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
    expect(block).toContain('直觉信号优先');
});

test('T9: contrarian 分支——反预判型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('预判狼人在预判你的用药节奏');
});

test('T10: steady 分支——平衡节药型', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("witchNightPersonalityType === 'steady'");
    expect(block).toContain('平衡节药型');
    expect(block).toContain('稳步积累信息再出手');
});

// ═══════════════════════════════════════════════════════
// T11: 注入位置正确
// ═══════════════════════════════════════════════════════

test('T11: witchNightStyle 注入在 witchHistoryStep 之后、1.解药考量之前', () => {
    const block = getNightWitchBlock();
    const historyStepInject = block.indexOf('${witchHistoryStep}');
    const styleInject = block.indexOf('${witchNightStyle}');
    const step1 = block.indexOf('1. 解药考量');
    expect(historyStepInject).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(0);
    expect(step1).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(historyStepInject);
    expect(styleInject).toBeLessThan(step1);
});

// ═══════════════════════════════════════════════════════
// T12: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T12: 用药风格分支均为正向描述——无"不要""禁止""不能"等负向词', () => {
    const block = getNightWitchBlock();
    const styleStart = block.indexOf("let witchNightStyle = ''");
    const returnStart = block.indexOf('return `女巫用药决策');
    const styleSection = block.slice(styleStart, returnStart);
    // 白熊效应禁词
    expect(styleSection).not.toContain('不要用毒');
    expect(styleSection).not.toContain('禁止');
    // 正向风格关键词必须存在
    expect(styleSection).toContain('激进出手型');
    expect(styleSection).toContain('保守持药型');
    expect(styleSection).toContain('推理验证型');
    expect(styleSection).toContain('博弈伪装型');
    expect(styleSection).toContain('直觉感知型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡节药型');
});

// ═══════════════════════════════════════════════════════
// T13: 调用端无需修改
// ═══════════════════════════════════════════════════════

test('T13: witchNightPersonalityType 从 currentPlayer 读取，不从 params.personalityType 读取', () => {
    const block = getNightWitchBlock();
    const decl = block.match(/const witchNightPersonalityType\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('currentPlayer');
    expect(decl).not.toContain('params.personalityType');
});

// ═══════════════════════════════════════════════════════
// T14-T18: 回归验证
// ═══════════════════════════════════════════════════════

test('T14: 回归——witchHistoryStep 仍然存在（读取历史毒药候选）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('witchHistoryStep');
    expect(block).toContain('毒药优先候选');
});

test('T15: 回归——criticalGuidance 临界推理仍然存在', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('criticalGuidance');
    expect(block).toContain('临界情况推理');
});

test('T16: 回归——identity_table 填写指导仍然存在', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('毒药优先候选');
});

test('T17: 回归——witchHint 首夜警告仍然存在', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('witchHint');
    expect(block).toContain('首夜');
});

test('T18: 回归——输出 schema（useSave/usePoison）仍然存在', () => {
    const block = getNightWitchBlock();
    expect(block).toContain('"useSave"');
    expect(block).toContain('"usePoison"');
    expect(block).toContain('"reasoning"');
    expect(block).toContain('"thought"');
});

// ═══════════════════════════════════════════════════════
// T19: 向下兼容
// ═══════════════════════════════════════════════════════

test('T19: 向下兼容——无个性类型时 witchNightStyle 为空字符串（无最终 else 赋值）', () => {
    const block = getNightWitchBlock();
    expect(block).toContain("let witchNightStyle = ''");
    const styleSection = block.slice(
        block.indexOf("let witchNightStyle = ''"),
        block.indexOf('return `女巫用药决策')
    );
    // 最后一个 else if 是 steady，之后不应该有 else { witchNightStyle = ... }
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    expect(elseOnlyIdx).toBe(-1);
});

// ═══════════════════════════════════════════════════════
// T20: 全量覆盖确认
// ═══════════════════════════════════════════════════════

test('T20: 全量——7 种用药风格关键词全部在 NIGHT_WITCH case 中', () => {
    const block = getNightWitchBlock();
    const styles = ['激进出手型', '保守持药型', '推理验证型', '博弈伪装型', '直觉感知型', '反预判型', '平衡节药型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});
