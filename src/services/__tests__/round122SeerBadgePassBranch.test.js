/**
 * Round 122: 预言家 SHERIFF_BADGE_PASS 专属分支
 *
 * 问题：SHERIFF_BADGE_PASS 有 狼人/女巫/守卫/骑士/魔术师 5 个专属分支，
 *   但 预言家 走通用好人 fallback（"你是好人警长"），未利用角色私有信息：
 *   - 预言家：seerChecks（验证记录）是全场最可靠的一手信息，优先级高于 identity_table 推断
 *   - 金水候选是最直接的传徽选择，不需要借助 identity_table 推断来"确认"
 *
 * 修复（R122）：
 *   1. bpIdentityStep：新增 预言家 分支（第 7 路径），强调一手信息优先
 *   2. bpHint：新增 预言家 分支（第 7 路径），"预言家警长"专属行动框架
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   预言家验证记录是 SHERIFF_BADGE_PASS 中确定性最高的私有信息（100% 一手验证），
 *   不同于守卫守护频次、骑士决斗结果——后者是推断，前者是直接知识。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
// R117: block was 6389 chars → BP_WINDOW = 8500 (6389 × 133%)
// R122 adds ~480 chars (seer bpIdentityStep + bpHint branches) → block ~6870, still within 8500
const BP_WINDOW = 8500;
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T2: 块锚点校验 ────────────────────────────────────────────────────────

describe('R122: SHERIFF_BADGE_PASS 锚点 + R122 版本标识', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: R122 注释存在于 BADGE_PASS 块（版本标识）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('R122');
    });
});

// ─── T3-T5: bpIdentityStep 预言家分支 ────────────────────────────────────────

describe('R122: bpIdentityStep 预言家分支', () => {
    test('T3: bpIdentityStep 预言家分支存在（playerRole === 预言家 路由）', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1800);
        expect(stepBlock).toContain("playerRole === '预言家'");
    });

    test('T4: bpIdentityStep 预言家分支包含「一手信息，优先级高于 identity_table 推断」核心框架', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1800);
        const seerPartStart = stepBlock.indexOf("playerRole === '预言家'");
        const seerPart = stepBlock.slice(seerPartStart, seerPartStart + 400);
        expect(seerPart).toContain('一手信息，优先级高于 identity_table 推断');
    });

    test('T5: bpIdentityStep 预言家分支包含「金水验证候选」优先级标记', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1800);
        const seerPartStart = stepBlock.indexOf("playerRole === '预言家'");
        const seerPart = stepBlock.slice(seerPartStart, seerPartStart + 400);
        expect(seerPart).toContain('金水验证候选');
    });
});

// ─── T6-T8: bpHint 预言家分支 ─────────────────────────────────────────────────

describe('R122: bpHint 预言家分支', () => {
    test('T6: bpHint 预言家分支存在（playerRole === 预言家 路由）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1100);
        expect(hintBlock).toContain("playerRole === '预言家'");
    });

    test('T7: bpHint 预言家分支包含「预言家警长」角色标识', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1100);
        expect(hintBlock).toContain('预言家警长');
    });

    test('T8: bpHint 预言家分支包含「⚡金水候选」优先级标记（正向描述铁律）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1100);
        const seerHintStart = hintBlock.indexOf('预言家警长');
        const seerHintPart = hintBlock.slice(seerHintStart, seerHintStart + 200);
        expect(seerHintPart).toContain('金水候选');
    });
});

// ─── T9: 白熊效应合规 ────────────────────────────────────────────────────────

describe('R122: 白熊效应合规（预言家新增分支内容为正向描述）', () => {
    test('T9: 预言家 bpIdentityStep + bpHint 分支无负向禁令词汇', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const hintEnd = blk.indexOf('return `你（警长）死亡', stepIdx);
        const stepToHint = blk.slice(stepIdx, hintEnd);
        // 提取预言家相关段落
        const seerStepStart = stepToHint.lastIndexOf("playerRole === '预言家'");
        const seerBlock = stepToHint.slice(seerStepStart, seerStepStart + 600);
        expect(seerBlock).not.toContain('自曝');
        expect(seerBlock).not.toContain('千万别');
        expect(seerBlock).not.toContain('千万不');
        expect(seerBlock).not.toContain('绝不能');
    });
});

// ─── T10-T11: 回归测试 — R113/R117 已有分支完整保留 ───────────────────────────

describe('R122: 回归 — R113/R117 已有路径完整', () => {
    test('T10: bpHint 仍包含 狼人/女巫/守卫/骑士/魔术师/好人 六个原有分支', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1100);
        expect(hintBlock).toContain('狼人警长');
        expect(hintBlock).toContain('女巫警长');
        expect(hintBlock).toContain('守卫警长');
        expect(hintBlock).toContain('骑士警长');
        expect(hintBlock).toContain('魔术师警长');
        expect(hintBlock).toContain('好人警长');
    });

    test('T11: bpIdentityStep 仍包含 女巫/守卫/骑士/魔术师 四个原有专属分支关键词', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 1800);
        expect(stepBlock).toContain('银水（你救过的存活好人）');
        expect(stepBlock).toContain('守护最频繁者');
        expect(stepBlock).toContain('能力结果确认的好人');
        expect(stepBlock).toContain('交换知识确认的好人');
    });
});

// ─── T12: seerHint 预言家金水信息仍透传给所有角色 ─────────────────────────────

describe('R122: seerHint 机制仍完整（非 R122 新增，验证无回归）', () => {
    test('T12: seerHint 逻辑仍存在（goldWaterTargets + killedTargets）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('goldWaterTargets');
        expect(blk).toContain('killedTargets');
        expect(blk).toContain('预言家金水（已验好人）');
    });
});
