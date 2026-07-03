/**
 * Round 77: 摄梦人/魔术师 DAY_SPEECH personalityLens + speechLen 差异化
 *
 * T1      摄梦人 daySpeech 函数定位可用
 * T2      摄梦人 dwPersonalityType 变量声明（从 params.personalityType 读取）
 * T3      摄梦人 dreamweaverPersonalityLens 变量声明（初始为空字符串）
 * T4      摄梦人 aggressive 分支：主动引导型
 * T5      摄梦人 cautious 分支：低调观察型
 * T6      摄梦人 logical/analytical 分支：推理分析型
 * T7      摄梦人 cunning 分支：暗示感知型
 * T8      摄梦人 emotional 分支：直觉感知型
 * T9      摄梦人 contrarian 分支：反预判型
 * T10     摄梦人 steady 分支：平衡渐进型
 * T11     摄梦人 speechLen 差异化：aggressive 45-75 / cautious 35-60 / steady 40-65
 * T12     摄梦人 注入位置：在 lastNightInfo 之后、【发言策略三阶段】之前
 * T13     摄梦人 白熊效应合规：所有 lens 为正向描述
 * T14     摄梦人 向下兼容：无 personalityType 时 lens 为空字符串（无最终 else）
 * T15     摄梦人 回归：dreamweaverDayHistoryStep 仍然存在（读写闭环 R60）
 * T16     魔术师 daySpeech 函数定位可用
 * T17     魔术师 magPersonalityType 变量声明（从 params.personalityType 读取）
 * T18     魔术师 magicianPersonalityLens 变量声明（初始为空字符串）
 * T19     魔术师 aggressive 分支：主动修正型
 * T20     魔术师 cautious 分支：保守隐藏型
 * T21     魔术师 logical/analytical 分支：推理优化型
 * T22     魔术师 cunning 分支：博弈欺骗型
 * T23     魔术师 emotional 分支：直觉引导型
 * T24     魔术师 contrarian 分支：反预判型
 * T25     魔术师 steady 分支：平衡渐进型
 * T26     魔术师 speechLen 差异化：aggressive 50-80 / cautious 35-55 / steady 40-65
 * T27     魔术师 注入位置：在 logicMirrorHint 之后、【魔术师发言三阶段策略】之前
 * T28     魔术师 白熊效应合规：所有 lens 为正向描述
 * T29     魔术师 向下兼容：无 personalityType 时 lens 为空字符串（无最终 else）
 * T30     魔术师 回归：magicianDayHistoryStep 仍然存在（读写闭环 R60）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const dwSrc = readFileSync(resolve(process.cwd(), 'src/services/rolePrompts/dreamweaver.js'), 'utf-8');
const magSrc = readFileSync(resolve(process.cwd(), 'src/services/rolePrompts/magician.js'), 'utf-8');

// 定位摄梦人 daySpeech 函数块（更新后约 3897 chars，窗口用 5500）
function getDreamweaverDayBlock() {
    const start = dwSrc.indexOf('export const getDreamweaverDaySpeechPrompt');
    if (start === -1) throw new Error('getDreamweaverDaySpeechPrompt 未找到');
    return dwSrc.slice(start, start + 7000);  // R108: +1700 chars 平安夜推断 → 5500→7000
}

// 定位魔术师 daySpeech 函数块（R110 后约 7224 chars，窗口用 8000）
function getMagicianDayBlock() {
    const start = magSrc.indexOf('export const getMagicianDaySpeechPrompt');
    if (start === -1) throw new Error('getMagicianDaySpeechPrompt 未找到');
    return magSrc.slice(start, start + 8000);
}

// ═══════════════════════════════════════════════════════
// 摄梦人 T1-T15
// ═══════════════════════════════════════════════════════

test('T1: 摄梦人 getDreamweaverDaySpeechPrompt 函数可定位', () => {
    expect(dwSrc.indexOf('export const getDreamweaverDaySpeechPrompt')).toBeGreaterThan(0);
});

test('T2: 摄梦人 声明 dwPersonalityType（从 params.personalityType 读取）', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("const dwPersonalityType = params.personalityType || ''");
});

test('T3: 摄梦人 声明 dreamweaverPersonalityLens，初始为空字符串', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("let dreamweaverPersonalityLens = ''");
});

test('T4: 摄梦人 aggressive 分支——主动引导型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'aggressive'");
    expect(block).toContain('主动引导型');
    expect(block).toContain('积极主张');
});

test('T5: 摄梦人 cautious 分支——低调观察型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'cautious'");
    expect(block).toContain('低调观察型');
    expect(block).toContain('安全边际');
});

test('T6: 摄梦人 logical/analytical 分支——推理分析型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'logical' || dwPersonalityType === 'analytical'");
    expect(block).toContain('推理分析型');
});

test('T7: 摄梦人 cunning 分支——暗示感知型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'cunning'");
    expect(block).toContain('暗示感知型');
    expect(block).toContain('话里有话');
});

test('T8: 摄梦人 emotional 分支——直觉感知型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'emotional'");
    expect(block).toContain('直觉感知型');
});

test('T9: 摄梦人 contrarian 分支——反预判型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('出人意料');
});

test('T10: 摄梦人 steady 分支——平衡渐进型', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("dwPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
});

test('T11: 摄梦人 speechLen 差异化（aggressive 45-75 / cautious 35-60 / steady 40-65）', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain("let dreamweaverSpeechLen = '40-70'");
    expect(block).toContain("dreamweaverSpeechLen = '45-75'");
    expect(block).toContain("dreamweaverSpeechLen = '35-60'");
    expect(block).toContain("dreamweaverSpeechLen = '40-65'");
    // 在输出 JSON 中被引用
    expect(block).toContain('${dreamweaverSpeechLen}');
});

test('T12: 摄梦人 lens 注入在 lastNightInfo 之后、【发言策略三阶段】之前', () => {
    const block = getDreamweaverDayBlock();
    const lensIdx = block.indexOf('${dreamweaverPersonalityLens}');
    const strategyIdx = block.indexOf('【发言策略三阶段】');
    const lastNightIdx = block.indexOf('${lastNightInfo}');
    expect(lensIdx).toBeGreaterThan(lastNightIdx);
    expect(lensIdx).toBeLessThan(strategyIdx);
});

test('T13: 摄梦人 白熊效应合规——所有 lens 分支为正向描述，无"不要""禁止"等负向词', () => {
    const block = getDreamweaverDayBlock();
    const lensStart = block.indexOf("let dreamweaverPersonalityLens = ''");
    const lensEnd = block.indexOf('let dreamweaverSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    expect(lensBlock).not.toContain('不要');
    expect(lensBlock).not.toContain('禁止');
    expect(lensBlock).not.toContain('不能');
    expect(lensBlock).not.toContain('绝不');
});

test('T14: 摄梦人 向下兼容——无 personalityType 时 lens 为空字符串（无 else 赋值）', () => {
    const block = getDreamweaverDayBlock();
    // 验证 if 链无 else { dreamweaverPersonalityLens = ... } 赋值
    // 即没有 "} else {" 后直接赋值 dreamweaverPersonalityLens 的情况
    const lensStart = block.indexOf("let dreamweaverPersonalityLens = ''");
    const lensEnd = block.indexOf('let dreamweaverSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    // 检查没有兜底 else 赋值（lensBlock 中不存在既无 if 也无 else if 的 dreamweaverPersonalityLens = 赋值）
    const elseIdx = lensBlock.lastIndexOf('} else {');
    if (elseIdx !== -1) {
        const afterElse = lensBlock.slice(elseIdx);
        expect(afterElse).not.toContain("dreamweaverPersonalityLens = '\\n");
    }
});

test('T15: 摄梦人 回归——dreamweaverDayHistoryStep 读写闭环仍然存在', () => {
    const block = getDreamweaverDayBlock();
    expect(block).toContain('dreamweaverDayHistoryStep');
    expect(block).toContain('连梦候选');
    expect(block).toContain('${dreamweaverDayHistoryStep}');
});

// ═══════════════════════════════════════════════════════
// 魔术师 T16-T30
// ═══════════════════════════════════════════════════════

test('T16: 魔术师 getMagicianDaySpeechPrompt 函数可定位', () => {
    expect(magSrc.indexOf('export const getMagicianDaySpeechPrompt')).toBeGreaterThan(0);
});

test('T17: 魔术师 声明 magPersonalityType（从 params.personalityType 读取）', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("const magPersonalityType = params.personalityType || ''");
});

test('T18: 魔术师 声明 magicianPersonalityLens，初始为空字符串', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("let magicianPersonalityLens = ''");
});

test('T19: 魔术师 aggressive 分支——主动修正型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'aggressive'");
    expect(block).toContain('主动修正型');
    expect(block).toContain('立即主动翻牌');
});

test('T20: 魔术师 cautious 分支——保守隐藏型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'cautious'");
    expect(block).toContain('保守隐藏型');
    expect(block).toContain('关键时');
});

test('T21: 魔术师 logical/analytical 分支——推理优化型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'logical' || magPersonalityType === 'analytical'");
    expect(block).toContain('推理优化型');
    expect(block).toContain('数据驱动');
});

test('T22: 魔术师 cunning 分支——博弈欺骗型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'cunning'");
    expect(block).toContain('博弈欺骗型');
    expect(block).toContain('信息噪音');
});

test('T23: 魔术师 emotional 分支——直觉引导型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'emotional'");
    expect(block).toContain('直觉引导型');
});

test('T24: 魔术师 contrarian 分支——反预判型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'contrarian'");
    expect(block).toContain('反预判型');
    expect(block).toContain('出其不意');
});

test('T25: 魔术师 steady 分支——平衡渐进型', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("magPersonalityType === 'steady'");
    expect(block).toContain('平衡渐进型');
    expect(block).toContain('稳定推进');
});

test('T26: 魔术师 speechLen 差异化（aggressive 50-80 / cautious 35-55 / steady 40-65）', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain("let magicianSpeechLen = '40-70'");
    expect(block).toContain("magicianSpeechLen = '50-80'");
    expect(block).toContain("magicianSpeechLen = '35-55'");
    expect(block).toContain("magicianSpeechLen = '40-65'");
    // 在输出 JSON 中被引用
    expect(block).toContain('${magicianSpeechLen}');
});

test('T27: 魔术师 lens 注入在 logicMirrorHint 之后、【魔术师发言三阶段策略】之前', () => {
    const block = getMagicianDayBlock();
    const lensIdx = block.indexOf('${magicianPersonalityLens}');
    const strategyIdx = block.indexOf('【魔术师发言三阶段策略】');
    const mirrorIdx = block.indexOf('${logicMirrorHint}');
    expect(lensIdx).toBeGreaterThan(mirrorIdx);
    expect(lensIdx).toBeLessThan(strategyIdx);
});

test('T28: 魔术师 白熊效应合规——所有 lens 分支为正向描述，无"不要""禁止"等负向词', () => {
    const block = getMagicianDayBlock();
    const lensStart = block.indexOf("let magicianPersonalityLens = ''");
    const lensEnd = block.indexOf('let magicianSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    expect(lensBlock).not.toContain('不要');
    expect(lensBlock).not.toContain('禁止');
    expect(lensBlock).not.toContain('不能');
    expect(lensBlock).not.toContain('绝不');
});

test('T29: 魔术师 向下兼容——无 personalityType 时 lens 为空字符串（无兜底 else 赋值）', () => {
    const block = getMagicianDayBlock();
    const lensStart = block.indexOf("let magicianPersonalityLens = ''");
    const lensEnd = block.indexOf('let magicianSpeechLen');
    const lensBlock = block.slice(lensStart, lensEnd);
    const elseIdx = lensBlock.lastIndexOf('} else {');
    if (elseIdx !== -1) {
        const afterElse = lensBlock.slice(elseIdx);
        expect(afterElse).not.toContain("magicianPersonalityLens = '\\n");
    }
});

test('T30: 魔术师 回归——magicianDayHistoryStep 读写闭环仍然存在', () => {
    const block = getMagicianDayBlock();
    expect(block).toContain('magicianDayHistoryStep');
    expect(block).toContain('换刀候选');
    expect(block).toContain('${magicianDayHistoryStep}');
});
