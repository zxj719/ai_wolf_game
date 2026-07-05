/**
 * Round 121: 女巫 DAY_VOTE 读写闭环 — 从 witchHistory.savedIds 提取银水记录作为投票排除锚点
 *
 * 背景：女巫在 NIGHT_WITCH 阶段使用解药（写 savedIds），但 DAY_VOTE 之前走通用 fallback（未读）。
 *       与猎人(R62)/骑士(R63)/摄梦人/魔术师(R72)/预言家(R119)/守卫(R120)同构：
 *       在 DAY_VOTE 阶段显式读取私有数据（witchHistory.savedIds）作为投票排除锚点。
 *
 * T1   dvWitchHistory 变量在 DAY_VOTE block 中定义（playerRole='女巫' 门控）
 * T2   dvWitchSavedAliveIds 变量过滤存活的银水玩家
 * T3   dvWitchPoisonedIds 变量读取毒亡玩家列表
 * T4   dvWitchSavedSummary 包含"银水玩家，已确认盟友，从投票选项中排除"的正向描述
 * T5   dvWitchSavedSummary 空值路径包含"暂无存活银水"
 * T6   dvWitchPoisonedSummary 包含"毒亡玩家"描述
 * T7   witchVoteStrategy 有银水路径包含🧪银水锚点标记
 * T8   witchVoteStrategy 有银水路径包含"排除逻辑"描述
 * T9   witchVoteStrategy 有银水路径包含投票优先排序三步
 * T10  witchVoteStrategy 有银水路径包含毒亡共谋推断
 * T11  witchVoteStrategy 无银水路径返回通用 fallback（跟投查杀）
 * T12  witchVoteStrategy 无白熊效应词汇（绝不/禁止/千万别/不能投）
 * T13  女巫在 return 链中有专属路由（playerRole === '女巫'）
 * T14  女巫路由在守卫路由之后、通用 fallback 之前
 * T15  dvWitchHistory 使用 playerRole==='女巫' 门控（非女巫角色返回空结构）
 * T16  回归 — guardVoteStrategy 仍在（R120 未破坏）
 * T17  回归 — seerVoteStrategy 仍在（R119 未破坏）
 * T18  回归 — dvMagIsRevealed 仍在（R118 未破坏）
 * T19  回归 — wolfDefenseTrigger 仍在（R65 未破坏）
 * T20  回归 — 输出JSON格式: 仍在 18000 窗口内（R121 窗口修复后）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// Window: 18000 chars (block size ~16786 × ~107%, sufficient for 输出JSON格式: at offset ~16546)
const DV_WINDOW = 18000;

function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    return src.slice(start, start + DV_WINDOW);
}

// Sub-block: extract witch vote variables section (dvWitchHistory to R71 comment)
function getWitchVoteSection() {
    const block = getDayVoteBlock();
    const start = block.indexOf('// 女巫 DAY_VOTE 读写闭环（R121）');
    const end = block.indexOf('// R71：DAY_VOTE 语气风格');
    if (start === -1) throw new Error('Witch DAY_VOTE section not found');
    return block.slice(start, end === -1 ? start + 3000 : end);
}

// Sub-block: the return template (contains the ternary chain)
function getReturnBlock() {
    const block = getDayVoteBlock();
    const start = block.indexOf('return `投票放逐阶段');
    if (start === -1) throw new Error('return block not found');
    return block.slice(start);
}

describe('R121 女巫 DAY_VOTE 读写闭环', () => {
    // ── 变量声明测试 ──────────────────────────────────────────────────

    test('T1 dvWitchHistory 变量在 DAY_VOTE block 中定义', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('const dvWitchHistory =');
    });

    test('T2 dvWitchSavedAliveIds 变量过滤存活银水玩家', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('const dvWitchSavedAliveIds =');
        expect(block).toContain('dvWitchHistory.savedIds');
    });

    test('T3 dvWitchPoisonedIds 变量读取毒亡玩家列表', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('const dvWitchPoisonedIds =');
        expect(block).toContain('dvWitchHistory.poisonedIds');
    });

    // ── 内容测试 ─────────────────────────────────────────────────────

    test('T4 dvWitchSavedSummary 包含正向排除描述', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('银水玩家，已确认盟友，从投票选项中排除');
    });

    test('T5 dvWitchSavedSummary 空值路径包含暂无存活银水', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('暂无存活银水');
    });

    test('T6 dvWitchPoisonedSummary 包含毒亡玩家描述', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('毒亡玩家');
    });

    // ── witchVoteStrategy 内容测试 ───────────────────────────────────

    test('T7 witchVoteStrategy 有银水路径包含🧪银水锚点标记', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('🧪银水锚点');
    });

    test('T8 witchVoteStrategy 有银水路径包含排除逻辑描述', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('排除逻辑');
        expect(section).toContain('解药成本的关键好人');
    });

    test('T9 witchVoteStrategy 有银水路径包含投票优先排序三步', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('投票优先排序');
        expect(section).toContain('预言家查杀');
        expect(section).toContain('双重标记');
    });

    test('T10 witchVoteStrategy 有银水路径包含毒亡共谋推断', () => {
        const section = getWitchVoteSection();
        expect(section).toContain('毒亡共谋推断');
        expect(section).toContain('共谋嫌疑上升');
    });

    test('T11 witchVoteStrategy 无银水路径返回通用 fallback', () => {
        const section = getWitchVoteSection();
        // fallback text is part of witchVoteStrategy's else branch
        expect(section).toContain('有查杀 → 跟投查杀');
    });

    // ── 白熊效应合规测试 ─────────────────────────────────────────────

    test('T12 witchVoteStrategy 无白熊效应词汇', () => {
        const section = getWitchVoteSection();
        const witchStratStart = section.indexOf('const witchVoteStrategy =');
        const witchStratContent = witchStratStart !== -1 ? section.slice(witchStratStart) : section;
        expect(witchStratContent).not.toMatch(/绝不投|禁止投|千万别|不能投/);
    });

    // ── 三元链测试 ───────────────────────────────────────────────────

    test('T13 女巫在 return 链中有专属路由', () => {
        const returnBlock = getReturnBlock();
        expect(returnBlock).toContain("playerRole === '女巫'");
        expect(returnBlock).toContain('witchVoteStrategy');
    });

    test('T14 女巫路由在守卫路由之后、通用 fallback 之前', () => {
        const returnBlock = getReturnBlock();
        const guardIdx = returnBlock.indexOf("playerRole === '守卫'");
        const witchIdx = returnBlock.indexOf("playerRole === '女巫'");
        const fallbackIdx = returnBlock.indexOf('有查杀 → 跟投查杀');
        expect(guardIdx).toBeGreaterThan(-1);
        expect(witchIdx).toBeGreaterThan(-1);
        expect(fallbackIdx).toBeGreaterThan(-1);
        expect(witchIdx).toBeGreaterThan(guardIdx);
        expect(fallbackIdx).toBeGreaterThan(witchIdx);
    });

    // ── 门控逻辑测试 ─────────────────────────────────────────────────

    test('T15 dvWitchHistory 使用 playerRole==="女巫" 门控', () => {
        const section = getWitchVoteSection();
        expect(section).toMatch(/playerRole === '女巫'\s*\?/);
        // Non-witch gets empty structure
        expect(section).toContain("{ savedIds: [], poisonedIds: [] }");
    });

    // ── 回归测试 ─────────────────────────────────────────────────────

    test('T16 回归 — guardVoteStrategy 仍在（R120 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('guardVoteStrategy');
        expect(block).toContain('🛡️守护锚点');
    });

    test('T17 回归 — seerVoteStrategy 仍在（R119 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('seerVoteStrategy');
        expect(block).toContain('dvSeerMyChecks');
    });

    test('T18 回归 — dvMagIsRevealed 仍在（R118 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('dvMagIsRevealed');
    });

    test('T19 回归 — wolfDefenseTrigger 仍在（R65 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('wolfDefenseTrigger');
    });

    test('T20 回归 — 输出JSON格式: 在 18000 窗口内', () => {
        const block = getDayVoteBlock();
        const jsonFmtIdx = block.indexOf('输出JSON格式:');
        expect(jsonFmtIdx).toBeGreaterThan(-1);
        expect(jsonFmtIdx).toBeLessThan(DV_WINDOW);
    });
});
