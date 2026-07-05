/**
 * Round 123: 摄梦人 SHERIFF_BADGE_PASS 专属分支
 *
 * 问题：SHERIFF_BADGE_PASS 有 狼人/女巫/守卫/骑士/魔术师/预言家 6 个专属分支，
 *   但 摄梦人 走通用好人 fallback（"你是好人警长"），未利用角色私有信息：
 *   - 摄梦人：dreamweaverHistory.dreamedPlayers（入梦历史）是最直接的信任锚点——
 *     入梦频次最高的存活候选人 = 摄梦人最愿意为之承担同生共死风险的好人
 *
 * 修复（R123）：
 *   1. bpDreamweaverHint：新增 摄梦人 专属信任锚点块（dreamedPlayers 频次分析 → top-2）
 *   2. bpIdentityStep：新增 摄梦人 分支（第 8 路径，入梦最频繁者作传徽优先锚）
 *   3. bpHint：新增 摄梦人 分支（第 8 路径，"摄梦人警长"专属行动框架）
 *   4. return 模板追加 ${bpDreamweaverHint}（空串时零副作用）
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   摄梦人 dreamedPlayers 是与守卫 guardHistory 同类的"零间接私有信息"——
 *   选择入梦同一人多次 = AI 主动表达信任，与守卫多次守护同理（直接行为 ground truth）。
 *
 * BP_WINDOW 更新历史：
 *   R117: 8500 (block 6389 chars)
 *   R122: +480 → block ~6870
 *   R123: +1525 → block 8327 → BP_WINDOW = 10000 (8327 × 120%)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
// R123: block 8327 chars → 10000 ≥ 8327×120%
const BP_WINDOW = 10000;
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T2: 块锚点校验 ────────────────────────────────────────────────────────

describe('R123: SHERIFF_BADGE_PASS 锚点 + R123 版本标识', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: R123 注释存在于 BADGE_PASS 块（版本标识）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('R123');
    });
});

// ─── T3-T6: bpDreamweaverHint 摄梦人入梦历史路径 ─────────────────────────────

describe('R123: bpDreamweaverHint 摄梦人入梦历史路径', () => {
    test('T3: bpDreamweaverHistory 变量声明存在（gameState.dreamweaverHistory 安全读取）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const bpDreamweaverHistory = gameState.dreamweaverHistory');
    });

    test("T4: bpDreamweaverHint 声明为 let 且 摄梦人判断分支存在（playerRole === '摄梦人'）", () => {
        const blk = getBpBlock();
        expect(blk).toContain("let bpDreamweaverHint = '';");
        expect(blk).toContain("playerRole === '摄梦人' && bpDreamweaverDreamed.length > 0");
    });

    test('T5: dwDreamCounts 频次计数对象声明存在', () => {
        const blk = getBpBlock();
        expect(blk).toContain('const dwDreamCounts = {};');
    });

    test('T6: bpDreamweaverHint 内容包含「入梦记录」和「同生共死」关键词（正向信任锚点描述）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf("let bpDreamweaverHint = '';");
        // 入梦@582, 同生共死@743 (含缩进), 需要窗口 800+
        const hintBlock = blk.slice(hintIdx, hintIdx + 800);
        expect(hintBlock).toContain('入梦');
        expect(hintBlock).toContain('同生共死');
    });
});

// ─── T7-T9: bpIdentityStep 摄梦人分支 ────────────────────────────────────────

describe('R123: bpIdentityStep 摄梦人分支', () => {
    test("T7: bpIdentityStep 摄梦人分支存在（playerRole === '摄梦人' 路由）", () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2000);
        expect(stepBlock).toContain("playerRole === '摄梦人'");
    });

    test('T8: bpIdentityStep 摄梦人分支包含「入梦最频繁者」优先级标记', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2000);
        const dwPartStart = stepBlock.indexOf("playerRole === '摄梦人'");
        const dwPart = stepBlock.slice(dwPartStart, dwPartStart + 300);
        expect(dwPart).toContain('入梦最频繁者');
    });

    test('T9: bpIdentityStep 摄梦人分支包含「同生共死」传徽信任说明', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2000);
        const dwPartStart = stepBlock.indexOf("playerRole === '摄梦人'");
        const dwPart = stepBlock.slice(dwPartStart, dwPartStart + 300);
        expect(dwPart).toContain('同生共死');
    });
});

// ─── T10-T11: bpHint 摄梦人分支 ──────────────────────────────────────────────

describe('R123: bpHint 摄梦人分支', () => {
    test("T10: bpHint 摄梦人分支存在（playerRole === '摄梦人' 路由）", () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1200);
        expect(hintBlock).toContain("playerRole === '摄梦人'");
    });

    test('T11: bpHint 摄梦人分支包含「摄梦人警长」角色标识', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1200);
        expect(hintBlock).toContain('摄梦人警长');
    });
});

// ─── T12: return 模板包含 bpDreamweaverHint ──────────────────────────────────

describe('R123: return 模板追加 bpDreamweaverHint', () => {
    test('T12: return 模板中 bpDreamweaverHint 在 bpMagicianHint 之后', () => {
        const blk = getBpBlock();
        const retIdx = blk.indexOf('return `你（警长）死亡');
        const retBlock = blk.slice(retIdx, retIdx + 400);
        const magIdx = retBlock.indexOf('bpMagicianHint}');
        const dwIdx = retBlock.indexOf('bpDreamweaverHint}');
        expect(magIdx).toBeGreaterThan(0);
        expect(dwIdx).toBeGreaterThan(magIdx);
    });
});

// ─── T13: 白熊效应合规 ───────────────────────────────────────────────────────

describe('R123: 白熊效应合规（摄梦人新增分支内容为正向描述）', () => {
    test('T13: 摄梦人 bpDreamweaverHint + bpIdentityStep + bpHint 分支无负向禁令词汇', () => {
        const blk = getBpBlock();
        const dwHistoryIdx = blk.indexOf('R123: 摄梦人 SHERIFF_BADGE_PASS');
        const r64CommentIdx = blk.indexOf('R64 读写闭环');
        const dwSection = blk.slice(dwHistoryIdx, r64CommentIdx);
        expect(dwSection).not.toContain('自曝');
        expect(dwSection).not.toContain('千万别');
        expect(dwSection).not.toContain('千万不');
        expect(dwSection).not.toContain('绝不能');
    });
});

// ─── T14-T15: 回归测试 — 所有已有专属分支完整保留 ────────────────────────────

describe('R123: 回归 — 已有路径完整', () => {
    test('T14: bpHint 仍包含 狼人/女巫/守卫/骑士/魔术师/预言家/好人 七个原有分支', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1200);
        expect(hintBlock).toContain('狼人警长');
        expect(hintBlock).toContain('女巫警长');
        expect(hintBlock).toContain('守卫警长');
        expect(hintBlock).toContain('骑士警长');
        expect(hintBlock).toContain('魔术师警长');
        expect(hintBlock).toContain('预言家警长');
        expect(hintBlock).toContain('好人警长');
    });

    test('T15: bpIdentityStep 仍包含 女巫/守卫/骑士/魔术师/预言家 五个原有专属分支关键词', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2000);
        expect(stepBlock).toContain('银水（你救过的存活好人）');
        expect(stepBlock).toContain('守护最频繁者');
        expect(stepBlock).toContain('能力结果确认的好人');
        expect(stepBlock).toContain('交换知识确认的好人');
        expect(stepBlock).toContain('金水验证候选');
    });
});
