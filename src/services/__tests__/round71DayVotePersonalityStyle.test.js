/**
 * Round 71: DAY_VOTE 语气风格一致性 — personalityType 影响投票理由表述风格
 *
 * T1   votePersonalityType 变量在 DAY_VOTE block 中声明
 * T2   voteStyleHint 变量声明 + 默认空字符串
 * T3   aggressive 分支设置"结论先行"风格
 * T4   cautious 分支设置"分析铺垫"风格
 * T5   emotional 分支设置"感知表达"风格
 * T6   cunning 分支设置"策略表达"风格
 * T7   contrarian 分支设置"差异化表达"风格
 * T8   ${voteStyleHint} 注入到 return 模板
 * T9   输出JSON reasoning 字段对 aggressive 有差异化描述
 * T10  输出JSON reasoning 字段对 cautious 有差异化描述
 * T11  voteStyleHint 块无负向禁止词（白熊效应合规）
 * T12  回归：wolfDefenseTrigger 仍在（R65 未破坏）
 * T13  回归：thisRoundVoteHint 仍在（R65 未破坏）
 * T14  回归：knightVoteStrategy 仍在（R63 未破坏）
 * T15  voteStyleHint 变量在 return 之前声明（顺序正确）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// Use "case PROMPT_ACTIONS.DAY_VOTE: {" (with brace) to avoid getCOTTemplate's fake case (R12 LEARNINGS)
function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    // Window: 18000 chars to cover the full case block (R121 added ~1721 chars, total ~16786)
    return src.slice(start, start + 18000);
}

// Sub-block: from votePersonalityType declaration to the return statement
function getStyleBlock() {
    const caseStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    const styleStart = src.indexOf('const votePersonalityType =', caseStart);
    const returnStart = src.indexOf('return `投票放逐阶段', caseStart);
    if (styleStart === -1 || returnStart === -1) throw new Error('votePersonalityType block not found');
    return src.slice(styleStart, returnStart);
}

// ═══════════════════════════════════════════════════════
// T1-T2: 变量声明
// ═══════════════════════════════════════════════════════

test('T1: votePersonalityType 从 currentPlayer.personality.type 读取', () => {
    const block = getDayVoteBlock();
    expect(block).toContain("const votePersonalityType = currentPlayer?.personality?.type || ''");
});

test('T2: voteStyleHint 变量声明并初始化为空字符串', () => {
    const block = getDayVoteBlock();
    expect(block).toContain("let voteStyleHint = ''");
});

// ═══════════════════════════════════════════════════════
// T3-T7: 各 personalityType 分支验证
// ═══════════════════════════════════════════════════════

test('T3: aggressive 分支设置结论先行风格', () => {
    const block = getStyleBlock();
    expect(block).toContain("votePersonalityType === 'aggressive'");
    expect(block).toContain('【投票风格—结论先行】');
});

test('T4: cautious 分支设置分析铺垫风格', () => {
    const block = getStyleBlock();
    expect(block).toContain("votePersonalityType === 'cautious'");
    expect(block).toContain('【投票风格—分析铺垫】');
});

test('T5: emotional 分支设置感知表达风格', () => {
    const block = getStyleBlock();
    expect(block).toContain("votePersonalityType === 'emotional'");
    expect(block).toContain('【投票风格—感知表达】');
});

test('T6: cunning 分支设置策略表达风格', () => {
    const block = getStyleBlock();
    expect(block).toContain("votePersonalityType === 'cunning'");
    expect(block).toContain('【投票风格—策略表达】');
});

test('T7: contrarian 分支设置差异化表达风格', () => {
    const block = getStyleBlock();
    expect(block).toContain("votePersonalityType === 'contrarian'");
    expect(block).toContain('【投票风格—差异化表达】');
});

// ═══════════════════════════════════════════════════════
// T8: 注入验证
// ═══════════════════════════════════════════════════════

test('T8: ${voteStyleHint} 注入到 return 模板', () => {
    const block = getDayVoteBlock();
    const returnStart = block.indexOf('return `投票放逐阶段');
    expect(returnStart).toBeGreaterThan(-1);
    const returnBlock = block.slice(returnStart);
    expect(returnBlock).toContain('${voteStyleHint}');
});

// ═══════════════════════════════════════════════════════
// T9-T10: 输出JSON reasoning 字段差异化
// ═══════════════════════════════════════════════════════

test('T9: 输出JSON reasoning 字段对 aggressive 有"结论先行"差异化描述', () => {
    const block = getDayVoteBlock();
    const outputStart = block.indexOf('输出JSON格式:');
    const outputBlock = block.slice(outputStart, outputStart + 500);
    expect(outputBlock).toContain("aggressive");
    expect(outputBlock).toContain("结论先行");
});

test('T10: 输出JSON reasoning 字段对 cautious 有"分析铺垫"差异化描述', () => {
    const block = getDayVoteBlock();
    const outputStart = block.indexOf('输出JSON格式:');
    const outputBlock = block.slice(outputStart, outputStart + 500);
    expect(outputBlock).toContain("cautious");
    expect(outputBlock).toContain("分析铺垫");
});

// ═══════════════════════════════════════════════════════
// T11: 白熊效应合规检查
// ═══════════════════════════════════════════════════════

test('T11: voteStyleHint 块无负向禁止词（不要/禁止/绝不能）', () => {
    const block = getStyleBlock();
    expect(block).not.toContain('不要');
    expect(block).not.toContain('禁止');
    expect(block).not.toContain('绝不能');
    expect(block).not.toContain('不能说');
});

// ═══════════════════════════════════════════════════════
// T12-T14: 回归验证（R65/R63 未破坏）
// ═══════════════════════════════════════════════════════

test('T12: 回归验证 — wolfDefenseTrigger 仍存在（R65）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('wolfDefenseTrigger');
    expect(block).toContain('防守局面已触发');
});

test('T13: 回归验证 — thisRoundVoteHint 仍存在（R65）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('thisRoundVoteHint');
    expect(block).toContain('本轮发言票型');
});

test('T14: 回归验证 — knightVoteStrategy 仍存在（R63）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('knightVoteStrategy');
    expect(block).toContain('骑士投票');
});

// ═══════════════════════════════════════════════════════
// T15: 顺序验证——voteStyleHint 在 return 之前声明
// ═══════════════════════════════════════════════════════

test('T15: voteStyleHint 声明在 return 语句之前（顺序正确）', () => {
    const caseStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    const stylePos = src.indexOf("let voteStyleHint = ''", caseStart);
    const returnPos = src.indexOf('return `投票放逐阶段', caseStart);
    expect(stylePos).toBeGreaterThan(-1);
    expect(returnPos).toBeGreaterThan(-1);
    expect(stylePos).toBeLessThan(returnPos);
});
