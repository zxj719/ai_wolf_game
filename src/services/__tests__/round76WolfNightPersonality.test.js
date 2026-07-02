/**
 * Round 76: 狼人 NIGHT_WOLF 刀口选择风格个性化（wolfNightStyle）
 *
 * T1      NIGHT_WOLF case 定位可用
 * T2      wolfNightPersonalityType 变量声明（从 currentPlayer?.personality?.type）
 * T3      wolfNightStyle 变量声明（初始为空字符串）
 * T4      aggressive 分支：主动锁刀型
 * T5      cautious 分支：保守规避型
 * T6      logical/analytical 分支：推理优化型
 * T7      cunning 分支：博弈迷雾型
 * T8      emotional 分支：直觉感知型
 * T9      contrarian 分支：反预判型
 * T10     steady 分支：平衡渐进型
 * T11     注入位置：在 wolfHistoryStep 之后、1.【角色推断】之前
 * T12     白熊效应合规：所有刀口风格为正向描述（无"不要""禁止""不能"等负向词）
 * T13     无 params.personalityType 依赖（直接用 currentPlayer 闭包，不影响调用端）
 * T14     回归：wolfHistoryStep 仍然存在（读取历史刀口）
 * T15     回归：威胁评估参考（wolfPriorityStr）仍然存在
 * T16     回归：identity_table 战略更新指导仍然存在
 * T17     回归：multiWolfHint 多狼协作逻辑仍然存在
 * T18     回归：输出 schema（targetId/reasoning/thought/identity_table）仍然存在
 * T19     向下兼容：无个性类型时 wolfNightStyle 为空字符串（无最终 else 赋值）
 * T20     全量：7 种刀口风格关键词全部存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightWolfBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
    if (start === -1) throw new Error('NIGHT_WOLF case 未找到');
    // NIGHT_WOLF block 原 3287 chars，R84+R102 后约 7994 chars，用 9000 留余量
    return src.slice(start, start + 9000);
}

// ═══════════════════════════════════════════════════════
// T1: case 定位
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_WOLF case 可定位', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {')).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════
// T2-T3: 变量声明
// ═══════════════════════════════════════════════════════

test('T2: 声明 wolfNightPersonalityType（从 currentPlayer?.personality?.type 读取）', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("const wolfNightPersonalityType = currentPlayer?.personality?.type || ''");
});

test('T3: 声明 wolfNightStyle 变量，初始为空字符串', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("let wolfNightStyle = ''");
});

// ═══════════════════════════════════════════════════════
// T4-T10: 7 种个性类型分支
// ═══════════════════════════════════════════════════════

test('T4: aggressive 分支——主动锁刀型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'aggressive'");
    expect(block).toContain('主动锁刀型');
    expect(block).toContain('confidence 最高的威胁目标');
});

test('T5: cautious 分支——保守规避型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'cautious'");
    expect(block).toContain('保守规避型');
    expect(block).toContain('最安全');
});

test('T6: logical/analytical 分支——推理优化型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'logical' || wolfNightPersonalityType === 'analytical'");
    expect(block).toContain('推理优化型');
    expect(block).toContain('期望价值');
});

test('T7: cunning 分支——博弈迷雾型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'cunning'");
    expect(block).toContain('博弈迷雾型');
    expect(block).toContain('刀口方向假象');
});

test('T8: emotional 分支——直觉感知型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
    expect(block).toContain('威胁感知先于');
});

test('T9: contrarian 分支——反预判型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('守卫最不可能守护');
});

test('T10: steady 分支——平衡渐进型', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("wolfNightPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
    expect(block).toContain('目标连续性');
});

// ═══════════════════════════════════════════════════════
// T11: 注入位置正确
// ═══════════════════════════════════════════════════════

test('T11: wolfNightStyle 注入在 wolfHistoryStep 之后、1.【角色推断】之前', () => {
    const block = getNightWolfBlock();
    const historyStepInject = block.indexOf('${wolfHistoryStep}');
    const styleInject = block.indexOf('${wolfNightStyle}');
    const step1Idx = block.indexOf('1. 【角色推断】');
    expect(historyStepInject).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(0);
    expect(step1Idx).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(historyStepInject);
    expect(styleInject).toBeLessThan(step1Idx);
});

// ═══════════════════════════════════════════════════════
// T12: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T12: 刀口风格分支均为正向描述——无"不要""禁止"等负向词', () => {
    const block = getNightWolfBlock();
    const styleStart = block.indexOf("let wolfNightStyle = ''");
    const styleEnd = block.indexOf('return `狼人袭击决策', styleStart);
    const styleSection = block.slice(styleStart, styleEnd);
    expect(styleSection).not.toContain('不要刀');
    expect(styleSection).not.toContain('禁止');
    // 正向风格关键词必须存在
    expect(styleSection).toContain('主动锁刀型');
    expect(styleSection).toContain('保守规避型');
    expect(styleSection).toContain('推理优化型');
    expect(styleSection).toContain('博弈迷雾型');
    expect(styleSection).toContain('直觉感知型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡渐进型');
});

// ═══════════════════════════════════════════════════════
// T13: 调用端无需修改
// ═══════════════════════════════════════════════════════

test('T13: wolfNightPersonalityType 从 currentPlayer 读取，不从 params 读取', () => {
    const block = getNightWolfBlock();
    const decl = block.match(/const wolfNightPersonalityType\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('currentPlayer');
    expect(decl).not.toContain('params.personalityType');
});

// ═══════════════════════════════════════════════════════
// T14-T18: 回归验证
// ═══════════════════════════════════════════════════════

test('T14: 回归——wolfHistoryStep 仍然存在（读取历史刀口）', () => {
    const block = getNightWolfBlock();
    expect(block).toContain('wolfHistoryStep');
    expect(block).toContain('高优先刀口');
});

test('T15: 回归——威胁评估参考（wolfPriorityStr）仍然存在', () => {
    const block = getNightWolfBlock();
    expect(block).toContain('${wolfPriorityStr}');
    expect(block).toContain('威胁评估参考');
});

test('T16: 回归——identity_table 战略更新指导仍然存在', () => {
    const block = getNightWolfBlock();
    expect(block).toContain('identity_table 战略更新');
    expect(block).toContain('追加不覆盖历史');
});

test('T17: 回归——multiWolfHint 多狼协作逻辑仍然存在', () => {
    const block = getNightWolfBlock();
    expect(block).toContain('multiWolfHint');
    expect(block).toContain('多狼协作');
});

test('T18: 回归——输出 schema（targetId/reasoning/thought/identity_table）仍然存在', () => {
    const block = getNightWolfBlock();
    expect(block).toContain('"targetId"');
    expect(block).toContain('"reasoning"');
    expect(block).toContain('"thought"');
    expect(block).toContain('"identity_table"');
});

// ═══════════════════════════════════════════════════════
// T19: 向下兼容
// ═══════════════════════════════════════════════════════

test('T19: 向下兼容——无个性类型时 wolfNightStyle 为空字符串（无最终 else 赋值）', () => {
    const block = getNightWolfBlock();
    expect(block).toContain("let wolfNightStyle = ''");
    const styleSection = block.slice(
        block.indexOf("let wolfNightStyle = ''"),
        block.indexOf('return `狼人袭击决策')
    );
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    expect(elseOnlyIdx).toBe(-1);
});

// ═══════════════════════════════════════════════════════
// T20: 全量覆盖确认
// ═══════════════════════════════════════════════════════

test('T20: 全量——7 种刀口风格关键词全部在 NIGHT_WOLF case 中', () => {
    const block = getNightWolfBlock();
    const styles = ['主动锁刀型', '保守规避型', '推理优化型', '博弈迷雾型', '直觉感知型', '反预判型', '平衡渐进型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});
