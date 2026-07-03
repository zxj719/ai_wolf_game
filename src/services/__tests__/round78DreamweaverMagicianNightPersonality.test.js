/**
 * Round 78: 摄梦人 NIGHT_DREAMWEAVER + 魔术师 NIGHT_MAGICIAN 夜间决策风格个性化
 *
 * T1      NIGHT_DREAMWEAVER case 定位可用（带花括号形式）
 * T2      dreamweaverNightPersonalityType 变量声明（从 currentPlayer?.personality?.type）
 * T3      dreamweaverNightStyle 变量声明（初始为空字符串）
 * T4      aggressive 分支：主动进攻型
 * T5      cautious 分支：谨慎保护型
 * T6      logical/analytical 分支：推理优化型
 * T7      cunning 分支：博弈欺骗型
 * T8      emotional 分支：直觉感知型
 * T9      contrarian 分支：反预判型
 * T10     steady 分支：平衡渐进型
 * T11     注入位置：在 dreamweaverHistoryStep 之后、Step1 之前
 * T12     白熊效应合规：所有风格为正向描述（无"不要""禁止""不能""绝不"等负向词）
 * T13     从 currentPlayer 读取，不从 params 读取（无需修改调用端）
 * T14     回归：dreamweaverHistoryStep（读写闭环 Step0）仍然存在
 * T15     回归：hasRevealed 殉情逻辑仍然存在
 * T16     回归：dwStrategyHints 策略提示仍然存在
 * T17     回归：identity_table 填写指导仍然存在
 * T18     回归：输出 schema（dreamTarget/dreamMode/thought/identity_table）仍然存在
 * T19     向下兼容：无个性类型时 dreamweaverNightStyle 为空（无最终 else 赋值）
 * T20     全量：7 种入梦风格关键词全部存在
 *
 * T21     getMagicianNightActionPrompt 函数可定位（magician.js）
 * T22     personalityType 在 params 解构中已声明
 * T23     magicianNightPersonalityType 变量声明（从 personalityType 读取）
 * T24     magicianNightStyle 变量声明（初始为空字符串）
 * T25     aggressive 分支：主动换刀型
 * T26     cautious 分支：保守自保型
 * T27     logical/analytical 分支：推理计算型
 * T28     cunning 分支：博弈欺骗型
 * T29     emotional 分支：直觉感知型
 * T30     contrarian 分支：反预判型
 * T31     steady 分支：平衡稳健型
 * T32     注入位置：在 magicianHistoryStep 之后、Step 1 之前
 * T33     白熊效应合规：所有风格为正向描述（无"不要""禁止""不能""绝不"等负向词）
 * T34     aiPrompts.js 传入 personalityType 到 nightAction 调用
 * T35     回归：magicianHistoryStep（读写闭环 Step0）仍然存在
 * T36     回归：hasRevealed 自保逻辑仍然存在
 * T37     回归：strategyHints 决策优先级系统仍然存在
 * T38     回归：identity_table 填写指导仍然存在
 * T39     向下兼容：无个性类型时 magicianNightStyle 为空（无最终 else 赋值）
 * T40     全量：7 种换刀风格关键词全部存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');
const magicianSrc = readFileSync(resolve(process.cwd(), 'src/services/rolePrompts/magician.js'), 'utf-8');

function getNightDreamweaverBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {');
    if (start === -1) throw new Error('NIGHT_DREAMWEAVER case 未找到');
    // R107 新增平安夜推断后 block 8037 chars，用 8500 留余量
    return src.slice(start, start + 8500);
}

function getMagicianNightFnBlock() {
    const start = magicianSrc.indexOf('export const getMagicianNightActionPrompt');
    if (start === -1) throw new Error('getMagicianNightActionPrompt 未找到');
    // 当前函数 5566 chars，用 7500 留余量
    return magicianSrc.slice(start, start + 7500);
}

// ═══════════════════════════════════════════════════════
// NIGHT_DREAMWEAVER 测试（T1-T20）
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_DREAMWEAVER case 可定位（带花括号）', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER: {')).toBeGreaterThan(0);
});

test('T2: 声明 dreamweaverNightPersonalityType（从 currentPlayer?.personality?.type 读取）', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("const dreamweaverNightPersonalityType = currentPlayer?.personality?.type || ''");
});

test('T3: 声明 dreamweaverNightStyle 变量，初始为空字符串', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("let dreamweaverNightStyle = ''");
});

test('T4: aggressive 分支——主动进攻型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'aggressive'");
    expect(block).toContain('主动进攻型');
    expect(block).toContain('连梦阈值');
});

test('T5: cautious 分支——谨慎保护型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'cautious'");
    expect(block).toContain('谨慎保护型');
    expect(block).toContain('防御模式最高优先');
});

test('T6: logical/analytical 分支——推理优化型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'logical' || dreamweaverNightPersonalityType === 'analytical'");
    expect(block).toContain('推理优化型');
    expect(block).toContain('期望收益');
});

test('T7: cunning 分支——博弈欺骗型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'cunning'");
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('连梦链');
});

test('T8: emotional 分支——直觉感知型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
    expect(block).toContain('情感信号先于');
});

test('T9: contrarian 分支——反预判型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('入梦方向迷雾');
});

test('T10: steady 分支——平衡渐进型', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("dreamweaverNightPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
    expect(block).toContain('目标的连续性');
});

test('T11: dreamweaverNightStyle 注入在 dreamweaverHistoryStep 之后、Step1 之前', () => {
    const block = getNightDreamweaverBlock();
    const histIdx = block.indexOf('${dreamweaverHistoryStep}');
    const styleIdx = block.indexOf('${dreamweaverNightStyle}');
    const step1Idx = block.indexOf('Step1: 场上谁是核心好人');
    expect(histIdx).toBeGreaterThan(0);
    expect(styleIdx).toBeGreaterThan(0);
    expect(step1Idx).toBeGreaterThan(0);
    expect(styleIdx).toBeGreaterThan(histIdx);
    expect(styleIdx).toBeLessThan(step1Idx);
});

test('T12: 白熊效应合规——入梦风格分支均为正向描述（无"不要""禁止""不能""绝不"）', () => {
    const block = getNightDreamweaverBlock();
    const styleStart = block.indexOf("let dreamweaverNightStyle = ''");
    const styleEnd = block.indexOf('return `摄梦人入梦决策', styleStart);
    const styleSection = block.slice(styleStart, styleEnd);
    expect(styleSection).not.toContain('不要');
    expect(styleSection).not.toContain('禁止');
    expect(styleSection).not.toContain('不能');
    expect(styleSection).not.toContain('绝不');
    expect(styleSection).toContain('主动进攻型');
    expect(styleSection).toContain('谨慎保护型');
    expect(styleSection).toContain('推理优化型');
    expect(styleSection).toContain('博弈欺骗型');
    expect(styleSection).toContain('直觉感知型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡渐进型');
});

test('T13: dreamweaverNightPersonalityType 从 currentPlayer 读取，不从 params 读取', () => {
    const block = getNightDreamweaverBlock();
    const decl = block.match(/const dreamweaverNightPersonalityType\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('currentPlayer');
    expect(decl).not.toContain('params.personalityType');
});

test('T14: 回归——dreamweaverHistoryStep（读写闭环 Step0）仍然存在', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain('dreamweaverHistoryStep');
    expect(block).toContain('连梦候选');
});

test('T15: 回归——hasRevealed 殉情逻辑仍然存在', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain('dwHasRevealed');
    expect(block).toContain('殉情模式');
});

test('T16: 回归——dwStrategyHints 策略提示仍然存在', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain('dwStrategyHints');
    expect(block).toContain('进攻模式');
});

test('T17: 回归——identity_table 填写指导仍然存在', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('追加不覆盖');
});

test('T18: 回归——输出 schema（dreamTarget/dreamMode/thought/identity_table）仍然存在', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain('"dreamTarget"');
    expect(block).toContain('"dreamMode"');
    expect(block).toContain('"thought"');
    expect(block).toContain('"identity_table"');
});

test('T19: 向下兼容——无个性类型时 dreamweaverNightStyle 为空（无最终 else 赋值）', () => {
    const block = getNightDreamweaverBlock();
    expect(block).toContain("let dreamweaverNightStyle = ''");
    const styleSection = block.slice(
        block.indexOf("let dreamweaverNightStyle = ''"),
        block.indexOf('return `摄梦人入梦决策')
    );
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    expect(elseOnlyIdx).toBe(-1);
});

test('T20: 全量——7 种入梦风格关键词全部在 NIGHT_DREAMWEAVER case 中', () => {
    const block = getNightDreamweaverBlock();
    const styles = ['主动进攻型', '谨慎保护型', '推理优化型', '博弈欺骗型', '直觉感知型', '反预判型', '平衡渐进型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});

// ═══════════════════════════════════════════════════════
// NIGHT_MAGICIAN 测试（T21-T40）
// ═══════════════════════════════════════════════════════

test('T21: getMagicianNightActionPrompt 函数可定位（magician.js）', () => {
    expect(magicianSrc.indexOf('export const getMagicianNightActionPrompt')).toBeGreaterThan(0);
});

test('T22: personalityType 在 params 解构中已声明', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('personalityType,');
});

test('T23: 声明 magicianNightPersonalityType（从 personalityType 读取）', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("const magicianNightPersonalityType = personalityType || ''");
});

test('T24: 声明 magicianNightStyle 变量，初始为空字符串', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("let magicianNightStyle = ''");
});

test('T25: aggressive 分支——主动换刀型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'aggressive'");
    expect(block).toContain('主动换刀型');
    expect(block).toContain('果断锁定');
});

test('T26: cautious 分支——保守自保型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'cautious'");
    expect(block).toContain('保守自保型');
    expect(block).toContain('身份安全高于');
});

test('T27: logical/analytical 分支——推理计算型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'logical' || magicianNightPersonalityType === 'analytical'");
    expect(block).toContain('推理计算型');
    expect(block).toContain('期望最高');
});

test('T28: cunning 分支——博弈欺骗型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'cunning'");
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('信息差优势');
});

test('T29: emotional 分支——直觉感知型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
    expect(block).toContain('情感信号先于');
});

test('T30: contrarian 分支——反预判型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('出人意料');
});

test('T31: steady 分支——平衡稳健型', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("magicianNightPersonalityType === 'steady'");
    expect(block).toContain('平衡稳健型');
    expect(block).toContain('策略连贯性');
});

test('T32: magicianNightStyle 注入在 magicianHistoryStep 之后、Step 1 之前', () => {
    const block = getMagicianNightFnBlock();
    const histIdx = block.indexOf('${magicianHistoryStep}');
    const styleIdx = block.indexOf('${magicianNightStyle}');
    const step1Idx = block.indexOf('Step 1: 当前局势分析');
    expect(histIdx).toBeGreaterThan(0);
    expect(styleIdx).toBeGreaterThan(0);
    expect(step1Idx).toBeGreaterThan(0);
    expect(styleIdx).toBeGreaterThan(histIdx);
    expect(styleIdx).toBeLessThan(step1Idx);
});

test('T33: 白熊效应合规——换刀风格分支均为正向描述（无"不要""禁止""不能""绝不"）', () => {
    const block = getMagicianNightFnBlock();
    const styleStart = block.indexOf("let magicianNightStyle = ''");
    const styleEnd = block.indexOf('// 构建交换限制提示', styleStart);
    const styleSection = block.slice(styleStart, styleEnd);
    expect(styleSection).not.toContain('不要');
    expect(styleSection).not.toContain('禁止');
    expect(styleSection).not.toContain('不能');
    expect(styleSection).not.toContain('绝不');
    expect(styleSection).toContain('主动换刀型');
    expect(styleSection).toContain('保守自保型');
    expect(styleSection).toContain('推理计算型');
    expect(styleSection).toContain('博弈欺骗型');
    expect(styleSection).toContain('直觉感知型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡稳健型');
});

test('T34: aiPrompts.js 传入 personalityType 到 nightAction 调用（R78 标注）', () => {
    const nightMagBlock = src.slice(
        src.indexOf('case PROMPT_ACTIONS.NIGHT_MAGICIAN:'),
        src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {')
    );
    expect(nightMagBlock).toContain("personalityType: currentPlayer?.personality?.type || ''");
});

test('T35: 回归——magicianHistoryStep（读写闭环 Step0）仍然存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('magicianHistoryStep');
    expect(block).toContain('换刀候选');
});

test('T36: 回归——hasRevealed 自保逻辑仍然存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('hasRevealed');
    expect(block).toContain('自保');
});

test('T37: 回归——strategyHints 决策优先级系统仍然存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('strategyHints');
    expect(block).toContain('决策优先级系统');
});

test('T38: 回归——identity_table 填写指导仍然存在', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('追加不覆盖历史');
});

test('T39: 向下兼容——无个性类型时 magicianNightStyle 为空（无最终 else 赋值）', () => {
    const block = getMagicianNightFnBlock();
    expect(block).toContain("let magicianNightStyle = ''");
    const styleSection = block.slice(
        block.indexOf("let magicianNightStyle = ''"),
        block.indexOf('// 构建交换限制提示')
    );
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    expect(elseOnlyIdx).toBe(-1);
});

test('T40: 全量——7 种换刀风格关键词全部在 getMagicianNightActionPrompt 中', () => {
    const block = getMagicianNightFnBlock();
    const styles = ['主动换刀型', '保守自保型', '推理计算型', '博弈欺骗型', '直觉感知型', '反预判型', '平衡稳健型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});
