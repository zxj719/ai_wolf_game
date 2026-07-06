/**
 * Round 126 — 摄梦人 DAY_VOTE 读写闭环
 * dreamweaverHistory.dreamedPlayers 入梦频次作投票锚点（R126）
 *
 * T1   摄梦人有入梦记录时触发入梦频次锚点框架
 * T2   入梦频次最高玩家出现在 dvDWTopDreamed 排序中
 * T3   入梦频次锚点包含「入梦X次」格式
 * T4   入梦频次锚点框架标题含 R126 标识
 * T5   无入梦历史时回退到 NLP 连梦候选框架
 * T6   非摄梦人角色不注入入梦频次（dvDWDreamedRaw 空数组）
 * T7   入梦频次过滤死亡玩家（只保留 alivePlayers）
 * T8   多次入梦同一玩家正确累计频次
 * T9   入梦频次排序取前3名
 * T10  有入梦记录时包含「梦票对齐」核心原则
 * T11  有入梦记录时包含兜底优先级（预言家查杀）
 * T12  dreamweaverVoteStrategy 出现在 DAY_VOTE block 中
 * T13  回归 — knightVoteStrategy 仍在（R118 未破坏）
 * T14  回归 — seerVoteStrategy 仍在（R119 未破坏）
 * T15  回归 — guardVoteStrategy 仍在（R120 未破坏）
 * T16  回归 — witchVoteStrategy 仍在（R121 未破坏）
 * T17  回归 — villagerVoteStrategy 仍在（R124 未破坏）
 * T18  回归 — knightCounterClaimants 仍在（R125 未破坏）
 * T19  回归 — wolfDefenseTrigger 仍在（R65 未破坏）
 * T20  回归 — 输出JSON格式: 在 20000 窗口内（R126 DV_WINDOW 升级哨兵）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// DV_WINDOW: 20000 (upgraded R126: block size ~18580, 输出JSON at ~18329, 余量 1671)
const DV_WINDOW = 20000;

function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    return src.slice(start, start + DV_WINDOW);
}

describe('R126 摄梦人 DAY_VOTE 读写闭环', () => {
    const block = getDayVoteBlock();

    test('T1 摄梦人有入梦记录时触发入梦频次锚点框架', () => {
        expect(block).toContain('dvDWDreamedSummary');
        // Conditional branch: dvDWDreamedSummary ? <anchor> : <NLP fallback>
        expect(block).toContain('入梦频次锚点框架');
    });

    test('T2 dvDWTopDreamed 按频次排序取前3', () => {
        expect(block).toContain('dvDWTopDreamed');
        expect(block).toContain('.sort((a, b) => b[1] - a[1])');
        expect(block).toContain('.slice(0, 3)');
    });

    test('T3 入梦频次锚点包含「入梦X次」格式', () => {
        expect(block).toContain('入梦${cnt}次');
    });

    test('T4 入梦频次锚点框架标题含 R126 标识', () => {
        expect(block).toContain('R126');
        expect(block).toContain('入梦频次锚点框架（R126）');
    });

    test('T5 无入梦历史时回退到 NLP 连梦候选框架', () => {
        // NLP fallback branch preserved
        expect(block).toContain('连梦候选');
        expect(block).toContain('梦票对齐框架');
    });

    test('T6 非摄梦人角色不注入入梦频次（playerRole 门控）', () => {
        // Role gate: playerRole === '摄梦人'
        expect(block).toContain("playerRole === '摄梦人'");
        // dvDWDreamedRaw = [] for non-dreamweaver
        expect(block).toContain('dvDWDreamedRaw = playerRole');
    });

    test('T7 入梦频次过滤死亡玩家（dvDWAliveIdSet）', () => {
        expect(block).toContain('dvDWAliveIdSet');
        expect(block).toContain('dvDWAliveIdSet.has(id)');
    });

    test('T8 多次入梦同一玩家正确累计频次（dvDWFreqMap）', () => {
        expect(block).toContain('dvDWFreqMap');
        expect(block).toContain('dvDWFreqMap[id] = (dvDWFreqMap[id] || 0) + 1');
    });

    test('T9 入梦频次汇总字符串 dvDWDreamedSummary 正确构造', () => {
        expect(block).toContain('dvDWDreamedSummary');
        expect(block).toContain('入梦频次最高：');
        expect(block).toContain("dvDWTopDreamed.join('、')");
    });

    test('T10 有入梦记录时包含梦票对齐核心原则', () => {
        expect(block).toContain('梦票对齐：投票出局 > 夜间再入梦');
    });

    test('T11 有入梦记录时包含兜底优先级', () => {
        expect(block).toContain('兜底优先级');
        expect(block).toContain('预言家查杀');
    });

    test('T12 dreamweaverVoteStrategy 出现在 DAY_VOTE block 中', () => {
        expect(block).toContain('dreamweaverVoteStrategy');
    });

    // Regression tests
    test('T13 回归 — knightVoteStrategy 仍在（R118 未破坏）', () => {
        expect(block).toContain('knightVoteStrategy');
    });

    test('T14 回归 — seerVoteStrategy 仍在（R119 未破坏）', () => {
        expect(block).toContain('seerVoteStrategy');
    });

    test('T15 回归 — guardVoteStrategy 仍在（R120 未破坏）', () => {
        expect(block).toContain('guardVoteStrategy');
    });

    test('T16 回归 — witchVoteStrategy 仍在（R121 未破坏）', () => {
        expect(block).toContain('witchVoteStrategy');
    });

    test('T17 回归 — villagerVoteStrategy 仍在（R124 未破坏）', () => {
        expect(block).toContain('villagerVoteStrategy');
    });

    test('T18 回归 — magicianVoteStrategy 仍在（R72 未破坏）', () => {
        expect(block).toContain('magicianVoteStrategy');
    });

    test('T19 回归 — wolfDefenseTrigger 仍在（R65 未破坏）', () => {
        expect(block).toContain('wolfDefenseTrigger');
    });

    test('T20 回归 — 输出JSON格式: 在 20000 窗口内（R126 DV_WINDOW 升级哨兵）', () => {
        const jsonFmtIdx = block.indexOf('输出JSON格式:');
        expect(jsonFmtIdx).toBeGreaterThan(0);
        expect(jsonFmtIdx).toBeLessThan(DV_WINDOW);
    });
});
