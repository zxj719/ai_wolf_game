/**
 * Round 127: 猎人 SHERIFF_BADGE_PASS 专属分支
 *
 * 问题：SHERIFF_BADGE_PASS 有 狼人/女巫/守卫/骑士/魔术师/预言家/摄梦人 7 个专属分支，
 *   但 猎人 走通用好人 fallback（"你是好人警长"），缺少角色专属策略，未利用
 *   猎人的关键博弈特性——枪击 × 传徽协同：
 *   - 猎人出局时必然开枪带走嫌疑目标（主要威慑）
 *   - 警徽要传给能延续好人阵营战力的可信好人（而非枪击目标，两张牌合一失去协同价值）
 *   - 撕毁警徽（-1）代价高于其他角色：枪击权已提供威慑，轻易销毁警徽是自废第二张牌
 *
 * 修复（R127）：
 *   1. bpIdentityStep：新增 猎人 分支（枪+徽协同策略，自废第二张牌提示）
 *   2. bpHint：新增 猎人 分支（"猎人警长"专属行动框架）
 *   3. 版本注释：// R127: 猎人 role-specific 优先级链
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策质量；
 *   猎人的"枪击 × 传徽协同"是角色专属的博弈约束——不需要 hunterHistory 结构体，
 *   角色身份本身决定了传徽策略的独特性（传给枪击目标 = 双重消耗零协同）。
 *
 * BADGE_PASS block 大小历史：
 *   R117: 6389 chars → BP_WINDOW=8500
 *   R123: +1525 → 8327 chars → BP_WINDOW=10000
 *   R127: +424 → ~8751 chars → BP_WINDOW=10000 (余量1330)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const bpStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS:');
const BP_WINDOW = 10000;
const getBpBlock = () => src.slice(bpStart, bpStart + BP_WINDOW);

// ─── T1-T2: 块锚点 + R127 版本标识 ─────────────────────────────────────────

describe('R127: SHERIFF_BADGE_PASS 锚点 + R127 版本标识', () => {
    test('T1: SHERIFF_BADGE_PASS case 块存在（锚点校验）', () => {
        expect(bpStart).toBeGreaterThan(0);
    });

    test('T2: R127 注释存在于 BADGE_PASS 块（版本标识）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('R127');
    });
});

// ─── T3-T5: bpIdentityStep 猎人分支 ─────────────────────────────────────────

describe('R127: bpIdentityStep 猎人分支', () => {
    test("T3: bpIdentityStep 猎人分支存在（playerRole === '猎人' 路由）", () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2500);
        expect(stepBlock).toContain("playerRole === '猎人'");
    });

    test("T4: bpIdentityStep 猎人分支包含「开枪权」关键词（枪击威慑说明）", () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2500);
        const hunterStart = stepBlock.lastIndexOf("playerRole === '猎人'");
        const hunterPart = stepBlock.slice(hunterStart, hunterStart + 300);
        expect(hunterPart).toContain('开枪权');
    });

    test('T5: bpIdentityStep 猎人分支包含「第二张牌」关键词（撕徽代价说明）', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2500);
        const hunterStart = stepBlock.lastIndexOf("playerRole === '猎人'");
        const hunterPart = stepBlock.slice(hunterStart, hunterStart + 300);
        expect(hunterPart).toContain('第二张牌');
    });
});

// ─── T6-T8: bpHint 猎人分支 ─────────────────────────────────────────────────

describe('R127: bpHint 猎人分支', () => {
    test("T6: bpHint 猎人分支存在（playerRole === '猎人' 路由）", () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        expect(hintBlock).toContain("playerRole === '猎人'");
    });

    test("T7: bpHint 猎人分支包含「猎人警长」角色标识", () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        expect(hintBlock).toContain('猎人警长');
    });

    test('T8: bpHint 猎人分支包含「双重消耗」或「协同价值」关键词（枪+徽协同理念）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        const hunterBpStart = hintBlock.lastIndexOf("playerRole === '猎人'");
        const hunterBpPart = hintBlock.slice(hunterBpStart, hunterBpStart + 250);
        const hasCoordination = hunterBpPart.includes('双重消耗') || hunterBpPart.includes('协同价值');
        expect(hasCoordination).toBe(true);
    });
});

// ─── T9: 猎人分支在摄梦人之后（链条顺序） ─────────────────────────────────────

describe('R127: 链条顺序 — 猎人分支在摄梦人之后', () => {
    test('T9: bpHint 中猎人分支偏移量大于摄梦人分支（确保插入位置正确）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        const dreamweaverOffset = hintBlock.indexOf('摄梦人警长');
        const hunterOffset = hintBlock.indexOf('猎人警长');
        expect(dreamweaverOffset).toBeGreaterThan(0);
        expect(hunterOffset).toBeGreaterThan(dreamweaverOffset);
    });
});

// ─── T10: 白熊效应合规 ───────────────────────────────────────────────────────

describe('R127: 白熊效应合规（猎人分支使用正向描述）', () => {
    test('T10: 猎人 bpHint 分支不含「不要」「禁止」「绝不」等负向禁令词汇开头的句子', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        const hunterStart = hintBlock.lastIndexOf("playerRole === '猎人'");
        const hunterFallbackEnd = hintBlock.indexOf("好人警长", hunterStart);
        const hunterSection = hintBlock.slice(hunterStart, hunterFallbackEnd > 0 ? hunterFallbackEnd : hunterStart + 300);
        expect(hunterSection).not.toMatch(/^不要|^禁止|^绝不/m);
    });
});

// ─── T11-T13: 回归测试 — 已有专属分支完整保留 ───────────────────────────────

describe('R127: 回归 — 所有已有路径完整', () => {
    test('T11: bpHint 仍包含全部 8 个已有分支（狼人/女巫/守卫/骑士/魔术师/预言家/摄梦人/好人）', () => {
        const blk = getBpBlock();
        const hintIdx = blk.indexOf('const bpHint =');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1500);
        expect(hintBlock).toContain('狼人警长');
        expect(hintBlock).toContain('女巫警长');
        expect(hintBlock).toContain('守卫警长');
        expect(hintBlock).toContain('骑士警长');
        expect(hintBlock).toContain('魔术师警长');
        expect(hintBlock).toContain('预言家警长');
        expect(hintBlock).toContain('摄梦人警长');
        expect(hintBlock).toContain('好人警长');
    });

    test('T12: bpIdentityStep 仍包含摄梦人/预言家/魔术师/骑士/守卫/女巫 已有分支关键词', () => {
        const blk = getBpBlock();
        const stepIdx = blk.indexOf('const bpIdentityStep =');
        const stepBlock = blk.slice(stepIdx, stepIdx + 2500);
        expect(stepBlock).toContain('入梦最频繁者');
        expect(stepBlock).toContain('金水验证候选');
        expect(stepBlock).toContain('交换知识确认的好人');
        expect(stepBlock).toContain('能力结果确认的好人');
        expect(stepBlock).toContain('守护最频繁者');
        expect(stepBlock).toContain('银水（你救过的存活好人）');
    });

    test('T13: bpDreamweaverHint 变量声明仍存在（R123 摄梦人私有信息块未被移除）', () => {
        const blk = getBpBlock();
        expect(blk).toContain('let bpDreamweaverHint');
    });
});

// ─── T14: BP_WINDOW 余量充足 ─────────────────────────────────────────────────

describe('R127: BP_WINDOW 余量', () => {
    test('T14: BADGE_PASS 输出JSON偏移量 < BP_WINDOW=10000（余量充足）', () => {
        const blk = src.slice(bpStart, bpStart + 20000);
        const jsonOffset = blk.indexOf('输出JSON');
        expect(jsonOffset).toBeGreaterThan(0);
        expect(jsonOffset).toBeLessThan(BP_WINDOW);
    });
});
