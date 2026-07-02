/**
 * Round 69: 猎人/守卫 DAY_SPEECH personalityLens + 发言字数差异化
 *
 * T1-T7   猎人 7 种个性类型分支 + 变量声明
 * T8-T14  守卫 7 种个性类型分支 + 变量声明
 * T15-T17 发言字数差异化（猎人 aggressive/cautious/default）
 * T18-T20 发言字数差异化（守卫 aggressive/steady/default）
 * T21-T23 注入位置验证（策略要点之后、思维链之前）
 * T24-T25 白熊效应检查（正向指令，无"不要""禁止"等）
 * T26-T28 回归（Step0/identity_table/personalityType 链路）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

function getHunterBlock() {
    const start = src.indexOf("'猎人': (ctx, params) =>");
    if (start === -1) throw new Error('猎人函数未找到');
    return src.slice(start, start + 4500);
}

function getGuardBlock() {
    const start = src.indexOf("'守卫': (ctx, params) =>");
    if (start === -1) throw new Error('守卫函数未找到');
    // R104: window expanded from 6000 (guard block is now 6665 chars; ${guardSpeechLen} at ~6463)
    return src.slice(start, start + 7000);
}

// ═══════════════════════════════════════════════════════
// T1-T7: 猎人 personalityLens 分支
// ═══════════════════════════════════════════════════════

test('T1: 猎人声明 hunterPersonalityType 变量', () => {
    expect(getHunterBlock()).toContain("const hunterPersonalityType = params.personalityType || ''");
});

test('T2: 猎人声明 hunterPersonalityLens 变量', () => {
    expect(getHunterBlock()).toContain("let hunterPersonalityLens = ''");
});

test('T3: 猎人 logical/analytical 分支', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'logical' || hunterPersonalityType === 'analytical'");
    expect(block).toContain('逻辑推演型');
});

test('T4: 猎人 aggressive 分支', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'aggressive'");
    expect(block).toContain('强势出击型');
});

test('T5: 猎人 emotional 分支', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'emotional'");
    expect(block).toContain('感知驱动型');
});

test('T6: 猎人 contrarian 分支', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'contrarian'");
    expect(block).toContain('反向质疑型');
});

test('T7: 猎人 cunning/cautious/steady 分支', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'cunning'");
    expect(block).toContain('提问引导型');
    expect(block).toContain("hunterPersonalityType === 'cautious'");
    expect(block).toContain('精炼谨慎型');
    expect(block).toContain("hunterPersonalityType === 'steady'");
    expect(block).toContain('稳健平衡型');
});

// ═══════════════════════════════════════════════════════
// T8-T14: 守卫 personalityLens 分支
// ═══════════════════════════════════════════════════════

test('T8: 守卫声明 guardPersonalityType 变量', () => {
    expect(getGuardBlock()).toContain("const guardPersonalityType = params.personalityType || ''");
});

test('T9: 守卫声明 guardPersonalityLens 变量', () => {
    expect(getGuardBlock()).toContain("let guardPersonalityLens = ''");
});

test('T10: 守卫 logical/analytical 分支', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'logical' || guardPersonalityType === 'analytical'");
    expect(block).toContain('逻辑推演型');
});

test('T11: 守卫 aggressive 分支', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'aggressive'");
    expect(block).toContain('主动出击型');
});

test('T12: 守卫 emotional 分支', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'emotional'");
    expect(block).toContain('共情共鸣型');
});

test('T13: 守卫 contrarian 分支', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'contrarian'");
    expect(block).toContain('独立判断型');
});

test('T14: 守卫 cunning/cautious/steady 分支', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'cunning'");
    expect(block).toContain('信息潜伏型');
    expect(block).toContain("guardPersonalityType === 'cautious'");
    expect(block).toContain('低调精炼型');
    expect(block).toContain("guardPersonalityType === 'steady'");
    expect(block).toContain('平衡协调型');
});

// ═══════════════════════════════════════════════════════
// T15-T17: 猎人字数差异化
// ═══════════════════════════════════════════════════════

test('T15: 猎人 hunterSpeechLen 变量声明 + 默认值', () => {
    expect(getHunterBlock()).toContain("let hunterSpeechLen = '40-80字'");
});

test('T16: 猎人 aggressive → 40-60字', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'aggressive'");
    expect(block).toContain("hunterSpeechLen = '40-60字'");
});

test('T17: 猎人 cautious → 60-100字', () => {
    const block = getHunterBlock();
    expect(block).toContain("hunterPersonalityType === 'cautious'");
    expect(block).toContain("hunterSpeechLen = '60-100字'");
});

// ═══════════════════════════════════════════════════════
// T18-T20: 守卫字数差异化
// ═══════════════════════════════════════════════════════

test('T18: 守卫 guardSpeechLen 变量声明 + 默认值', () => {
    expect(getGuardBlock()).toContain("let guardSpeechLen = '40-70字'");
});

test('T19: 守卫 aggressive → 35-55字', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'aggressive'");
    expect(block).toContain("guardSpeechLen = '35-55字'");
});

test('T20: 守卫 steady → 45-75字', () => {
    const block = getGuardBlock();
    expect(block).toContain("guardPersonalityType === 'steady'");
    expect(block).toContain("guardSpeechLen = '45-75字'");
});

// ═══════════════════════════════════════════════════════
// T21-T23: 注入位置验证
// ═══════════════════════════════════════════════════════

test('T21: 猎人 lens 注入在策略点之后、思维链之前', () => {
    const block = getHunterBlock();
    const strategyEnd = block.indexOf('5. 心中锁定');
    const lensInject = block.indexOf('${hunterPersonalityLens}');
    const thinkStart = block.indexOf('【思维链】');
    expect(strategyEnd).toBeGreaterThan(0);
    expect(lensInject).toBeGreaterThan(0);
    expect(thinkStart).toBeGreaterThan(0);
    expect(lensInject).toBeGreaterThan(strategyEnd);
    expect(lensInject).toBeLessThan(thinkStart);
});

test('T22: 守卫 lens 注入在策略点之后、思维链之前', () => {
    const block = getGuardBlock();
    const strategyEnd = block.indexOf('5. 简短发言');
    const lensInject = block.indexOf('${guardPersonalityLens}');
    const thinkStart = block.indexOf('【思维链】');
    expect(strategyEnd).toBeGreaterThan(0);
    expect(lensInject).toBeGreaterThan(0);
    expect(thinkStart).toBeGreaterThan(0);
    expect(lensInject).toBeGreaterThan(strategyEnd);
    expect(lensInject).toBeLessThan(thinkStart);
});

test('T23: 猎人/守卫输出 JSON 使用动态字数插值', () => {
    expect(getHunterBlock()).toContain('${hunterSpeechLen}');
    expect(getGuardBlock()).toContain('${guardSpeechLen}');
});

// ═══════════════════════════════════════════════════════
// T24-T25: 白熊效应检查
// ═══════════════════════════════════════════════════════

test('T24: 猎人 lens 各分支为正向指令（无"不要""禁止"等出现在 lens 文本中）', () => {
    const block = getHunterBlock();
    const lensStart = block.indexOf("let hunterPersonalityLens = ''");
    const lensEnd = block.indexOf('let hunterSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    expect(lensBlock).not.toContain('不要说');
    expect(lensBlock).not.toContain('禁止');
    expect(lensBlock).not.toContain('绝不能');
    expect(lensBlock).not.toContain('不能说');
});

test('T25: 守卫 lens 各分支为正向指令（无"不要""禁止"等出现在 lens 文本中）', () => {
    const block = getGuardBlock();
    const lensStart = block.indexOf("let guardPersonalityLens = ''");
    const lensEnd = block.indexOf('let guardSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    expect(lensBlock).not.toContain('不要说');
    expect(lensBlock).not.toContain('禁止');
    expect(lensBlock).not.toContain('绝不能');
    expect(lensBlock).not.toContain('不能说');
});

// ═══════════════════════════════════════════════════════
// T26-T28: 回归
// ═══════════════════════════════════════════════════════

test('T26: 猎人 DAY_SPEECH Step0 关键词"开枪优先级：高"仍在', () => {
    expect(getHunterBlock()).toContain('开枪优先级：高');
});

test('T27: 守卫 DAY_SPEECH Step0 关键词"守护优先级：高"仍在', () => {
    expect(getGuardBlock()).toContain('守护优先级：高');
});

test('T28: roleParams 注释包含 R69 猎人/守卫覆盖说明', () => {
    expect(src).toContain('R67/R68/R69');
    expect(src).toContain('村民/预言家/女巫/猎人/守卫');
});
