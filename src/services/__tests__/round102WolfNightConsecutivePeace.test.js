/**
 * Round 102: NIGHT_WOLF 两连/三连平安夜换刀决策框架（零间接推断）
 *
 * 升级点：在 R84 单夜基础上，新增两连（isConsecutivePeacefulNightWolf）和
 *         三连（isTripleConsecutivePeacefulNightWolf）平安夜推断。
 * 狼人独特优势：直接从 identity_table 读取历史刀口（零间接推断），
 *               无需票压代理——比守卫/预言家更高精度。
 * 超集原则：三连激活时三层全显，两连时两层，单夜时一层，非平安夜时零激活。
 *
 * T1      isConsecutivePeacefulNightWolf 变量声明（dayCount >= 3 && isNightPeacefulWolf && fullGameTimeline）
 * T2      wolfNightPrevPrevDay 变量声明（dayCount >= 3 时赋值 dayCount - 2）
 * T3      isTripleConsecutivePeacefulNightWolf 变量声明（dayCount >= 4 && isConsecutivePeacefulNightWolf && fullGameTimeline）
 * T4      wolfNightThreePrevDay 变量声明（dayCount >= 4 时赋值 dayCount - 3）
 * T5      tripleConsecutivePeaceNightHintWolf + consecutivePeaceNightHintWolf 变量声明
 * T6      超集激活原则：isTriple 条件（dayCount >= 4）是 isConsecutive（dayCount >= 3）的超集
 * T7      Prepend Injection：consecutivePeaceNightHintWolf 前置注入到 wolfNightPeaceStep 模板头部
 * T8      两连平安夜内容：⭕【两连平安夜二阶换刀决策】标记存在
 * T9      三连平安夜内容：⭕【三连平安夜三阶换刀决策】标记存在
 * T10     两连路径A：confidence 升 25-35
 * T11     三连路径A：confidence 升 35-45
 * T12     三连路径C：fallback 到单夜路径A/B 独立评估
 * T13     白熊效应合规：两连/三连 hints 中无负向禁词
 * T14     D3 两连平安夜激活（dayCount=3, deathHistory=[]）
 * T15     D4 三连平安夜激活（dayCount=4, deathHistory=[]）
 * T16     D2 单夜平安夜：不激活两连（无 ⭕【两连 标记）
 * T17     D3 但 N1 有死亡：isConsecutivePeacefulNightWolf 不激活（仅单夜）
 * T18     D1 首夜：无换刀决策框架
 * T19     identity_table 追加格式："两连平安夜：[路径A/B]" 和 "三连平安夜：[路径A/B/C]" 均存在
 * T20     回归：R84 单夜换刀决策框架内容（路径A连守/路径B维持）在两连/三连激活时仍保留
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateUserPrompt, PROMPT_ACTIONS } from '../aiPrompts.js';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── NIGHT_WOLF block（动态切片）─────────────────────────────────────────────
const nightWolfStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
const nightSeerStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:', nightWolfStart);
const nightWolfBlock = src.slice(nightWolfStart, nightSeerStart);

// ─── helper：构建测试用 GameState ──────────────────────────────────────────────
function makeGS({ dayCount = 1, deathHistory = [] } = {}) {
    return {
        players: [
            { id: 1, role: '狼人', isAlive: true, name: 'A', personality: { type: '', traits: '' } },
            { id: 2, role: '村民', isAlive: true, name: 'B', personality: {} },
            { id: 3, role: '预言家', isAlive: true, name: 'C', personality: {} },
            { id: 4, role: '女巫', isAlive: true, name: 'D', personality: {} },
            { id: 5, role: '守卫', isAlive: true, name: 'E', personality: {} },
        ],
        speechHistory: [], voteHistory: [], deathHistory,
        nightDecisions: {}, seerChecks: [], guardHistory: [],
        witchHistory: { savedIds: [], poisonedIds: [] },
        dayCount, phase: 'night', gameSetup: { playerCount: 5 },
        nightActionHistory: [], claimHistory: [], dreamweaverHistory: null, magicianHistory: null,
    };
}

function wolfPrompt(dayCount, deathHistory = []) {
    const gs = makeGS({ dayCount, deathHistory });
    return generateUserPrompt(PROMPT_ACTIONS.NIGHT_WOLF, gs, {
        playerId: 1,
        currentPlayer: gs.players[0],
    });
}

// ═══════════════════════════════════════════════════════════════
// T1-T6: 变量声明与超集原则
// ═══════════════════════════════════════════════════════════════

describe('T1-T6: R102 变量声明与超集激活原则', () => {
    test('T1: isConsecutivePeacefulNightWolf 声明（dayCount >= 3 && isNightPeacefulWolf && fullGameTimeline）', () => {
        expect(nightWolfBlock).toContain('isConsecutivePeacefulNightWolf');
        expect(nightWolfBlock).toContain('ctx.dayCount >= 3 && isNightPeacefulWolf');
        expect(nightWolfBlock).toContain('ctx.fullGameTimeline?.includes');
    });

    test('T2: wolfNightPrevPrevDay 声明（dayCount >= 3 时赋 dayCount - 2）', () => {
        expect(nightWolfBlock).toContain('wolfNightPrevPrevDay');
        expect(nightWolfBlock).toContain('ctx.dayCount >= 3 ? ctx.dayCount - 2 : 0');
    });

    test('T3: isTripleConsecutivePeacefulNightWolf 声明（dayCount >= 4 && isConsecutivePeacefulNightWolf）', () => {
        expect(nightWolfBlock).toContain('isTripleConsecutivePeacefulNightWolf');
        expect(nightWolfBlock).toContain('ctx.dayCount >= 4 && isConsecutivePeacefulNightWolf');
    });

    test('T4: wolfNightThreePrevDay 声明（dayCount >= 4 时赋 dayCount - 3）', () => {
        expect(nightWolfBlock).toContain('wolfNightThreePrevDay');
        expect(nightWolfBlock).toContain('ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0');
    });

    test('T5: tripleConsecutivePeaceNightHintWolf + consecutivePeaceNightHintWolf 均声明为空字符串初值', () => {
        expect(nightWolfBlock).toContain("tripleConsecutivePeaceNightHintWolf = ''");
        expect(nightWolfBlock).toContain("consecutivePeaceNightHintWolf = ''");
    });

    test('T6: 超集原则——isTriple 的阈值（>= 4）严格大于 isConsecutive（>= 3）', () => {
        const consIdx = nightWolfBlock.indexOf('ctx.dayCount >= 3 && isNightPeacefulWolf');
        const tripleIdx = nightWolfBlock.indexOf('ctx.dayCount >= 4 && isConsecutivePeacefulNightWolf');
        expect(consIdx).toBeGreaterThan(0);
        expect(tripleIdx).toBeGreaterThan(consIdx);
    });
});

// ═══════════════════════════════════════════════════════════════
// T7: Prepend Injection 结构
// ═══════════════════════════════════════════════════════════════

describe('T7: Prepend Injection 注入结构', () => {
    test('T7: wolfNightPeaceStep 模板以 ${consecutivePeaceNightHintWolf} 开头（前置注入第 17 次）', () => {
        // 检查 wolfNightPeaceStep 三元 true 分支的模板字面量头部
        const peaceStepStart = nightWolfBlock.indexOf('? `${consecutivePeaceNightHintWolf}');
        expect(peaceStepStart).toBeGreaterThan(0);
        // 且 consecutivePeaceNightHintWolf 在 if(isConsecutivePeacefulNightWolf) 块内赋值
        const ifBlockIdx = nightWolfBlock.indexOf('if (isConsecutivePeacefulNightWolf)');
        expect(ifBlockIdx).toBeGreaterThan(0);
        // if 块先于 wolfNightPeaceStep 赋值
        const peaceStepDecl = nightWolfBlock.indexOf('wolfNightPeaceStep = isNightPeacefulWolf');
        expect(ifBlockIdx).toBeLessThan(peaceStepDecl);
    });
});

// ═══════════════════════════════════════════════════════════════
// T8-T12: 内容验证
// ═══════════════════════════════════════════════════════════════

describe('T8-T12: 两连/三连内容验证', () => {
    test('T8: 两连平安夜标记：⭕【两连平安夜二阶换刀决策（thought 中完成）】', () => {
        expect(nightWolfBlock).toContain('⭕【两连平安夜二阶换刀决策');
        expect(nightWolfBlock).toContain('thought 中完成');
    });

    test('T9: 三连平安夜标记：⭕【三连平安夜三阶换刀决策（thought 中完成）】', () => {
        expect(nightWolfBlock).toContain('⭕【三连平安夜三阶换刀决策');
        expect(nightWolfBlock).toContain('三路径推断');
    });

    test('T10: 两连路径A——confidence 升 25-35', () => {
        const consIdx = nightWolfBlock.indexOf('⭕【两连平安夜二阶换刀决策');
        expect(consIdx).toBeGreaterThan(0);
        const consBlock = nightWolfBlock.slice(consIdx, consIdx + 600);
        expect(consBlock).toContain('confidence 升 25-35');
        expect(consBlock).toContain('路径A');
    });

    test('T11: 三连路径A——confidence 升 35-45', () => {
        const tripleIdx = nightWolfBlock.indexOf('⭕【三连平安夜三阶换刀决策');
        expect(tripleIdx).toBeGreaterThan(0);
        const tripleBlock = nightWolfBlock.slice(tripleIdx, tripleIdx + 700);
        expect(tripleBlock).toContain('confidence 升 35-45');
        expect(tripleBlock).toContain('路径A');
    });

    test('T12: 三连路径C——fallback 到单夜路径A/B 独立评估', () => {
        const tripleIdx = nightWolfBlock.indexOf('⭕【三连平安夜三阶换刀决策');
        const tripleBlock = nightWolfBlock.slice(tripleIdx, tripleIdx + 700);
        expect(tripleBlock).toContain('路径C');
        expect(tripleBlock).toContain('按单夜路径A/B独立评估');
    });
});

// ═══════════════════════════════════════════════════════════════
// T13: 白熊效应合规
// ═══════════════════════════════════════════════════════════════

describe('T13: 白熊效应合规（第 23 次验证）', () => {
    test('T13: 两连/三连 hints 中无负向禁词（不要/禁止/不能/绝不）', () => {
        const consIdx = nightWolfBlock.indexOf('if (isConsecutivePeacefulNightWolf)');
        const consBlock = nightWolfBlock.slice(consIdx, consIdx + 1200);
        expect(consBlock).not.toMatch(/不要|禁止|不能|绝不/);
    });
});

// ═══════════════════════════════════════════════════════════════
// T14-T18: 条件门控验证
// ═══════════════════════════════════════════════════════════════

describe('T14-T18: 条件门控（动态生成）', () => {
    test('T14: D3 两连平安夜激活——prompt 包含 ⭕【两连平安夜二阶换刀决策】', () => {
        const p = wolfPrompt(3, []);
        // dayCount=3, deathHistory=[] → N1/N2 均平安夜 → isConsecutive 激活
        expect(p).toContain('⭕【两连平安夜二阶换刀决策');
    });

    test('T15: D4 三连平安夜激活——prompt 包含 ⭕【三连平安夜三阶换刀决策】', () => {
        const p = wolfPrompt(4, []);
        // dayCount=4, deathHistory=[] → N1/N2/N3 均平安夜 → isTriple 激活
        expect(p).toContain('⭕【三连平安夜三阶换刀决策');
    });

    test('T16: D2 单夜平安夜——不激活两连（无 ⭕【两连 标记）', () => {
        const p = wolfPrompt(2, []);
        // dayCount=2 < 3 → isConsecutive 不激活
        expect(p).not.toContain('⭕【两连平安夜二阶换刀决策');
        // 但单夜换刀决策框架仍激活
        expect(p).toContain('⭕【换刀决策框架');
    });

    test('T17: D3 但 N1 有死亡——isConsecutivePeacefulNightWolf 不激活（fullGameTimeline 无 N1:平安夜）', () => {
        // N1 有死亡 → fullGameTimeline = "N1:3号死亡 → N2:平安夜"
        // → fullGameTimeline.includes('N1:平安夜') = false → isConsecutive = false
        const p = wolfPrompt(3, [{ playerId: 3, day: 1, phase: '夜', cause: '被袭击' }]);
        expect(p).not.toContain('⭕【两连平安夜二阶换刀决策');
    });

    test('T18: D1 首夜——无换刀决策框架', () => {
        const p = wolfPrompt(1, []);
        expect(p).not.toContain('换刀决策框架');
        expect(p).toContain('首夜');
    });
});

// ═══════════════════════════════════════════════════════════════
// T19-T20: 追加格式 + 回归
// ═══════════════════════════════════════════════════════════════

describe('T19-T20: identity_table 追加格式与回归测试', () => {
    test('T19: identity_table 追加格式——两连和三连各有专属追加关键词', () => {
        // 两连追加格式：N{prevDay}两连平安夜：[路径A/B]
        expect(nightWolfBlock).toContain('两连平安夜：[路径A/B]');
        // 三连追加格式：N{prevDay}三连平安夜：[路径A/B/C]
        expect(nightWolfBlock).toContain('三连平安夜：[路径A/B/C]');
    });

    test('T20: 回归——R84 单夜换刀决策内容（路径A连守/路径B维持）在两连激活时仍存在', () => {
        const p = wolfPrompt(3, []);
        // 两连激活，但单夜框架仍完整
        expect(p).toContain('⭕【换刀决策框架');
        expect(p).toContain('连守目标命中率极低');
        expect(p).toContain('维持今晚高优先');
        expect(p).toContain('女巫无救药覆盖');
        // R47 兼容：wolfHistoryStep 仍有历史刀口读取
        expect(p).toContain('核查执行结果');
        // R79 兼容：次日叙事预案
        expect(p).toContain('次日刀后叙事预案');
    });
});
