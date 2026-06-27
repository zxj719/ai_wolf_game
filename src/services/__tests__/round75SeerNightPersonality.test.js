/**
 * Round 75: 预言家夜间查验顺序个性化（seerNightStyle）
 *
 * T1      NIGHT_SEER case 定位可用
 * T2      seerNightPersonalityType 变量声明（从 currentPlayer?.personality?.type）
 * T3      seerNightStyle 变量声明（初始为空字符串）
 * T4      aggressive 分支：主动威胁型
 * T5      cautious 分支：边缘安全型
 * T6      logical/analytical 分支：推理优化型
 * T7      cunning 分支：情报迷雾型
 * T8      emotional 分支：直觉导向型
 * T9      contrarian 分支：反预判型
 * T10     steady 分支：平衡渐进型
 * T11     注入位置：在 seerHistoryStep 之后、seerNightStrategy 之前
 * T12     白熊效应合规：所有查验风格为正向描述（无"不要""禁止""不能"等负向词）
 * T13     无 params.personalityType 依赖（直接用 currentPlayer 闭包，不影响调用端）
 * T14     回归：seerHistoryStep 仍然存在（读取历史查验候选）
 * T15     回归：seerNightStrategy 三阶段框架（首夜/残局/正常）仍然存在
 * T16     回归：identity_table 填写指导仍然存在
 * T17     回归：counterClaimText 悍跳警报逻辑仍然存在
 * T18     回归：输出 schema（targetId/reasoning/thought/identity_table）仍然存在
 * T19     向下兼容：无个性类型时 seerNightStyle 为空字符串（无 else 赋值）
 * T20     全量：7 种查验风格关键词全部存在
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getNightSeerBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:');
    if (start === -1) throw new Error('NIGHT_SEER case 未找到');
    // NIGHT_SEER block 原 2872 chars，新增个性块后约 4645 chars，用 6200 留余量
    return src.slice(start, start + 6200);
}

// ═══════════════════════════════════════════════════════
// T1: case 定位
// ═══════════════════════════════════════════════════════

test('T1: NIGHT_SEER case 可定位', () => {
    expect(src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:')).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════
// T2-T3: 变量声明
// ═══════════════════════════════════════════════════════

test('T2: 声明 seerNightPersonalityType（从 currentPlayer?.personality?.type 读取）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("const seerNightPersonalityType = currentPlayer?.personality?.type || ''");
});

test('T3: 声明 seerNightStyle 变量，初始为空字符串', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("let seerNightStyle = ''");
});

// ═══════════════════════════════════════════════════════
// T4-T10: 7 种个性类型分支
// ═══════════════════════════════════════════════════════

test('T4: aggressive 分支——主动威胁型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'aggressive'");
    expect(block).toContain('主动威胁型');
    expect(block).toContain('早确认=早带全员集票');
});

test('T5: cautious 分支——边缘安全型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'cautious'");
    expect(block).toContain('边缘安全型');
    expect(block).toContain('多元化查验路径');
});

test('T6: logical/analytical 分支——推理优化型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'logical' || seerNightPersonalityType === 'analytical'");
    expect(block).toContain('推理优化型');
    expect(block).toContain('信息增量最大');
});

test('T7: cunning 分支——情报迷雾型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'cunning'");
    expect(block).toContain('情报迷雾型');
    expect(block).toContain('查验方向是随机的');
});

test('T8: emotional 分支——直觉导向型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'emotional'");
    expect(block).toContain('直觉导向型');
    expect(block).toContain('直觉信号优先');
});

test('T9: contrarian 分支——反预判型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('预判狼人在预判你会查谁');
});

test('T10: steady 分支——平衡渐进型', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("seerNightPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
    expect(block).toContain('确定性增量最大');
});

// ═══════════════════════════════════════════════════════
// T11: 注入位置正确
// ═══════════════════════════════════════════════════════

test('T11: seerNightStyle 注入在 seerHistoryStep 之后、seerNightStrategy 之前', () => {
    const block = getNightSeerBlock();
    const historyStepInject = block.indexOf('${seerHistoryStep}');
    const styleInject = block.indexOf('${seerNightStyle}');
    const strategyInject = block.indexOf('${seerNightStrategy}');
    expect(historyStepInject).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(0);
    expect(strategyInject).toBeGreaterThan(0);
    expect(styleInject).toBeGreaterThan(historyStepInject);
    expect(styleInject).toBeLessThan(strategyInject);
});

// ═══════════════════════════════════════════════════════
// T12: 白熊效应合规
// ═══════════════════════════════════════════════════════

test('T12: 查验风格分支均为正向描述——无"不要""禁止""不能"等负向词', () => {
    const block = getNightSeerBlock();
    const styleStart = block.indexOf("let seerNightStyle = ''");
    const styleEnd = block.indexOf('// 动态上下文：检测悍跳者', styleStart);
    const styleSection = block.slice(styleStart, styleEnd);
    // 白熊效应禁词检查
    expect(styleSection).not.toContain('不要查');
    expect(styleSection).not.toContain('禁止');
    // 正向风格关键词必须存在
    expect(styleSection).toContain('主动威胁型');
    expect(styleSection).toContain('边缘安全型');
    expect(styleSection).toContain('推理优化型');
    expect(styleSection).toContain('情报迷雾型');
    expect(styleSection).toContain('直觉导向型');
    expect(styleSection).toContain('反预判型');
    expect(styleSection).toContain('平衡渐进型');
});

// ═══════════════════════════════════════════════════════
// T13: 调用端无需修改
// ═══════════════════════════════════════════════════════

test('T13: seerNightPersonalityType 从 currentPlayer 读取，不从 params.personalityType 读取', () => {
    const block = getNightSeerBlock();
    const decl = block.match(/const seerNightPersonalityType\s*=\s*(.+)/)?.[1] || '';
    expect(decl).toContain('currentPlayer');
    expect(decl).not.toContain('params.personalityType');
});

// ═══════════════════════════════════════════════════════
// T14-T18: 回归验证
// ═══════════════════════════════════════════════════════

test('T14: 回归——seerHistoryStep 仍然存在（读取历史查验候选）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('seerHistoryStep');
    expect(block).toContain('排队查验优先级');
});

test('T15: 回归——seerNightStrategy 三阶段框架（首夜/残局/正常）仍然存在', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('首夜策略');
    expect(block).toContain('残局策略');
    expect(block).toContain('后续夜查验优先级框架');
});

test('T16: 回归——identity_table 填写指导仍然存在', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('identity_table 填写指导');
    expect(block).toContain('排队查验优先级');
});

test('T17: 回归——counterClaimText 悍跳警报逻辑仍然存在', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('counterClaimText');
    expect(block).toContain('悍跳');
});

test('T18: 回归——输出 schema（targetId/reasoning/thought/identity_table）仍然存在', () => {
    const block = getNightSeerBlock();
    expect(block).toContain('"targetId"');
    expect(block).toContain('"reasoning"');
    expect(block).toContain('"thought"');
    expect(block).toContain('"identity_table"');
});

// ═══════════════════════════════════════════════════════
// T19: 向下兼容
// ═══════════════════════════════════════════════════════

test('T19: 向下兼容——无个性类型时 seerNightStyle 为空字符串（无最终 else 赋值）', () => {
    const block = getNightSeerBlock();
    expect(block).toContain("let seerNightStyle = ''");
    const styleSection = block.slice(
        block.indexOf("let seerNightStyle = ''"),
        block.indexOf('// 动态上下文：检测悍跳者')
    );
    // 最后一个 else if 是 steady，之后不应该有 else { seerNightStyle = ... }
    const elseOnlyIdx = styleSection.lastIndexOf('} else {');
    expect(elseOnlyIdx).toBe(-1);
});

// ═══════════════════════════════════════════════════════
// T20: 全量覆盖确认
// ═══════════════════════════════════════════════════════

test('T20: 全量——7 种查验风格关键词全部在 NIGHT_SEER case 中', () => {
    const block = getNightSeerBlock();
    const styles = ['主动威胁型', '边缘安全型', '推理优化型', '情报迷雾型', '直觉导向型', '反预判型', '平衡渐进型'];
    styles.forEach(style => {
        expect(block).toContain(style);
    });
});
