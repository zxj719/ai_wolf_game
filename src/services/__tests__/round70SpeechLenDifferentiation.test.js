/**
 * Round 70: 狼人/预言家/女巫/村民 DAY_SPEECH 发言字数差异化
 *
 * T1-T4   狼人 wolfSpeechLen（声明 + 默认 + aggressive/cautious + 输出JSON引用）
 * T5-T8   预言家 seerSpeechLen（声明 + 默认 + aggressive/cautious + 输出JSON引用）
 * T9-T12  女巫 witchSpeechLen（声明 + 默认 + aggressive/cautious + 输出JSON引用）
 * T13-T16 村民 villagerSpeechLen（声明 + 默认 + aggressive/cautious + 输出JSON引用）
 * T17-T20 回归验证（personalityLens 链路无破坏）
 * T21-T24 白熊效应 speechLen 块（正向无负向禁止词）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getWolfBlock() {
    // Use lastIndexOf to avoid ROLE_STRATEGY_PROMPTS '狼人' entry
    const start = src.lastIndexOf("'狼人': (ctx, params) =>");
    if (start === -1) throw new Error('狼人 DAY_SPEECH 函数未找到');
    // 窗口已从 6500 升至 7500（R88 新增 isConsecutivePeacefulWolf + consecutivePeaceHintWolf 变量块，${wolfSpeechLen} 移至 ~6636 处）
    return src.slice(start, start + 7500);
}

function getSeerBlock() {
    const start = src.lastIndexOf("'预言家': (ctx, params) =>");
    if (start === -1) throw new Error('预言家 DAY_SPEECH 函数未找到');
    return src.slice(start, start + 7000);
}

function getWitchBlock() {
    const start = src.lastIndexOf("'女巫': (ctx, params) =>");
    if (start === -1) throw new Error('女巫 DAY_SPEECH 函数未找到');
    return src.slice(start, start + 5000);
}

function getVillagerBlock() {
    const start = src.lastIndexOf("'村民': (ctx, params) =>");
    if (start === -1) throw new Error('村民 DAY_SPEECH 函数未找到');
    return src.slice(start, start + 5000);
}

// ═══════════════════════════════════════════════════════
// T1-T4: 狼人 wolfSpeechLen
// ═══════════════════════════════════════════════════════

test('T1: 狼人 wolfSpeechLen 变量声明 + 默认值 40-100字', () => {
    expect(getWolfBlock()).toContain("let wolfSpeechLen = '40-100字'");
});

test('T2: 狼人 aggressive → 35-55字', () => {
    const block = getWolfBlock();
    expect(block).toContain("wolfPersonalityType === 'aggressive'");
    expect(block).toContain("wolfSpeechLen = '35-55字'");
});

test('T3: 狼人 cautious → 60-100字', () => {
    const block = getWolfBlock();
    expect(block).toContain("wolfPersonalityType === 'cautious'");
    expect(block).toContain("wolfSpeechLen = '60-100字'");
});

test('T4: 狼人输出JSON中引用 ${wolfSpeechLen}', () => {
    const block = getWolfBlock();
    expect(block).toContain('${wolfSpeechLen}');
    // Ensure it's in the output JSON line
    const outputPos = block.indexOf('输出JSON:');
    const speechLenPos = block.indexOf('${wolfSpeechLen}');
    expect(outputPos).toBeGreaterThan(-1);
    expect(speechLenPos).toBeGreaterThan(outputPos);
});

// ═══════════════════════════════════════════════════════
// T5-T8: 预言家 seerSpeechLen
// ═══════════════════════════════════════════════════════

test('T5: 预言家 seerSpeechLen 变量声明 + 默认值 40-100字', () => {
    expect(getSeerBlock()).toContain("let seerSpeechLen = '40-100字'");
});

test('T6: 预言家 aggressive → 40-60字', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'aggressive'");
    expect(block).toContain("seerSpeechLen = '40-60字'");
});

test('T7: 预言家 cautious → 60-100字', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityType === 'cautious'");
    expect(block).toContain("seerSpeechLen = '60-100字'");
});

test('T8: 预言家输出JSON中引用 ${seerSpeechLen}', () => {
    const block = getSeerBlock();
    expect(block).toContain('${seerSpeechLen}');
    const outputPos = block.indexOf('输出JSON:');
    const speechLenPos = block.indexOf('${seerSpeechLen}');
    expect(outputPos).toBeGreaterThan(-1);
    expect(speechLenPos).toBeGreaterThan(outputPos);
});

// ═══════════════════════════════════════════════════════
// T9-T12: 女巫 witchSpeechLen
// ═══════════════════════════════════════════════════════

test('T9: 女巫 witchSpeechLen 变量声明 + 默认值 40-80字', () => {
    expect(getWitchBlock()).toContain("let witchSpeechLen = '40-80字'");
});

test('T10: 女巫 aggressive → 35-55字', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'aggressive'");
    expect(block).toContain("witchSpeechLen = '35-55字'");
});

test('T11: 女巫 cautious → 50-80字', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityType === 'cautious'");
    expect(block).toContain("witchSpeechLen = '50-80字'");
});

test('T12: 女巫输出JSON中引用 ${witchSpeechLen}', () => {
    const block = getWitchBlock();
    expect(block).toContain('${witchSpeechLen}');
    const outputPos = block.indexOf('输出JSON:');
    const speechLenPos = block.indexOf('${witchSpeechLen}');
    expect(outputPos).toBeGreaterThan(-1);
    expect(speechLenPos).toBeGreaterThan(outputPos);
});

// ═══════════════════════════════════════════════════════
// T13-T16: 村民 villagerSpeechLen
// ═══════════════════════════════════════════════════════

test('T13: 村民 villagerSpeechLen 变量声明 + 默认值 40-100字', () => {
    expect(getVillagerBlock()).toContain("let villagerSpeechLen = '40-100字'");
});

test('T14: 村民 aggressive → 35-55字', () => {
    const block = getVillagerBlock();
    expect(block).toContain("personalityType === 'aggressive'");
    expect(block).toContain("villagerSpeechLen = '35-55字'");
});

test('T15: 村民 cautious → 60-100字', () => {
    const block = getVillagerBlock();
    expect(block).toContain("personalityType === 'cautious'");
    expect(block).toContain("villagerSpeechLen = '60-100字'");
});

test('T16: 村民输出JSON中引用 ${villagerSpeechLen}', () => {
    const block = getVillagerBlock();
    expect(block).toContain('${villagerSpeechLen}');
    const outputPos = block.indexOf('输出JSON:');
    const speechLenPos = block.indexOf('${villagerSpeechLen}');
    expect(outputPos).toBeGreaterThan(-1);
    expect(speechLenPos).toBeGreaterThan(outputPos);
});

// ═══════════════════════════════════════════════════════
// T17-T20: 回归验证（personalityLens 链路无破坏）
// ═══════════════════════════════════════════════════════

test('T17: 狼人 wolfPersonalityType 变量声明存在（R70 新增）', () => {
    expect(getWolfBlock()).toContain("const wolfPersonalityType = params.personalityType || ''");
});

test('T18: 预言家 seerPersonalityLens 仍包含 aggressive/cautious 分支（R68 未破坏）', () => {
    const block = getSeerBlock();
    expect(block).toContain("seerPersonalityLens = `\\n【你的报验风格】强攻型");
    expect(block).toContain("seerPersonalityLens = `\\n【你的报验风格】严谨型");
});

test('T19: 女巫 witchPersonalityLens 仍包含 aggressive/cautious 分支（R68 未破坏）', () => {
    const block = getWitchBlock();
    expect(block).toContain("witchPersonalityLens = `\\n【你的发言风格】强势型");
    expect(block).toContain("witchPersonalityLens = `\\n【你的发言风格】保守型");
});

test('T20: 村民 personalityLens 仍包含 7 种分支（R67 未破坏）', () => {
    const block = getVillagerBlock();
    expect(block).toContain('数据驱动型');
    expect(block).toContain('感知驱动型');
    expect(block).toContain('谨慎驱动型');
    expect(block).toContain('稳健驱动型');
});

// ═══════════════════════════════════════════════════════
// T21-T24: 白熊效应检查（R1/R30 教训）
// ═══════════════════════════════════════════════════════

test('T21: 狼人 speechLen 块无负向禁止词', () => {
    const block = getWolfBlock();
    const lenStart = block.indexOf("let wolfSpeechLen = '40-100字'");
    const lenEnd = block.indexOf('return `', lenStart);
    const lenBlock = block.slice(lenStart, lenEnd);
    expect(lenBlock).not.toContain('不要');
    expect(lenBlock).not.toContain('禁止');
    expect(lenBlock).not.toContain('绝不能');
});

test('T22: 预言家 speechLen 块无负向禁止词', () => {
    const block = getSeerBlock();
    const lenStart = block.indexOf("let seerSpeechLen = '40-100字'");
    const lenEnd = block.indexOf('return `', lenStart);
    const lenBlock = block.slice(lenStart, lenEnd);
    expect(lenBlock).not.toContain('不要');
    expect(lenBlock).not.toContain('禁止');
});

test('T23: 女巫 speechLen 块无负向禁止词', () => {
    const block = getWitchBlock();
    const lenStart = block.indexOf("let witchSpeechLen = '40-80字'");
    const lenEnd = block.indexOf('return `', lenStart);
    const lenBlock = block.slice(lenStart, lenEnd);
    expect(lenBlock).not.toContain('不要');
    expect(lenBlock).not.toContain('禁止');
});

test('T24: 村民 speechLen 块无负向禁止词', () => {
    const block = getVillagerBlock();
    const lenStart = block.indexOf("let villagerSpeechLen = '40-100字'");
    const lenEnd = block.indexOf('return `', lenStart);
    const lenBlock = block.slice(lenStart, lenEnd);
    expect(lenBlock).not.toContain('不要');
    expect(lenBlock).not.toContain('禁止');
});
