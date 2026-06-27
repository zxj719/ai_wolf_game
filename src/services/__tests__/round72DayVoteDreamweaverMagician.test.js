/**
 * Round 72: 摄梦人/魔术师 DAY_VOTE 读写闭环补完（梦票对齐 + 换票对齐）
 *
 * 背景：摄梦人/魔术师在 DAY_SPEECH 写入"连梦候选"/"换刀候选"到 identity_table，
 *       但 DAY_VOTE 从未读取，与猎人(R62)、骑士(R63)同构的读写闭环缺口。
 *
 * T1   dreamweaverVoteStrategy 变量在 DAY_VOTE block 中定义
 * T2   dreamweaverVoteStrategy 读取 identity_table 中"连梦候选"
 * T3   dreamweaverVoteStrategy 包含梦票对齐原则说明（投票 > 夜间入梦）
 * T4   dreamweaverVoteStrategy 有场景评估框架（能/不能翻转票型）
 * T5   dreamweaverVoteStrategy 有防御候选例外处理（防御入梦候选）
 * T6   dreamweaverVoteStrategy 有无候选时的 fallback（跟投预言家查杀）
 * T7   magicianVoteStrategy 变量在 DAY_VOTE block 中定义
 * T8   magicianVoteStrategy 读取 identity_table 中"换刀候选"
 * T9   magicianVoteStrategy 包含换票对齐原则说明
 * T10  magicianVoteStrategy 有场景评估框架（能/不能翻转票型）
 * T11  magicianVoteStrategy 有无候选时的 fallback（跟投预言家查杀）
 * T12  摄梦人分支接入三元链（playerRole === '摄梦人'）
 * T13  魔术师分支接入三元链（playerRole === '魔术师'）
 * T14  三元链顺序正确：骑士 > 摄梦人 > 魔术师 > 通用 fallback
 * T15  dreamweaverVoteStrategy 模板字符串内容无负向禁止词（白熊效应合规）
 * T16  magicianVoteStrategy 模板字符串内容无负向禁止词（白熊效应合规）
 * T17  回归：knightVoteStrategy 仍在（R63 未破坏）
 * T18  回归：hunterVoteStrategy 仍在（R62 未破坏）
 * T19  回归：wolfDefenseTrigger 仍在（R65 未破坏）
 * T20  回归：voteStyleHint 仍在（R71 未破坏）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// Use "case PROMPT_ACTIONS.DAY_VOTE: {" (with brace) to avoid getCOTTemplate's fake case (R12 LEARNINGS)
function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    // Window: 13000 chars to cover the full extended case block (R72 added ~600 chars)
    return src.slice(start, start + 13000);
}

// Extract just the dreamweaverVoteStrategy template string content
function getDreamweaverStrategyContent() {
    const block = getDayVoteBlock();
    const start = block.indexOf('const dreamweaverVoteStrategy = `');
    if (start === -1) throw new Error('dreamweaverVoteStrategy not found');
    const templateStart = start + 'const dreamweaverVoteStrategy = `'.length;
    const templateEnd = block.indexOf('`;\n', templateStart);
    return block.slice(templateStart, templateEnd);
}

// Extract just the magicianVoteStrategy template string content
function getMagicianStrategyContent() {
    const block = getDayVoteBlock();
    const start = block.indexOf('const magicianVoteStrategy = `');
    if (start === -1) throw new Error('magicianVoteStrategy not found');
    const templateStart = start + 'const magicianVoteStrategy = `'.length;
    const templateEnd = block.indexOf('`;\n', templateStart);
    return block.slice(templateStart, templateEnd);
}

// ═══════════════════════════════════════════════════════
// T1-T6: 摄梦人投票策略
// ═══════════════════════════════════════════════════════

test('T1: dreamweaverVoteStrategy 在 DAY_VOTE block 中定义', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dreamweaverVoteStrategy = `');
});

test('T2: dreamweaverVoteStrategy 读取 identity_table 中"连梦候选"', () => {
    const content = getDreamweaverStrategyContent();
    expect(content).toContain('连梦候选');
    expect(content).toContain('identity_table');
});

test('T3: dreamweaverVoteStrategy 包含梦票对齐原则（投票出局 > 夜间入梦）', () => {
    const content = getDreamweaverStrategyContent();
    // 应该说明投票优先于夜间入梦能力
    expect(content).toContain('投票');
    expect(content).toMatch(/投票.+夜间/s);
});

test('T4: dreamweaverVoteStrategy 有场景评估框架', () => {
    const content = getDreamweaverStrategyContent();
    expect(content).toContain('场景评估');
    // 两种场景
    expect(content).toContain('能推票出局');
    expect(content).toContain('无法翻转票型');
});

test('T5: dreamweaverVoteStrategy 有防御候选例外处理', () => {
    const content = getDreamweaverStrategyContent();
    expect(content).toContain('防御入梦候选');
});

test('T6: dreamweaverVoteStrategy 有无候选时 fallback（跟投预言家查杀）', () => {
    const content = getDreamweaverStrategyContent();
    expect(content).toContain('跟投预言家查杀');
});

// ═══════════════════════════════════════════════════════
// T7-T11: 魔术师投票策略
// ═══════════════════════════════════════════════════════

test('T7: magicianVoteStrategy 在 DAY_VOTE block 中定义', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const magicianVoteStrategy = `');
});

test('T8: magicianVoteStrategy 读取 identity_table 中"换刀候选"', () => {
    const content = getMagicianStrategyContent();
    expect(content).toContain('换刀候选');
    expect(content).toContain('identity_table');
});

test('T9: magicianVoteStrategy 包含换票对齐原则', () => {
    const content = getMagicianStrategyContent();
    // 应该说明投票优先于夜间换刀
    expect(content).toContain('投票');
    expect(content).toMatch(/投票.+夜间/s);
});

test('T10: magicianVoteStrategy 有场景评估框架', () => {
    const content = getMagicianStrategyContent();
    expect(content).toContain('场景评估');
    expect(content).toContain('能推票出局');
    expect(content).toContain('无法翻转票型');
});

test('T11: magicianVoteStrategy 有无候选时 fallback（跟投预言家查杀）', () => {
    const content = getMagicianStrategyContent();
    expect(content).toContain('跟投预言家查杀');
});

// ═══════════════════════════════════════════════════════
// T12-T14: 三元链接入
// ═══════════════════════════════════════════════════════

test("T12: 摄梦人分支接入三元链（playerRole === '摄梦人'）", () => {
    const block = getDayVoteBlock();
    expect(block).toContain("playerRole === '摄梦人'");
    // 摄梦人分支应该使用 dreamweaverVoteStrategy
    const dreamIdx = block.indexOf("playerRole === '摄梦人'");
    const afterDream = block.slice(dreamIdx, dreamIdx + 80);
    expect(afterDream).toContain('dreamweaverVoteStrategy');
});

test("T13: 魔术师分支接入三元链（playerRole === '魔术师'）", () => {
    const block = getDayVoteBlock();
    expect(block).toContain("playerRole === '魔术师'");
    // 魔术师分支应该使用 magicianVoteStrategy
    const magIdx = block.indexOf("playerRole === '魔术师'");
    const afterMag = block.slice(magIdx, magIdx + 80);
    expect(afterMag).toContain('magicianVoteStrategy');
});

test('T14: 三元链顺序正确 — 骑士 > 摄梦人 > 魔术师 > 通用 fallback', () => {
    const block = getDayVoteBlock();
    const knightIdx = block.indexOf("playerRole === '骑士'");
    const dreamIdx = block.indexOf("playerRole === '摄梦人'");
    const magIdx = block.indexOf("playerRole === '魔术师'");
    const fallbackIdx = block.indexOf('【投票策略】有查杀');
    // All found
    expect(knightIdx).toBeGreaterThan(-1);
    expect(dreamIdx).toBeGreaterThan(-1);
    expect(magIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    // Order check
    expect(knightIdx).toBeLessThan(dreamIdx);
    expect(dreamIdx).toBeLessThan(magIdx);
    expect(magIdx).toBeLessThan(fallbackIdx);
});

// ═══════════════════════════════════════════════════════
// T15-T16: 白熊效应合规（模板字符串内容无负向禁止词）
// ═══════════════════════════════════════════════════════

test('T15: dreamweaverVoteStrategy 模板内容无负向禁止词（白熊效应合规）', () => {
    const content = getDreamweaverStrategyContent();
    // 白熊效应：提示词中不能有负向禁止词
    expect(content).not.toContain('绝不能');
    expect(content).not.toContain('禁止');
    // 检查"不要" - 允许 "不要覆盖" 这类技术性追加格式说明，但不应有发言禁忌
    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.includes('不要')) {
            // Only allow it in a context that refers to avoiding wrong votes (这里是"不要"作为策略，不是禁止词)
            // The dreamweaver strategy shouldn't have "不要" at all if we wrote it correctly
            expect(line).toMatch(/不要.*覆盖|不要.*重复/); // Only allow non-taboo usages
        }
    });
});

test('T16: magicianVoteStrategy 模板内容无负向禁止词（白熊效应合规）', () => {
    const content = getMagicianStrategyContent();
    expect(content).not.toContain('绝不能');
    expect(content).not.toContain('禁止');
});

// ═══════════════════════════════════════════════════════
// T17-T20: 回归测试
// ═══════════════════════════════════════════════════════

test('T17: 回归 — knightVoteStrategy 仍在 DAY_VOTE（R63 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('knightVoteStrategy');
    expect(block).toContain('决斗候选');
});

test('T18: 回归 — hunterVoteStrategy 仍在 DAY_VOTE（R62 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('hunterVoteStrategy');
    expect(block).toContain('开枪优先级：高');
});

test('T19: 回归 — wolfDefenseTrigger 仍在 DAY_VOTE（R65 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('wolfDefenseTrigger');
    expect(block).toContain('高优先刀口');
});

test('T20: 回归 — voteStyleHint 仍在 DAY_VOTE（R71 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('voteStyleHint');
    expect(block).toContain('votePersonalityType');
});
