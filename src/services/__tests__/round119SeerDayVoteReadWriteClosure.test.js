/**
 * Round 119: 预言家 DAY_VOTE 读写闭环 — 从 seerChecks 提取已验结果作为投票锚点
 *
 * 背景：预言家在 DAY_SPEECH 报验结果（写），但 DAY_VOTE 之前只有通用"投查杀"指引（未读）。
 *       与猎人(R62)/骑士(R63)/摄梦人/魔术师(R72)/骑士post-duel/魔术师公开(R118)同构：
 *       在 DAY_VOTE 阶段显式读取私有数据（seerChecks）作为投票锚点，形成完整读写闭环。
 *
 * T1   dvSeerMyChecks 变量在 DAY_VOTE block 中定义（playerRole=预言家 过滤）
 * T2   dvSeerConfirmedWolves 变量提取存活的已验狼人 targetId
 * T3   dvSeerConfirmedGood 变量提取存活的已验好人 targetId
 * T4   dvSeerKillSummary 包含"暂无存活的查杀目标"作为空值路径
 * T5   dvSeerGoodSummary 包含"已确认好人，从投票选项中排除"的正向描述
 * T6   seerVoteStrategy 包含三路径逻辑（对跳 > 有查杀 > 无记录）
 * T7   对跳路径包含 🔮查验锚点 提示行
 * T8   对跳路径包含投票排序三步（一手验证 > 悍跳者 > identity_table崩塌者）
 * T9   查验锚点路径包含 confidence=100 锚点描述
 * T10  查验锚点路径包含领袖义务（率先带票引导好人形成多数）
 * T11  三路径均无白熊效应词汇（绝不/禁止/千万别/不能说）
 * T12  dvSeerMyChecks 只在 playerRole === '预言家' 时过滤 seerChecks（无角色不给数据）
 * T13  回归 — hunterVoteStrategy 仍在（R62 未破坏）
 * T14  回归 — knightVoteStrategy 仍在（R63 未破坏）
 * T15  回归 — dreamweaverVoteStrategy 仍在（R72 未破坏）
 * T16  回归 — dvMagIsRevealed 仍在（R118 未破坏）
 * T17  回归 — wolfDefenseTrigger 仍在（R65 未破坏）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// Window: 20000 chars (upgraded R126: R126 added ~1083 chars, DV_WINDOW 18000→20000, 余量 1671)
const DV_WINDOW = 20000;

function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    return src.slice(start, start + DV_WINDOW);
}

// Sub-block: extract the seerVoteStrategy variable definition (dvSeerMyChecks to hunterVoteStrategy)
function getSeerVoteSection() {
    const blockStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    const seerStart = src.indexOf('const dvSeerMyChecks =', blockStart);
    const hunterStart = src.indexOf('const hunterVoteStrategy =', blockStart);
    if (seerStart === -1 || hunterStart === -1) throw new Error('seer vote section not found');
    return src.slice(seerStart, hunterStart);
}

// ═══════════════════════════════════════════════════════
// T1-T5: 变量声明验证
// ═══════════════════════════════════════════════════════

test('T1: dvSeerMyChecks 变量在 DAY_VOTE block 中定义（R119 读写闭环）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvSeerMyChecks =');
    expect(block).toContain("playerRole === '预言家'");
});

test('T2: dvSeerConfirmedWolves 变量在 DAY_VOTE block 中定义', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvSeerConfirmedWolves =');
    expect(block).toContain('c.isWolf');
});

test('T3: dvSeerConfirmedGood 变量在 DAY_VOTE block 中定义', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvSeerConfirmedGood =');
    expect(block).toContain('!c.isWolf');
});

test('T4: dvSeerKillSummary 包含"暂无存活的查杀目标"空值路径', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('dvSeerKillSummary');
    expect(section).toContain('暂无存活的查杀目标');
});

test('T5: dvSeerGoodSummary 使用正向描述"已确认好人，从投票选项中排除"', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('dvSeerGoodSummary');
    expect(section).toContain('已确认好人，从投票选项中排除');
});

// ═══════════════════════════════════════════════════════
// T6-T10: 三路径策略内容验证
// ═══════════════════════════════════════════════════════

test('T6: seerVoteStrategy 包含三路径结构（对跳 > 有查杀记录 > 无记录）', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('const seerVoteStrategy = seerCounterClaimantsInVote.length > 0');
    // 第二路径：dvSeerConfirmedWolves.length > 0 作为中间分支
    expect(section).toContain('dvSeerConfirmedWolves.length > 0');
});

test('T7: 对跳路径包含 🔮查验锚点 行（读写闭环提示）', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('🔮查验锚点');
    expect(section).toContain('dvSeerKillSummary');
    expect(section).toContain('dvSeerGoodSummary');
});

test('T8: 对跳路径包含投票排序三步（一手验证最高 > 悍跳者 > identity_table）', () => {
    const section = getSeerVoteSection();
    // 第三步顺序存在
    expect(section).toContain('一手验证最高');
    expect(section).toContain('悍跳者');
    expect(section).toContain('identity_table');
});

test('T9: 查验锚点路径（第二路径）包含 confidence=100 锚点', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('confidence=100');
});

test('T10: 查验锚点路径（第二路径）包含领袖义务描述', () => {
    const section = getSeerVoteSection();
    expect(section).toContain('领袖义务');
    expect(section).toContain('率先带票');
});

// ═══════════════════════════════════════════════════════
// T11: 白熊效应合规（正向描述铁律）
// ═══════════════════════════════════════════════════════

test('T11: seerVoteStrategy 三路径均无白熊效应词汇', () => {
    const section = getSeerVoteSection();
    // 提取 seerVoteStrategy 模板字符串内容
    const seerVoteStart = section.indexOf('const seerVoteStrategy =');
    const seerVoteSection = section.slice(seerVoteStart);
    // 白熊效应词汇检查（正向描述铁律）
    expect(seerVoteSection).not.toContain('绝不投金水');
    expect(seerVoteSection).not.toContain('千万别');
    expect(seerVoteSection).not.toContain('禁止投');
    expect(seerVoteSection).not.toContain('不能投');
});

// ═══════════════════════════════════════════════════════
// T12: 角色门控验证（非预言家不获取数据）
// ═══════════════════════════════════════════════════════

test('T12: dvSeerMyChecks 通过 playerRole === "预言家" 门控 seerChecks 过滤', () => {
    const block = getDayVoteBlock();
    const dvStart = block.indexOf('const dvSeerMyChecks =');
    const dvSection = block.slice(dvStart, dvStart + 200);
    // 必须有 playerRole 角色门控
    expect(dvSection).toContain("playerRole === '预言家'");
    // 必须引用 seerChecks
    expect(dvSection).toContain('seerChecks');
});

// ═══════════════════════════════════════════════════════
// T13-T17: 回归测试（前轮功能未破坏）
// ═══════════════════════════════════════════════════════

test('T13: 回归 — hunterVoteStrategy 仍在 DAY_VOTE（R62 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const hunterVoteStrategy =');
    expect(block).toContain('开枪优先级：高');
});

test('T14: 回归 — knightVoteStrategy 仍在 DAY_VOTE（R63 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const knightVoteStrategy =');
    expect(block).toContain('决斗候选');
});

test('T15: 回归 — dreamweaverVoteStrategy 仍在 DAY_VOTE（R72 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dreamweaverVoteStrategy =');
    expect(block).toContain('连梦候选');
});

test('T16: 回归 — dvMagIsRevealed 仍在 DAY_VOTE（R118 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvMagIsRevealed =');
    expect(block).toContain('dvMagRevealedVoteStrategy');
});

test('T17: 回归 — wolfDefenseTrigger 仍在 DAY_VOTE（R65 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('wolfDefenseTrigger');
    expect(block).toContain('防守局面');
});
