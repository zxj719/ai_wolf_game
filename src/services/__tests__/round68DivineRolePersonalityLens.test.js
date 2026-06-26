/**
 * Round 68: 预言家/女巫 DAY_SPEECH 个性化发言风格注入（personalityLens）
 *
 * 验证：
 * T1-T8   预言家 7种个性类型分支 + 无类型 fallback
 * T9-T16  女巫 7种个性类型分支 + 无类型 fallback
 * T17-T19 注入位置验证（seer: 在要点之后思维链之前；witch: 在策略之后思维链之前）
 * T20-T22 白熊效应检查（全正向指令，无"不要""禁止"）
 * T23-T26 回归：Step0/identity_table/roleParams.personalityType 链路
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf8');

// ─── 定位工具 ───────────────────────────────────────────────────
function getSeerBlock() {
    const start = src.lastIndexOf("'预言家': (ctx, params) => {");
    const end = src.indexOf("    '女巫': (ctx, params)", start);
    return src.slice(start, end);
}

function getWitchBlock() {
    const start = src.lastIndexOf("'女巫': (ctx, params) => {");
    const end = src.indexOf("    '猎人': (ctx, params)", start);
    return src.slice(start, end);
}

function getRoleParamsBlock() {
    const caseIdx = src.indexOf("case PROMPT_ACTIONS.DAY_SPEECH");
    const rpStart = src.indexOf("const roleParams = {", caseIdx);
    const rpEnd = src.indexOf("};", rpStart) + 2;
    return src.slice(rpStart, rpEnd);
}

// ─── T1-T8: 预言家 personalityLens ─────────────────────────────
test('T1: 预言家有 seerPersonalityLens 变量声明', () => {
    const block = getSeerBlock();
    expect(block).toContain('let seerPersonalityLens');
});

test('T2: 预言家 logical 分支包含数据驱动关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'logical'");
    expect(block).toContain('数据驱动型');
});

test('T3: 预言家 aggressive 分支包含强攻关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'aggressive'");
    expect(block).toContain('强攻型');
});

test('T4: 预言家 emotional 分支包含感染型关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'emotional'");
    expect(block).toContain('感染型');
});

test('T5: 预言家 contrarian 分支包含质疑型关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'contrarian'");
    expect(block).toContain('质疑型');
});

test('T6: 预言家 cunning 分支包含谋划型关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'cunning'");
    expect(block).toContain('谋划型');
});

test('T7: 预言家 cautious 分支包含严谨型关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'cautious'");
    expect(block).toContain('严谨型');
});

test('T8: 预言家 steady 分支包含稳健型关键词', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'steady'");
    expect(block).toContain('稳健型');
});

// ─── T9-T16: 女巫 personalityLens ──────────────────────────────
test('T9: 女巫有 witchPersonalityLens 变量声明', () => {
    const block = getWitchBlock();
    expect(block).toContain('let witchPersonalityLens');
});

test('T10: 女巫 logical 分支包含分析型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'logical'");
    expect(block).toContain('分析型');
});

test('T11: 女巫 aggressive 分支包含强势型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'aggressive'");
    expect(block).toContain('强势型');
});

test('T12: 女巫 emotional 分支包含共情型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'emotional'");
    expect(block).toContain('共情型');
});

test('T13: 女巫 contrarian 分支包含逆向型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'contrarian'");
    expect(block).toContain('逆向型');
});

test('T14: 女巫 cunning 分支包含策略型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'cunning'");
    expect(block).toContain('策略型');
});

test('T15: 女巫 cautious 分支包含保守型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'cautious'");
    expect(block).toContain('保守型');
});

test('T16: 女巫 steady 分支包含稳健型关键词', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'steady'");
    expect(block).toContain('稳健型');
});

// ─── T17-T19: 注入位置验证 ─────────────────────────────────────
test('T17: 预言家 seerPersonalityLens 在发言要点之后、思维链之前', () => {
    const block = getSeerBlock();
    const reqPos = block.indexOf('预言家发言要点');
    const lensPos = block.indexOf('${seerPersonalityLens}');
    const chainPos = block.indexOf('【思维链】');
    expect(lensPos).toBeGreaterThan(reqPos);
    expect(chainPos).toBeGreaterThan(lensPos);
});

test('T18: 女巫 witchPersonalityLens 在发言策略之后、思维链之前', () => {
    const block = getWitchBlock();
    const stratPos = block.indexOf('女巫发言策略');
    const lensPos = block.indexOf('${witchPersonalityLens}');
    const chainPos = block.indexOf('【思维链】');
    expect(lensPos).toBeGreaterThan(stratPos);
    expect(chainPos).toBeGreaterThan(lensPos);
});

test('T19: seerPersonalityLens 注入在思维链 Step0 之前', () => {
    const block = getSeerBlock();
    const lensPos = block.indexOf('${seerPersonalityLens}');
    const step0Pos = block.indexOf('${seerDayHistoryStep}');
    expect(lensPos).toBeLessThan(step0Pos);
});

// ─── T20-T22: 白熊效应检查 ─────────────────────────────────────
test('T20: 预言家 seerPersonalityLens 各分支均为正向指令（无"不要"）', () => {
    const block = getSeerBlock();
    const lensStart = block.indexOf('let seerPersonalityLens');
    const lensEnd = block.indexOf('return `', lensStart);
    const lensDecl = block.slice(lensStart, lensEnd);
    // 白熊效应：lens 描述不用"不要""禁止"作为主要指令
    expect(lensDecl).not.toMatch(/你的报验风格】[^`]*不要/);
});

test('T21: 女巫 witchPersonalityLens 各分支均为正向指令（无"禁止"）', () => {
    const block = getWitchBlock();
    const lensStart = block.indexOf('let witchPersonalityLens');
    const lensEnd = block.indexOf('return `', lensStart);
    const lensDecl = block.slice(lensStart, lensEnd);
    expect(lensDecl).not.toMatch(/你的发言风格】[^`]*禁止/);
});

test('T22: 两个 lens 均以"XX驱动型/型：..."正向开头', () => {
    const seerBlock = getSeerBlock();
    const witchBlock = getWitchBlock();
    // seer lenses: each branch ends with a positive description keyword
    expect(seerBlock).toContain('数据驱动型');
    expect(seerBlock).toContain('强攻型');
    expect(seerBlock).toContain('感染型');
    // witch lenses: each branch ends with a positive description keyword
    expect(witchBlock).toContain('分析型');
    expect(witchBlock).toContain('强势型');
    expect(witchBlock).toContain('共情型');
});

// ─── T23-T26: 回归检查 ─────────────────────────────────────────
test('T23: 预言家 DAY_SPEECH 仍保留 seerDayHistoryStep（Step0 闭环不受影响）', () => {
    const block = getSeerBlock();
    expect(block).toContain('seerDayHistoryStep');
    expect(block).toContain('排队查验优先级');
});

test('T24: 女巫 DAY_SPEECH 仍保留 witchDayHistoryStep（Step0 闭环不受影响）', () => {
    const block = getWitchBlock();
    expect(block).toContain('witchDayHistoryStep');
    expect(block).toContain('毒药优先候选');
});

test('T25: roleParams 含 personalityType 字段', () => {
    const block = getRoleParamsBlock();
    expect(block).toContain('personalityType');
    expect(block).toContain("personality?.type || ''");
});

test('T26: roleParams 注释已更新以涵盖预言家/女巫', () => {
    const rpBlock = getRoleParamsBlock();
    // Comment should reference R68 or divine roles
    expect(rpBlock).toMatch(/R67\/R68|预言家.*女巫|村民.*预言家/);
});
