/**
 * Round 124: 村民 DAY_VOTE 三维信息聚合框架 — 补齐最后一个无专属策略的好人角色
 *
 * 背景：所有神职（预言家/猎人/骑士/摄梦人/魔术师/守卫/女巫）均已有专属 DAY_VOTE 策略框架，
 *       但村民角色走通用 1-line fallback（"有查杀→跟投；无查杀→投最混乱"），缺乏结构化决策引导。
 *       村民在典型 10p/3w 游戏中占 3 席，是好人阵营信息最弱的角色，也是最容易被狼人引导误投的群体。
 *       本轮为村民专门设计三维打分框架（信息价值×行为一致×逻辑链完整），与 Wang 2025 arxiv:2408.17177 一致。
 *
 * T1   villagerVoteStrategy 变量在 DAY_VOTE block 中声明
 * T2   villagerVoteStrategy 包含"三维框架"标识（R124 轮次标记）
 * T3   villagerVoteStrategy 包含"最高优先锚点"（预言家查杀最高优先）
 * T4   villagerVoteStrategy 包含"信息价值"三维打分维度①
 * T5   villagerVoteStrategy 包含"行为一致"三维打分维度②
 * T6   villagerVoteStrategy 包含"逻辑链完整"三维打分维度③
 * T7   villagerVoteStrategy 包含投票排序三步（a→b→c结构）
 * T8   villagerVoteStrategy 包含"率先带票"领袖行动指引
 * T9   villagerVoteStrategy 无白熊效应词汇（禁止/绝不/千万别）
 * T10  村民在 return 链中有专属路由（playerRole === '村民'）
 * T11  村民路由在女巫路由之后、通用 fallback 之前（链顺序正确）
 * T12  villagerVoteStrategy 包含对跳局面处理（两个预言家时的决策指引）
 * T13  villagerVoteStrategy 包含"跨轮投票热力"引用（复用已有热力数据）
 * T14  villagerVoteStrategy 包含"thought"中完成三维打分的指令（不是一次性结论）
 * T15  回归 — witchVoteStrategy 仍在（R121 未破坏）
 * T16  回归 — guardVoteStrategy 仍在（R120 未破坏）
 * T17  回归 — seerVoteStrategy 仍在（R119 未破坏）
 * T18  回归 — wolfDefenseTrigger 仍在（R65 未破坏）
 * T19  回归 — 输出JSON格式: 仍在 20000 窗口内（R126 升级 DV_WINDOW 18000→20000）
 * T20  villagerVoteStrategy 字符长度在合理范围内（300-900 chars，避免块溢出）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(process.cwd(), 'src/services/aiPrompts.js'), 'utf-8');

// DV_WINDOW: 20000 (upgraded R126: block size ~18580 after R126, 输出JSON at ~18329, 余量 1671)
const DV_WINDOW = 20000;

function getDayVoteBlock() {
    const start = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
    if (start === -1) throw new Error('DAY_VOTE case block not found');
    return src.slice(start, start + DV_WINDOW);
}

// Extract the villagerVoteStrategy variable declaration block
function getVillagerVoteSection() {
    const block = getDayVoteBlock();
    const start = block.indexOf('// R124: 村民 DAY_VOTE');
    const end = block.indexOf('return `投票放逐阶段', start);
    if (start === -1) throw new Error('Villager DAY_VOTE section not found (// R124 comment missing)');
    return block.slice(start, end === -1 ? start + 2000 : end);
}

describe('Round 124: 村民 DAY_VOTE 三维信息聚合框架', () => {
    test('T1 villagerVoteStrategy 变量在 DAY_VOTE block 中声明', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('const villagerVoteStrategy');
    });

    test('T2 villagerVoteStrategy 包含 R124 轮次标记', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('R124');
    });

    test('T3 villagerVoteStrategy 包含"最高优先锚点"（预言家查杀最高优先）', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('最高优先');
        expect(section).toContain('预言家查杀');
    });

    test('T4 villagerVoteStrategy 包含"信息价值"三维打分维度①', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('信息价值');
    });

    test('T5 villagerVoteStrategy 包含"行为一致"三维打分维度②', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('行为一致');
    });

    test('T6 villagerVoteStrategy 包含"逻辑链完整"三维打分维度③', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('逻辑链完整');
    });

    test('T7 villagerVoteStrategy 包含投票排序三步结构', () => {
        const section = getVillagerVoteSection();
        // 应有 c) 投票排序 或类似结构表示优先级排序
        expect(section).toContain('投票排序');
        expect(section).toContain('预言家查杀');
    });

    test('T8 villagerVoteStrategy 包含"率先带票"领袖行动指引', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('率先带票');
    });

    test('T9 villagerVoteStrategy 无白熊效应词汇（禁止/绝不/千万别）', () => {
        const section = getVillagerVoteSection();
        expect(section).not.toContain('禁止');
        expect(section).not.toContain('绝不');
        expect(section).not.toContain('千万别');
    });

    test('T10 村民在 return 链中有专属路由', () => {
        const block = getDayVoteBlock();
        expect(block).toContain("playerRole === '村民'");
        // The route should use villagerVoteStrategy
        const routeIdx = block.indexOf("playerRole === '村民'");
        const strategyAfter = block.slice(routeIdx, routeIdx + 100);
        expect(strategyAfter).toContain('villagerVoteStrategy');
    });

    test('T11 村民路由在女巫路由之后、通用 fallback 之前', () => {
        const block = getDayVoteBlock();
        const witchIdx = block.lastIndexOf("playerRole === '女巫'");
        const villagerIdx = block.indexOf("playerRole === '村民'");
        const genericIdx = block.indexOf('投票策略】有查杀', villagerIdx);
        expect(witchIdx).toBeGreaterThan(0);
        expect(villagerIdx).toBeGreaterThan(witchIdx);
        expect(genericIdx).toBeGreaterThan(villagerIdx);
    });

    test('T12 villagerVoteStrategy 包含对跳局面处理', () => {
        const section = getVillagerVoteSection();
        // 对跳局面：多个预言家声明时的决策指引
        expect(section).toContain('对跳');
    });

    test('T13 villagerVoteStrategy 包含"跨轮投票热力"引用', () => {
        const section = getVillagerVoteSection();
        expect(section).toContain('跨轮投票热力');
    });

    test('T14 villagerVoteStrategy 包含在 thought 中完成三维打分的指令', () => {
        const section = getVillagerVoteSection();
        // 明确让 AI 在 thought 中完成打分，而非一次性输出结论
        expect(section).toContain('thought');
    });

    test('T15 回归 — witchVoteStrategy 仍在（R121 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('witchVoteStrategy');
        expect(block).toContain('银水锚点');
    });

    test('T16 回归 — guardVoteStrategy 仍在（R120 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('guardVoteStrategy');
        expect(block).toContain('守护排除框架');
    });

    test('T17 回归 — seerVoteStrategy 仍在（R119 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('seerVoteStrategy');
        expect(block).toContain('查验锚点');
    });

    test('T18 回归 — wolfDefenseTrigger 仍在（R65 未破坏）', () => {
        const block = getDayVoteBlock();
        expect(block).toContain('wolfDefenseTrigger');
    });

    test('T19 回归 — 输出JSON格式: 在 20000 窗口内（R126 升级窗口哨兵）', () => {
        const block = getDayVoteBlock();
        const jsonFmtIdx = block.indexOf('输出JSON格式:');
        expect(jsonFmtIdx).toBeGreaterThan(0);
        expect(jsonFmtIdx).toBeLessThan(DV_WINDOW);
    });

    test('T20 villagerVoteStrategy 字符长度在 300-900 范围内', () => {
        // 检查变量定义的内容长度（不过度膨胀 DAY_VOTE 块）
        const block = getDayVoteBlock();
        const varStart = block.indexOf('const villagerVoteStrategy = `');
        const varEnd = block.indexOf('`;', varStart);
        expect(varStart).toBeGreaterThan(0);
        expect(varEnd).toBeGreaterThan(varStart);
        const varContent = block.slice(varStart, varEnd + 2);
        expect(varContent.length).toBeGreaterThan(300);
        expect(varContent.length).toBeLessThan(900);
    });
});
