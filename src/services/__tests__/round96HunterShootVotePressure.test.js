/**
 * Round 96 tests: 猎人开枪增加前轮投票票压参考
 * （感知-执行分裂修复：voteHistory 注入 hunterContext，hunterHistoryStep Step 0 显式读取）
 *
 * T1-T5   useDayFlow.js 结构验证（R96 注释 / latestVote / voteCountMap / sortedVotePressure / slice(0,3)）
 * T6-T10  useDayFlow.js 内容验证（ABSTAIN_TARGET 过滤 / aliveTargets 过滤 / D${day}格式 / hunterContext追加 / 逆序排序）
 * T11-T15 aiPrompts.js 静态验证（R96 注释 / hunterHistoryStep 含前轮票压参考 / 含【票压】 / confidence 15-25 / 旧文本消失）
 * T16-T20 回归测试（R56 "开枪优先级：高" / 白熊效应 / JSON schema / 读取历史开枪候选保留 / useDayFlow 其他上下文完整）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateUserPrompt, PROMPT_ACTIONS } from '../aiPrompts.js';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');
const dayFlowSrc = readFileSync(resolve('src/hooks/useDayFlow.js'), 'utf8');

// ── 定位 useDayFlow.js handleAIHunterShoot 的 hunterContext 区 ──────
const handleHunterMarker = 'handleAIHunterShoot';
const handleHunterIdx = dayFlowSrc.indexOf(handleHunterMarker);
const hunterContextMarker = 'let hunterContext';
const hunterCtxStart = dayFlowSrc.indexOf(hunterContextMarker, handleHunterIdx);
const btDecideMarker = 'BT 决策：优先走 ECS BT Server';
const btDecideIdx = dayFlowSrc.indexOf(btDecideMarker, hunterCtxStart);
const hunterContextBlock = dayFlowSrc.slice(hunterCtxStart, btDecideIdx);

// ── R96 注释区 ──────────────────────────────────────────────────
const r96Marker = '// R96';
const r96Idx = dayFlowSrc.indexOf(r96Marker, hunterCtxStart);
const r96Block = r96Idx >= 0 ? dayFlowSrc.slice(r96Idx, r96Idx + 900) : '';

// ── 定位 aiPrompts.js HUNTER_SHOOT 块 ───────────────────────────
const hunterShootMarker = 'case PROMPT_ACTIONS.HUNTER_SHOOT:';
const hunterShootStart = src.indexOf(hunterShootMarker);
const hunterShootBlock = src.slice(hunterShootStart, hunterShootStart + 900);

// ── 定位 aiPrompts.js R96 注释区 ────────────────────────────────
const aiR96Idx = src.indexOf('// R96', hunterShootStart);
const aiR96Block = aiR96Idx >= 0 ? src.slice(aiR96Idx, aiR96Idx + 500) : '';

// ═══════════════════════════════════════════════════════════════════════
// T1-T5: useDayFlow.js 结构验证
// ═══════════════════════════════════════════════════════════════════════

describe('R96 useDayFlow.js: 结构验证', () => {
    test('T1: R96 注释标记存在于 handleAIHunterShoot 的 hunterContext 区', () => {
        expect(r96Idx).toBeGreaterThan(hunterCtxStart);
        expect(r96Block).toContain('R96');
    });

    test('T2: latestVote 变量声明存在（取 voteHistory 最新一轮）', () => {
        expect(r96Block).toContain('latestVote');
        expect(r96Block).toContain('voteHistory.length - 1');
    });

    test('T3: voteCountMap 声明存在（票数统计对象）', () => {
        expect(r96Block).toContain('voteCountMap');
    });

    test('T4: sortedVotePressure 声明存在（排序后的票压数组）', () => {
        expect(r96Block).toContain('sortedVotePressure');
    });

    test('T5: slice(0, 3) 限制最多 3 个目标（避免提示词过长）', () => {
        expect(r96Block).toContain('.slice(0, 3)');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T6-T10: useDayFlow.js 内容验证
// ═══════════════════════════════════════════════════════════════════════

describe('R96 useDayFlow.js: 内容验证', () => {
    test('T6: 过滤掉 ABSTAIN_TARGET（弃票不计入票压）', () => {
        expect(r96Block).toContain('ABSTAIN_TARGET');
    });

    test('T7: 过滤 aliveTargets（死亡玩家不计入票压）', () => {
        expect(r96Block).toContain('aliveTargets.includes');
    });

    test('T8: 使用 D${latestVote.day}票压 格式标签', () => {
        expect(r96Block).toContain('D${latestVote.day}票压');
    });

    test('T9: 追加到 hunterContext（维持追加不覆盖模式）', () => {
        expect(r96Block).toContain('hunterContext +=');
    });

    test('T10: 排序方向为降序（高票在前）', () => {
        // sort((a, b) => Number(b[1]) - Number(a[1]))
        expect(r96Block).toContain('Number(b[1]) - Number(a[1])');
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T11-T15: aiPrompts.js 静态验证
// ═══════════════════════════════════════════════════════════════════════

describe('R96 aiPrompts.js: hunterHistoryStep 验证', () => {
    test('T11: aiPrompts.js R96 注释存在于 HUNTER_SHOOT 块内', () => {
        expect(aiR96Idx).toBeGreaterThan(hunterShootStart);
        expect(aiR96Block).toContain('R96');
    });

    test('T12: hunterHistoryStep 包含"前轮票压参考"', () => {
        expect(hunterShootBlock).toContain('前轮票压参考');
    });

    test('T13: hunterHistoryStep 包含【票压】摘要参考指令', () => {
        expect(hunterShootBlock).toContain('【票压】');
    });

    test('T14: hunterHistoryStep 包含 confidence 15-25 提升指导', () => {
        expect(hunterShootBlock).toContain('15-25');
    });

    test('T15: 旧版"仅读取历史开枪候选"（无票压）文本已替换', () => {
        // 旧文本："0. 【读取历史开枪候选】先查看"（不含"+"后缀）
        expect(hunterShootBlock).not.toContain("'0. 【读取历史开枪候选】先查看");
    });
});

// ═══════════════════════════════════════════════════════════════════════
// T16-T20: 回归测试
// ═══════════════════════════════════════════════════════════════════════

describe('R96 回归测试', () => {
    test('T16: R56 关键词"开枪优先级：高"仍在 HUNTER_SHOOT 块内（read-write 对齐未破坏）', () => {
        expect(hunterShootBlock).toContain('开枪优先级：高');
    });

    test('T17: 白熊效应合规 — 票压参考使用正向描述（"高票存活者"/"可提升"，无"不要""禁止"）', () => {
        expect(hunterShootBlock).not.toContain('不要');
        expect(hunterShootBlock).not.toContain('禁止');
        expect(hunterShootBlock).toContain('高票存活者');
        expect(hunterShootBlock).toContain('可提升');
    });

    test('T18: HUNTER_SHOOT 输出 JSON schema 保持完整（shoot / targetId / reason / thought）', () => {
        const jsonSchemaIdx = src.indexOf('输出JSON:', hunterShootStart);
        const jsonSchemaBlock = src.slice(jsonSchemaIdx, jsonSchemaIdx + 200);
        expect(jsonSchemaBlock).toContain('"shoot"');
        expect(jsonSchemaBlock).toContain('"targetId"');
        expect(jsonSchemaBlock).toContain('"reason"');
        expect(jsonSchemaBlock).toContain('"thought"');
    });

    test('T19: "读取历史开枪候选"关键词保留（R56 T23 回归）', () => {
        expect(src).toContain('读取历史开枪候选');
    });

    test('T20: useDayFlow.js 其他 hunterContext 上下文完整（查杀/金水/发言摘要不受影响）', () => {
        expect(hunterContextBlock).toContain('【查杀】');
        expect(hunterContextBlock).toContain('【金水】');
        expect(hunterContextBlock).toContain('【今日发言】');
    });
});
