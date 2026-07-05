/**
 * R118: 骑士/魔术师 DAY_VOTE 私有信息注入
 *
 * 优化目标：
 * - 骑士（post-duel）：以"已决斗出局"的狼人作为最高信任锚点，推断其生前"保护/力挺/金水"的存活玩家为连带嫌疑
 * - 魔术师（hasRevealed=true）：以历史交换记录作一手信息，优先投交换验证确认的狼人
 * - 魔术师（hasRevealed=false）：维持隐藏期换刀候选对齐框架（R72 不变）
 *
 * T1   骑士 post-duel 分支包含"已决斗出局"（决斗验证锚点）
 * T2   骑士 post-duel 分支包含连带嫌疑概念（保护/力挺/金水 → 狼人同组互保信号）
 * T3   骑士 post-duel 分支包含投票优先排序（多步骤排序）
 * T4   骑士 pre-duel 分支仍包含"决斗候选"（R63 回归不破坏）
 * T5   knightHasDueledForVote 仍控制骑士双路径
 * T6   DAY_VOTE block 包含 dvMagIsRevealed 变量声明
 * T7   DAY_VOTE block 包含 dvMagRevealedVoteStrategy 变量
 * T8   dvMagRevealedVoteStrategy 包含"交换知识"锚点（身份公开后的一手信息）
 * T9   dvMagRevealedVoteStrategy 包含交换验证优先排序（交换验证确认 → 查杀 → 逻辑崩塌）
 * T10  dvMagRevealedVoteStrategy 包含"引导好人阵营"正向领袖义务表述
 * T11  隐藏路径 magicianVoteStrategy 仍包含"换刀候选"（R72 回归不破坏）
 * T12  魔术师 return 分支使用内嵌三元 (dvMagIsRevealed ? dvMagRevealedVoteStrategy : magicianVoteStrategy)
 * T13  dvMagRevealedVoteStrategy 无负向禁止词（白熊效应合规）
 * T14  dvMagRevealedVoteStrategy 引用 dvMagSwappedCount（交换次数状态变量）
 * T15  回归：dreamweaverVoteStrategy 仍在 DAY_VOTE（R72 未破坏）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// R118 窗口：block 16786 chars（R121 后），× ~107%，设 18000 保留余量
const DV_WINDOW = 18000;

function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    return src.slice(start, start + DV_WINDOW);
}

// Extract dvMagRevealedVoteStrategy template literal content
function getRevealedStrategyContent() {
    const block = getDayVoteBlock();
    const marker = 'const dvMagRevealedVoteStrategy = `';
    const start = block.indexOf(marker);
    if (start === -1) throw new Error('dvMagRevealedVoteStrategy not found');
    const templateStart = start + marker.length;
    const templateEnd = block.indexOf('`;\n', templateStart);
    return block.slice(templateStart, templateEnd);
}

// Extract knightVoteStrategy post-duel (true) branch template literal
function getKnightPostDuelContent() {
    const block = getDayVoteBlock();
    const marker = 'const knightVoteStrategy = knightHasDueledForVote\n                ? `';
    const start = block.indexOf(marker);
    if (start === -1) throw new Error('knightVoteStrategy ternary not found');
    const templateStart = start + marker.length;
    // Find the closing backtick of the true-branch (before `: \`2. 【骑士投票—决斗候选`)
    const templateEnd = block.indexOf('`\n                : `', templateStart);
    return block.slice(templateStart, templateEnd);
}

// ═══════════════════════════════════════════════════════
// T1-T5: 骑士 post-duel 私有信息注入
// ═══════════════════════════════════════════════════════

test('T1: 骑士 post-duel 分支包含"已决斗出局"决斗验证锚点', () => {
    const content = getKnightPostDuelContent();
    expect(content).toContain('已决斗出局');
});

test('T2: 骑士 post-duel 分支包含连带嫌疑描述（保护/力挺/金水 → 同组互保信号）', () => {
    const content = getKnightPostDuelContent();
    expect(content).toContain('保护/力挺/金水');
    expect(content).toContain('互保');
});

test('T3: 骑士 post-duel 分支包含多步投票优先排序', () => {
    const content = getKnightPostDuelContent();
    // 应该有明确的①②③排序
    expect(content).toContain('①');
    expect(content).toContain('②');
});

test('T4: 骑士 pre-duel 分支仍包含"决斗候选"（R63 回归）', () => {
    const block = getDayVoteBlock();
    // pre-duel path (false branch) contains 决斗候选
    expect(block).toContain('决斗候选');
    // And the pre-duel path text
    expect(block).toContain('保留决斗用于更高价值时刻');
});

test('T5: knightHasDueledForVote 仍控制骑士双路径（hasUsedDuel 变量读取）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('knightHasDueledForVote');
    expect(block).toContain('hasUsedDuel');
});

// ═══════════════════════════════════════════════════════
// T6-T14: 魔术师 revealed 路径私有信息注入
// ═══════════════════════════════════════════════════════

test('T6: DAY_VOTE block 包含 dvMagIsRevealed 变量声明', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('dvMagIsRevealed');
    // 读取自 currentPlayer?.hasRevealed
    expect(block).toContain('currentPlayer?.hasRevealed');
});

test('T7: DAY_VOTE block 包含 dvMagRevealedVoteStrategy 变量', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvMagRevealedVoteStrategy = `');
});

test('T8: dvMagRevealedVoteStrategy 包含"交换知识"作一手信息锚点', () => {
    const content = getRevealedStrategyContent();
    expect(content).toContain('交换知识');
    expect(content).toContain('一手信息');
});

test('T9: dvMagRevealedVoteStrategy 包含交换验证优先排序（①②③）', () => {
    const content = getRevealedStrategyContent();
    expect(content).toContain('交换验证确认');
    expect(content).toContain('①');
    expect(content).toContain('②');
});

test('T10: dvMagRevealedVoteStrategy 包含正向领袖义务表述（引导好人阵营）', () => {
    const content = getRevealedStrategyContent();
    expect(content).toContain('引导好人阵营');
});

test('T11: 隐藏路径 magicianVoteStrategy 仍包含"换刀候选"（R72 回归）', () => {
    const block = getDayVoteBlock();
    // magicianVoteStrategy (hidden path) still exists as template literal
    expect(block).toContain('const magicianVoteStrategy = `');
    // 换刀候选 appears in the hidden path
    const magStart = block.indexOf('const magicianVoteStrategy = `');
    const magEnd = block.indexOf('`;\n', magStart + 40);
    const hiddenContent = block.slice(magStart, magEnd);
    expect(hiddenContent).toContain('换刀候选');
});

test('T12: 魔术师 return 分支使用 dvMagIsRevealed 内嵌三元', () => {
    const block = getDayVoteBlock();
    // The return ternary chain should reference both strategies via dvMagIsRevealed
    expect(block).toContain('dvMagIsRevealed ? dvMagRevealedVoteStrategy : magicianVoteStrategy');
});

test('T13: dvMagRevealedVoteStrategy 无负向禁止词（白熊效应合规）', () => {
    const content = getRevealedStrategyContent();
    expect(content).not.toContain('绝不能');
    expect(content).not.toContain('禁止');
    // 无"不要"禁令语（allow technical usage like 不要覆盖）
    const lines = content.split('\n');
    lines.forEach(line => {
        if (line.includes('不要')) {
            expect(line).toMatch(/不要.*覆盖|不要.*重复/);
        }
    });
});

test('T14: dvMagRevealedVoteStrategy 引用 dvMagSwappedCount（交换次数状态）', () => {
    const block = getDayVoteBlock();
    // dvMagSwappedCount declared
    expect(block).toContain('dvMagSwappedCount');
    // used in revealed strategy
    const content = getRevealedStrategyContent();
    expect(content).toContain('dvMagSwappedCount');
});

// ═══════════════════════════════════════════════════════
// T15: 回归测试
// ═══════════════════════════════════════════════════════

test('T15: 回归 — dreamweaverVoteStrategy 仍在 DAY_VOTE（R72 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('dreamweaverVoteStrategy');
    expect(block).toContain('连梦候选');
});
