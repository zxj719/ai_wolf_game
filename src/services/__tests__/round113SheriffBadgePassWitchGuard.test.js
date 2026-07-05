/**
 * Round 113: 女巫 + 守卫 SHERIFF_BADGE_PASS 专属提示词
 *
 * 问题：SHERIFF_BADGE_PASS 仅有 狼人/好人 二元分支，未利用角色私有信息：
 *   - 女巫：witchHistory.savedIds（银水 = 亲手救过的存活好人）是传徽最强信任锚点
 *   - 守卫：guardHistory（守护频次）是不可伪造的信任排序依据
 *
 * 修复（R113）：
 *   1. 女巫：bpWitchSavedAlive（银水存活过滤）→ bpWitchHint
 *   2. 守卫：guardCounts 频次分析 → bpGuardHint（Top-2 守护候选）
 *   3. bpIdentityStep：4路径（狼/女巫/守卫/others）优先级链各含专属私有信息锚点
 *   4. bpHint：4路径（狼/女巫/守卫/others）专属行动框架
 *   5. return 模板末尾追加 bpWitchHint + bpGuardHint（空串时零副作用）
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   女巫银水 + 守卫守护记录是 SHERIFF_BADGE_PASS 的核心信任锚点（同 R112 SHERIFF_SPEECH 设计）。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
const BP_WINDOW = 8500; // R117: +2386 chars (knight/magician blocks), block now 6389 chars → 8500 ≈ 6389×133%
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T3: 锚点 + 基础变量声明 ──────────────────────────────────────────────

describe('R113: SHERIFF_BADGE_PASS case 块存在 + 基础变量声明', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: bpWitchHistory 变量声明存在（gameState.witchHistory 安全读取）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpWitchHistory = gameState.witchHistory');
    });

    test('T3: bpGuardHistory 变量声明存在（gameState.guardHistory 安全读取）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpGuardHistory = gameState.guardHistory');
    });
});

// ─── T4-T6: bpWitchHint 女巫银水路径 ─────────────────────────────────────────

describe('R113: bpWitchHint 女巫银水路径', () => {
    test('T4: bpWitchSavedAlive 声明存在（savedIds 按 badgeableSet 过滤存活候选）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpWitchSavedAlive =');
        expect(blk).toContain('badgeableSet.has(id)');
    });

    test("T5: bpWitchHint 声明为 let 且 女巫判断分支存在（playerRole === '女巫'）", () => {
        const blk = getBpBlock();
        expect(blk).toContain('let bpWitchHint = \'\';');
        expect(blk).toContain("playerRole === '女巫' && bpWitchSavedAlive.length > 0");
    });

    test('T6: bpWitchHint 内容包含「银水」和「传徽首选」关键词（正向信任锚点描述）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('let bpWitchHint = \'\';');
        const hintBlock = blk.slice(hintIdx, hintIdx + 400);
        expect(hintBlock).toContain('银水');
        expect(hintBlock).toContain('传徽首选');
    });
});

// ─── T7-T9: bpGuardHint 守卫守护路径 ─────────────────────────────────────────

describe('R113: bpGuardHint 守卫守护路径', () => {
    test('T7: guardCounts 频次计数对象声明存在', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const guardCounts = {};');
    });

    test("T8: bpGuardHint 声明为 let 且 守卫判断分支存在（playerRole === '守卫'）", () => {
        const blk = getBpBlock();
        expect(blk).toContain('let bpGuardHint = \'\';');
        expect(blk).toContain("playerRole === '守卫' && bpGuardHistory.length > 0");
    });

    test('T9: bpGuardHint 内容包含「守护」和「优先传徽」关键词（正向信任锚点描述）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('let bpGuardHint = \'\';');
        const hintBlock = blk.slice(hintIdx, hintIdx + 900);
        expect(hintBlock).toContain('守护');
        expect(hintBlock).toContain('优先传徽');
    });
});

// ─── T10-T12: bpIdentityStep 角色优先级链 ────────────────────────────────────

describe('R113: bpIdentityStep 四路径优先级链', () => {
    test('T10: bpIdentityStep 女巫分支包含「银水」优先级标记', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 800);
        expect(stepBlock).toContain('银水');
    });

    test('T11: bpIdentityStep 守卫分支包含「守护最频繁者」优先级标记', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1000);
        expect(stepBlock).toContain('守护最频繁者');
    });

    test('T12: bpIdentityStep others fallback 仍包含原始 Step0 历史推理读取指导', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1200);
        expect(stepBlock).toContain('读取历史身份推理（传徽决策依据）');
    });
});

// ─── T13-T15: bpHint 角色专属行动框架 ───────────────────────────────────────

describe('R113: bpHint 四路径行动框架', () => {
    test('T13: bpHint 女巫分支包含「银水记录」和「传徽对象」关键词', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 700);
        expect(hintBlock).toContain('银水记录');
        expect(hintBlock).toContain('传徽对象');
    });

    test('T14: bpHint 守卫分支包含「守护记录」和「传徽对象」关键词', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 700);
        expect(hintBlock).toContain('守护记录');
        expect(hintBlock).toContain('传徽对象');
    });

    test('T15: bpHint 好人 fallback 仍存在（非女巫/守卫/狼人的通用框架）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        // R122: 新增预言家分支（~120 chars）后好人 fallback 位置后移，窗口从 700 → 1100
        const hintBlock = blk.slice(hintIdx, hintIdx + 1100);
        expect(hintBlock).toContain('你是好人警长：把警徽传给你最确信的好人');
    });
});

// ─── T16-T17: Return 模板包含新变量 ──────────────────────────────────────────

describe('R113: Return 模板包含 bpWitchHint + bpGuardHint', () => {
    test('T16: return 模板末尾追加 bpWitchHint（女巫路径传递）', () => {
        const blk = getBpBlock();
        const retIdx = blk.indexOf('return `你（警长）死亡');
        const retBlock = blk.slice(retIdx, retIdx + 300);
        expect(retBlock).toContain('bpWitchHint');
    });

    test('T17: return 模板末尾追加 bpGuardHint（守卫路径传递）', () => {
        const blk = getBpBlock();
        const retIdx = blk.indexOf('return `你（警长）死亡');
        const retBlock = blk.slice(retIdx, retIdx + 300);
        expect(retBlock).toContain('bpGuardHint');
    });
});

// ─── T18: 白熊效应合规（第 34 次验证）────────────────────────────────────────

describe('R113: 白熊效应合规（bpWitchHint / bpGuardHint 内容为正向描述）', () => {
    test('T18: bpWitchHint + bpGuardHint 变量块内容无负向游戏策略禁词（正向描述铁律）', () => {
        const blk = getBpBlock();
        const witchStart = blk.indexOf('let bpWitchHint = \'\';');
        const guardEnd = blk.indexOf('const bpIdentityStep =', witchStart);
        const hintBlock = blk.slice(witchStart, guardEnd);
        expect(hintBlock).not.toContain('自曝');
        expect(hintBlock).not.toContain('千万别');
        expect(hintBlock).not.toContain('千万不');
        // '绝对不能移交' 只出现在 seerHint 查杀提示中（已验狼），不应出现在本块
        const negCount = (hintBlock.match(/绝对不能移交/g) || []).length;
        expect(negCount).toBe(0);
    });
});

// ─── T19-T20: 回归测试 ────────────────────────────────────────────────────────

describe('R113: 回归测试 - 已有逻辑完整保留', () => {
    test('T19: seerHint 金水/查杀逻辑仍存在（预言家信息路径保留）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('goldWaterTargets');
        expect(blk).toContain('killedTargets');
        expect(blk).toContain('预言家金水（已验好人）');
    });

    test('T20: bpHint 狼人分支仍存在（传徽给狼队友策略保留）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('你是狼人警长：把警徽传给狼队友能延续1.5票优势');
    });
});
