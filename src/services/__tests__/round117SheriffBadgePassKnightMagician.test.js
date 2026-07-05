/**
 * Round 117: 骑士 + 魔术师 SHERIFF_BADGE_PASS 专属提示词
 *
 * 问题：SHERIFF_BADGE_PASS 仅有 狼人/女巫/守卫 三个专属分支，骑士和魔术师均走通用
 *   fallback（"你是好人警长"），未利用角色私有信息：
 *   - 骑士：hasUsedDuel（能力状态）— 未用时能力随离场作废，传徽应优先最强好人；
 *            已用时能力结果是最高可信度判断依据
 *   - 魔术师：hasRevealed（身份暴露）+ magicianHistory（交换知识）—
 *            身份公开时交换知识是优于 identity_table 的一手信息；
 *            身份隐藏时传徽选择不应暴露私有信息
 *
 * 修复（R117）：
 *   1. bpKnightHint：骑士 2 路径（已用/未用能力）
 *   2. bpMagicianHint：魔术师 2 路径（身份已公开/隐藏）× 交换容量说明
 *   3. bpIdentityStep：扩展至 6 路径（新增骑士/魔术师分支）
 *   4. bpHint：扩展至 6 路径（新增骑士/魔术师分支）
 *   5. return 模板追加 bpKnightHint + bpMagicianHint
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   骑士能力结果 + 魔术师交换知识是传徽决策中仅次于预言家金水的最强信任依据。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
// R117: 8500; R123: +摄梦人分支 block now 8327 chars → 10000 ≥ 8327×120%
const BP_WINDOW = 10000;
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T2: 块锚点校验 ────────────────────────────────────────────────────────

describe('R117: SHERIFF_BADGE_PASS case 块锚点', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: R117 注释存在于 BADGE_PASS 块（版本标识）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('R117');
    });
});

// ─── T3-T5: 骑士私有信息变量声明 ─────────────────────────────────────────────

describe('R117: 骑士 bpKnightHint 变量声明', () => {
    test('T3: bpKnightDueled 声明存在（从 currentPlayer.hasUsedDuel 读取）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpKnightDueled = currentPlayer?.hasUsedDuel');
    });

    test('T4: bpKnightHint 声明为 let 且 骑士判断分支存在', () => {
        const blk = getBpBlock();
        expect(blk).toContain("let bpKnightHint = '';");
        expect(blk).toContain("playerRole === '骑士'");
    });

    test('T5: bpKnightHint 两路径均存在（能力已用/未用，白熊效应检查）', () => {
        const blk = getBpBlock();
        const knightIdx = blk.indexOf("let bpKnightHint = '';");
        const knightBlock = blk.slice(knightIdx, knightIdx + 900);
        // 已用路径（bpKnightDueled 为 true）
        expect(knightBlock).toContain('能力结果揭示了场上身份真相');
        // 未用路径（bpKnightDueled 为 false）
        expect(knightBlock).toContain('能力尚未使用，将随你离场作废');
        // 白熊效应检查：不应出现"决斗"具体技能词汇（R45 铁律）
        expect(knightBlock).not.toContain('决斗');
    });
});

// ─── T6-T9: 魔术师私有信息变量声明 ───────────────────────────────────────────

describe('R117: 魔术师 bpMagicianHint 变量声明', () => {
    test('T6: bpMagHistory 声明存在（从 gameState.magicianHistory 读取）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpMagHistory = gameState.magicianHistory');
    });

    test('T7: bpMagSwappedCount 和 bpMagIsRevealed 声明均存在', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpMagSwappedCount =');
        expect(blk).toContain('const bpMagIsRevealed = currentPlayer?.hasRevealed');
    });

    test('T8: bpMagicianHint 声明为 let 且 魔术师判断分支存在', () => {
        const blk = getBpBlock();
        expect(blk).toContain("let bpMagicianHint = '';");
        expect(blk).toContain("playerRole === '魔术师'");
    });

    test('T9: bpMagicianHint 两路径均存在（身份已公开/隐藏）', () => {
        const blk = getBpBlock();
        const magIdx = blk.indexOf("let bpMagicianHint = '';");
        const magBlock = blk.slice(magIdx, magIdx + 900);
        // 已公开路径
        expect(magBlock).toContain('身份已公开');
        expect(magBlock).toContain('交换知识');
        // 隐藏路径（正向描述，无禁止词）
        expect(magBlock).toContain('身份仍隐藏');
        expect(magBlock).toContain('按通用优先级操作');
    });
});

// ─── T10-T11: bpIdentityStep 6路径 ───────────────────────────────────────────

describe('R117: bpIdentityStep 扩展至 6 路径', () => {
    test('T10: bpIdentityStep 骑士分支存在，包含「能力结果确认的好人」关键词', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1400);
        expect(stepBlock).toContain("playerRole === '骑士'");
        expect(stepBlock).toContain('能力结果确认的好人');
    });

    test('T11: bpIdentityStep 魔术师分支存在，包含「交换知识确认的好人」关键词', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1600);
        expect(stepBlock).toContain("playerRole === '魔术师'");
        expect(stepBlock).toContain('交换知识确认的好人');
    });
});

// ─── T12-T13: bpHint 6路径 ────────────────────────────────────────────────────

describe('R117: bpHint 扩展至 6 路径', () => {
    test('T12: bpHint 骑士分支存在，包含「骑士警长」和「能力信息」关键词', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 900);
        expect(hintBlock).toContain('骑士警长');
        expect(hintBlock).toContain('能力信息');
    });

    test('T13: bpHint 魔术师分支存在，包含「魔术师警长」和「交换知识」关键词', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 900);
        expect(hintBlock).toContain('魔术师警长');
        expect(hintBlock).toContain('交换知识');
    });
});

// ─── T14-T15: Return 模板追加新变量 ──────────────────────────────────────────

describe('R117: Return 模板包含 bpKnightHint + bpMagicianHint', () => {
    test('T14: return 模板追加 bpKnightHint（骑士路径传递）', () => {
        const blk = getBpBlock();
        const retIdx = blk.indexOf('return `你（警长）死亡');
        const retBlock = blk.slice(retIdx, retIdx + 350);
        expect(retBlock).toContain('bpKnightHint');
    });

    test('T15: return 模板追加 bpMagicianHint（魔术师路径传递）', () => {
        const blk = getBpBlock();
        const retIdx = blk.indexOf('return `你（警长）死亡');
        const retBlock = blk.slice(retIdx, retIdx + 350);
        expect(retBlock).toContain('bpMagicianHint');
    });
});

// ─── T16-T17: 白熊效应检查（R1/R30/R45 铁律）────────────────────────────────

describe('R117: 白熊效应检查（无负向禁止词）', () => {
    test('T16: bpKnightHint 块不含禁止词（自曝/千万别/绝不能）', () => {
        const blk = getBpBlock();
        const knightIdx = blk.indexOf("let bpKnightHint = '';");
        const knightBlock = blk.slice(knightIdx, knightIdx + 900);
        expect(knightBlock).not.toContain('自曝');
        expect(knightBlock).not.toContain('千万别');
        expect(knightBlock).not.toContain('绝不能');
    });

    test('T17: bpMagicianHint 块不含负向禁止词（自曝/千万别/绝不能）', () => {
        const blk = getBpBlock();
        const magIdx = blk.indexOf("let bpMagicianHint = '';");
        const magBlock = blk.slice(magIdx, magIdx + 900);
        expect(magBlock).not.toContain('自曝');
        expect(magBlock).not.toContain('千万别');
        expect(magBlock).not.toContain('绝不能');
    });
});

// ─── T18: R113 回归检查（女巫/守卫路径仍在 bpHint） ───────────────────────────

describe('R117: R113 回归 — 女巫/守卫路径仍完整', () => {
    test('T18: bpHint 仍包含女巫 + 守卫 + 狼人 + 好人 fallback 四个原有分支', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 900);
        expect(hintBlock).toContain('女巫警长');
        expect(hintBlock).toContain('守卫警长');
        expect(hintBlock).toContain('狼人警长');
        expect(hintBlock).toContain('好人警长');
    });
});
