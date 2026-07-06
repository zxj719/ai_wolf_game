/**
 * Round 120: 守卫 DAY_VOTE 读写闭环 — 从 guardHistory 提取守护记录作为投票排除锚点
 *
 * 背景：守卫在 NIGHT_GUARD 阶段逐夜守护（写），但 DAY_VOTE 之前只有通用"投查杀"指引（未读）。
 *       守卫是最后一个尚无 DAY_VOTE 专属私有信息注入的神职角色。
 *       与猎人(R62)/骑士(R63)/摄梦人/魔术师(R72)/骑士post-duel/魔术师公开(R118)/预言家(R119)同构：
 *       在 DAY_VOTE 阶段显式读取私有数据（guardHistory）作为投票排除锚点，形成完整读写闭环。
 *
 * T1   dvGuardHistory 变量在 DAY_VOTE block 中定义（playerRole='守卫' 门控）
 * T2   dvGuardProtectedAliveIds 变量过滤存活的守护目标（去重）
 * T3   dvGuardFreqMap 记录每个守护目标的频次
 * T4   dvGuardLastTarget 读取最近一次守护目标
 * T5   dvGuardProtectedSummary 包含"已确认盟友，从投票选项中排除"的正向描述
 * T6   dvGuardProtectedSummary 空值路径包含"暂无存活守护记录"
 * T7   dvGuardLastTargetRef 昨夜空守路径包含"昨夜空守"描述
 * T8   guardVoteStrategy 包含🛡️守护锚点标记
 * T9   guardVoteStrategy 包含"排除逻辑"描述（排除盟友框架）
 * T10  guardVoteStrategy 包含投票优先排序三步（预言家查杀 > 双重标记 > 崩塌者）
 * T11  guardVoteStrategy 包含残局推断（守护对象=刀口目标推断）
 * T12  guardVoteStrategy 无白熊效应词汇（绝不投/禁止/千万别）
 * T13  守卫在 return 链中有专属路由（playerRole === '守卫'）
 * T14  守卫路由在魔术师路由之后、通用 fallback 之前
 * T15  回归 — seerVoteStrategy 仍在（R119 未破坏）
 * T16  回归 — hunterVoteStrategy 仍在（R62 未破坏）
 * T17  回归 — dvMagIsRevealed 仍在（R118 未破坏）
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

// Sub-block: extract guard vote variables section (dvGuardHistory to R71 comment)
function getGuardVoteSection() {
    const blockStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    const guardStart = src.indexOf('const dvGuardHistory =', blockStart);
    const r71Start = src.indexOf('// R71：DAY_VOTE 语气风格一致性', blockStart);
    if (guardStart === -1 || r71Start === -1) throw new Error('guard vote section not found');
    return src.slice(guardStart, r71Start);
}

// Sub-block: return chain (role routing ternary)
function getReturnChain() {
    const blockStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    const returnStart = src.indexOf('return `投票放逐阶段', blockStart);
    const blockEnd = src.indexOf('case PROMPT_ACTIONS.', blockStart + 1);
    if (returnStart === -1) throw new Error('return chain not found');
    return src.slice(returnStart, blockEnd);
}

// ═══════════════════════════════════════════════════════
// T1-T7: 变量声明验证
// ═══════════════════════════════════════════════════════

test('T1: dvGuardHistory 变量在 DAY_VOTE block 中定义（playerRole=守卫 门控）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvGuardHistory =');
    expect(block).toContain("playerRole === '守卫'");
});

test('T2: dvGuardProtectedAliveIds 变量过滤存活守护目标（去重 Set）', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('dvGuardProtectedAliveIds');
    expect(section).toContain('new Set(');
    expect(section).toContain('alivePlayers.find');
});

test('T3: dvGuardFreqMap 记录每个守护目标的频次', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('dvGuardFreqMap');
    expect(section).toContain('dvGuardHistory.forEach');
});

test('T4: dvGuardLastTarget 读取最近一次守护目标', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('dvGuardLastTarget');
    expect(section).toContain('dvGuardHistory.length > 0');
});

test('T5: dvGuardProtectedSummary 使用正向描述"已确认盟友，从投票选项中排除"', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('dvGuardProtectedSummary');
    expect(section).toContain('已确认盟友，从投票选项中排除');
});

test('T6: dvGuardProtectedSummary 空值路径包含"暂无存活守护记录"', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('暂无存活守护记录');
});

test('T7: dvGuardLastTargetRef 包含"昨夜空守"描述', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('dvGuardLastTargetRef');
    expect(section).toContain('昨夜空守');
});

// ═══════════════════════════════════════════════════════
// T8-T12: guardVoteStrategy 内容验证
// ═══════════════════════════════════════════════════════

test('T8: guardVoteStrategy 包含🛡️守护锚点标记', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('guardVoteStrategy');
    expect(section).toContain('🛡️守护锚点');
});

test('T9: guardVoteStrategy 包含排除逻辑描述', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('排除逻辑');
    expect(section).toContain('从目标列表中排除');
});

test('T10: guardVoteStrategy 包含投票优先排序三步', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('预言家查杀');
    expect(section).toContain('双重标记');
    expect(section).toContain('发言逻辑崩塌者');
});

test('T11: guardVoteStrategy 包含残局守护推断（守护对象=刀口目标）', () => {
    const section = getGuardVoteSection();
    expect(section).toContain('残局推断');
    expect(section).toContain('昨夜狼人刀口目标');
});

test('T12: guardVoteStrategy 无白熊效应词汇', () => {
    const section = getGuardVoteSection();
    const stratStart = section.indexOf('const guardVoteStrategy =');
    const stratSection = section.slice(stratStart);
    expect(stratSection).not.toContain('绝不投');
    expect(stratSection).not.toContain('千万别');
    expect(stratSection).not.toContain('禁止投');
    expect(stratSection).not.toContain('不能投');
});

// ═══════════════════════════════════════════════════════
// T13-T14: 路由链验证
// ═══════════════════════════════════════════════════════

test('T13: 守卫在 return 链中有专属路由（playerRole === 守卫）', () => {
    const chain = getReturnChain();
    expect(chain).toContain("playerRole === '守卫'");
    expect(chain).toContain('guardVoteStrategy');
});

test('T14: 守卫路由在魔术师路由之后、通用 fallback 之前', () => {
    const chain = getReturnChain();
    const magIdx = chain.indexOf("playerRole === '魔术师'");
    const guardIdx = chain.indexOf("playerRole === '守卫'");
    const fallbackIdx = chain.indexOf('2. 【投票策略】有查杀');
    expect(magIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(magIdx);
    expect(fallbackIdx).toBeGreaterThan(guardIdx);
});

// ═══════════════════════════════════════════════════════
// T15-T17: 回归测试（前轮功能未破坏）
// ═══════════════════════════════════════════════════════

test('T15: 回归 — seerVoteStrategy 仍在 DAY_VOTE（R119 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvSeerMyChecks =');
    expect(block).toContain('seerVoteStrategy');
});

test('T16: 回归 — hunterVoteStrategy 仍在 DAY_VOTE（R62 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const hunterVoteStrategy =');
    expect(block).toContain('开枪优先级：高');
});

test('T17: 回归 — dvMagIsRevealed 仍在 DAY_VOTE（R118 未破坏）', () => {
    const block = getDayVoteBlock();
    expect(block).toContain('const dvMagIsRevealed =');
    expect(block).toContain('dvMagRevealedVoteStrategy');
});
