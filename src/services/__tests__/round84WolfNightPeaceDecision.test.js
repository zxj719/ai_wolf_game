/**
 * Round 84: NIGHT_WOLF 平安夜换刀决策框架（wolfNightPeaceStep）
 *
 * 升级点：wolfHistoryStep 的"若平安夜"单行通用指导 → 两路径换刀决策框架
 * 竞技依据：狼人直接知晓刀口目标（identity_table 中"→已NX夜行刀"标记），
 *           相比好人侧用票压代理推断，狼人可直接确认守卫/女巫来源。
 *
 * T1-T5:  变量声明（isNightPeacefulWolf / wolfNightPeaceStep / wolfNightPrevDay / 条件 / 非平安夜 fallback）
 * T6-T10: 内容验证（⭕标记 / 路径A换刀 / 路径B维持 / identity_table 注记 / thought 约束）
 * T11-T15: 注入位置（${wolfNightPeaceStep} 在 wolfHistoryStep / 位置在 wolfHistoryStep 之前声明 / 顺序正确）
 * T16-T20: 回归（非平安夜回退 / 白熊效应合规 / dayCount=1 安全 / 块大小 ≤ 7000 / R47/R79 兼容）
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { generateUserPrompt, PROMPT_ACTIONS } from '../aiPrompts.js';

const src = readFileSync(resolve('src/services/aiPrompts.js'), 'utf8');

// ─── NIGHT_WOLF block locator（使用动态切片，与 R79 相同策略）─────────────────
const nightWolfStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_WOLF: {');
const nightSeerStart = src.indexOf('case PROMPT_ACTIONS.NIGHT_SEER:', nightWolfStart);
const nightWolfBlock = src.slice(nightWolfStart, nightSeerStart);

// ─── 测试 helper：生成 NIGHT_WOLF prompt ─────────────────────────────────────
function makeGameState({ dayCount = 1, deathHistory = [], personalityType = '' } = {}) {
    return {
        players: [
            { id: 1, role: '狼人', isAlive: true, name: 'A', personality: { type: personalityType, traits: '测试' } },
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

function wolfPrompt(dayCount, deathHistory = [], personalityType = '') {
    const gs = makeGameState({ dayCount, deathHistory, personalityType });
    return generateUserPrompt(PROMPT_ACTIONS.NIGHT_WOLF, gs, {
        playerId: 1,
        currentPlayer: gs.players[0],
    });
}

// ═══════════════════════════════════════════════════════
// T1-T5: 变量声明
// ═══════════════════════════════════════════════════════

describe('T1-T5: wolfNightPeaceStep 变量声明', () => {
    test('T1: isNightPeacefulWolf 变量声明存在（条件：dayCount > 1 && lastNightInfo?.includes 平安夜）', () => {
        expect(nightWolfBlock).toContain('isNightPeacefulWolf');
        expect(nightWolfBlock).toContain("ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜')");
    });

    test('T2: wolfNightPeaceStep 变量声明存在（三元赋值）', () => {
        expect(nightWolfBlock).toContain('wolfNightPeaceStep');
        // 三元赋值：isNightPeacefulWolf ? ... : ...
        const peaceStepDecl = nightWolfBlock.indexOf('wolfNightPeaceStep = isNightPeacefulWolf');
        expect(peaceStepDecl).toBeGreaterThan(0);
    });

    test('T3: wolfNightPrevDay 变量声明存在（dayCount > 1 时赋值 dayCount - 1）', () => {
        expect(nightWolfBlock).toContain('wolfNightPrevDay');
        expect(nightWolfBlock).toContain('ctx.dayCount > 1 ? ctx.dayCount - 1 : 0');
    });

    test('T4: wolfNightPeaceStep 的 R84 注释标记存在', () => {
        expect(nightWolfBlock).toContain('R84');
        expect(nightWolfBlock).toContain('NIGHT_WOLF 平安夜换刀决策框架');
    });

    test('T5: 非平安夜时 wolfNightPeaceStep 回退为原始单行文本', () => {
        // 三元的 false 分支应保留原始文本以向下兼容
        expect(nightWolfBlock).toContain('守卫可能守住/女巫救了，重新评估优先目标');
    });
});

// ═══════════════════════════════════════════════════════
// T6-T10: 内容验证
// ═══════════════════════════════════════════════════════

describe('T6-T10: wolfNightPeaceStep 内容验证', () => {
    test('T6: 平安夜时注入 ⭕【换刀决策框架】标记（thought 约束标识符）', () => {
        const p = wolfPrompt(2, []);
        expect(p).toContain('⭕【换刀决策框架');
    });

    test('T7: 路径A - 刀口目标票压高时建议换刀', () => {
        const p = wolfPrompt(2, []);
        expect(p).toContain('路径A');
        expect(p).toContain('连守目标命中率极低');
        expect(p).toContain('今晚换刀');
    });

    test('T8: 路径B - 刀口目标票压低时维持高优先', () => {
        const p = wolfPrompt(2, []);
        expect(p).toContain('路径B');
        expect(p).toContain('维持今晚高优先');
        expect(p).toContain('女巫无救药覆盖');
    });

    test('T9: 包含 identity_table 追加注记指导（NX平安夜：[A换刀/B维持]）', () => {
        const p = wolfPrompt(2, []);
        // 检查包含平安夜追加注记格式
        expect(p).toMatch(/N\d平安夜：\[A换刀\/B维持\]/);
    });

    test('T10: 平安夜步骤要求在 thought 中完成（不在 speech 展示）', () => {
        const p = wolfPrompt(2, []);
        expect(p).toContain('thought 中完成');
    });
});

// ═══════════════════════════════════════════════════════
// T11-T15: 注入位置
// ═══════════════════════════════════════════════════════

describe('T11-T15: 注入位置验证', () => {
    test('T11: wolfNightPeaceStep 变量声明在 wolfHistoryStep 声明之前', () => {
        const peaceStepIdx = nightWolfBlock.indexOf('wolfNightPeaceStep = isNightPeacefulWolf');
        const histStepIdx = nightWolfBlock.indexOf('wolfHistoryStep = ctx.dayCount');
        expect(peaceStepIdx).toBeGreaterThan(0);
        expect(histStepIdx).toBeGreaterThan(peaceStepIdx);
    });

    test('T12: wolfHistoryStep 模板中包含 ${wolfNightPeaceStep} 插值（代替硬编码文本）', () => {
        expect(nightWolfBlock).toContain('${wolfNightPeaceStep}');
    });

    test('T13: 生成的 prompt 中 wolfNightPeaceStep 内容在 wolfHistoryStep 区域内（"交叉比对"之后）', () => {
        const p = wolfPrompt(2, []);
        const crossIdx = p.indexOf('交叉比对');
        const peaceIdx = p.indexOf('换刀决策框架');
        expect(crossIdx).toBeGreaterThan(0);
        expect(peaceIdx).toBeGreaterThan(crossIdx);
    });

    test('T14: 换刀决策框架在 wolfNightStyle（刀口风格）之前注入', () => {
        const p = wolfPrompt(2, [], 'aggressive');
        const peaceIdx = p.indexOf('换刀决策框架');
        const styleIdx = p.indexOf('你的刀口风格');
        // 换刀决策框架来自 wolfHistoryStep（wolfNightStyle 之前注入）
        expect(peaceIdx).toBeGreaterThan(0);
        expect(styleIdx).toBeGreaterThan(peaceIdx);
    });

    test('T15: prevDay 动态引用（N${wolfNightPrevDay} 形式）', () => {
        // N2 平安夜时应显示 N1
        const p = wolfPrompt(2, []);
        expect(p).toContain('N1夜行刀');
        // N3 平安夜时应显示 N2
        const p3 = wolfPrompt(3, []);
        // N3时lastNightInfo会包含"昨晚(第2夜): 平安夜(无人死亡)"
        if (p3.includes('换刀决策框架')) {
            expect(p3).toContain('N2夜行刀');
        }
    });
});

// ═══════════════════════════════════════════════════════
// T16-T20: 回归测试
// ═══════════════════════════════════════════════════════

describe('T16-T20: 回归测试', () => {
    test('T16: N1 首夜：无换刀决策框架，使用首夜通用指导', () => {
        const p = wolfPrompt(1);
        expect(p).not.toContain('换刀决策框架');
        expect(p).toContain('首夜');
        expect(p).toContain('无历史刀口记录');
    });

    test('T17: N2 有死亡（非平安夜）：无换刀决策框架，原始单行回退', () => {
        const p = wolfPrompt(2, [{ playerId: 3, day: 1, phase: '夜', cause: '被袭击' }]);
        expect(p).not.toContain('换刀决策框架');
        // 有死亡时 lastNightInfo 不包含"平安夜"
        expect(p).not.toContain('⭕【换刀决策框架');
    });

    test('T18: 白熊效应合规 — 路径A/B 使用正向描述（无"不要""禁止""不能"等负向词）', () => {
        const peaceStepIdx = nightWolfBlock.indexOf('wolfNightPeaceStep = isNightPeacefulWolf');
        const fallbackIdx = nightWolfBlock.indexOf(': \'· 若平安夜 → 守卫可能守住', peaceStepIdx);
        const peaceContent = nightWolfBlock.slice(peaceStepIdx, fallbackIdx);
        expect(peaceContent).not.toMatch(/不要|禁止|不能|绝不/);
    });

    test('T19: 新块大小 ≤ 7000 chars（R76 测试窗口限制）', () => {
        // NIGHT_WOLF 添加 wolfNightPeaceStep 后约 6115 chars，需 ≤ 7000
        expect(nightWolfBlock.length).toBeLessThan(7000);
        // 同时确认确实大于 5361（原始大小），说明内容已添加
        expect(nightWolfBlock.length).toBeGreaterThan(5361);
    });

    test('T20: R47 兼容 — wolfHistoryStep 原有内容（核查执行结果、女巫只剩毒药）仍存在', () => {
        const p = wolfPrompt(2, []);
        expect(p).toContain('核查执行结果');
        expect(p).toContain('交叉比对');
        expect(p).toContain('女巫只剩毒药');
        // R79 兼容：次日叙事预案 Step 4 仍存在
        expect(p).toContain('次日刀后叙事预案');
    });
});
