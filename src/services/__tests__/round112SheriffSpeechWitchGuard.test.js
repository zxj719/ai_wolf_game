/**
 * Round 112: 女巫 + 守卫 SHERIFF_SPEECH 专属提示词
 *
 * 问题：SHERIFF_SPEECH 对女巫和守卫缺少专属竞选框架，两者均落入
 *   通用「你是好人（${playerRole}）」fallback，无法利用各自的角色私有信息：
 *   - 女巫：药水状态（双药/解药/毒药/全用）决定竞选框架
 *   - 守卫：守护记录是不可伪造的信任锚点，身份公开时可直接展示
 *
 * 修复（R112）：
 *   1. 女巫：4路径 witchSsMedStatus（双药均在/解药在/毒药在/双药已用）
 *      × hasRevealedIdentity（已跳身份/未公开）= 2路 witchSsHint
 *   2. 守卫：hasRevealedIdentity（已公开/未公开）= 2路 guardSsHint
 *   3. ssHint 链中插入 女巫/守卫 分支（在骑士之后、通用 fallback 之前）
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升
 *   AI 决策质量；女巫药效状态 + 守卫守护记录是 SHERIFF_SPEECH 的核心竞争优势。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const ssStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
const SS_WINDOW = 8500;
const getSsBlock = () => src.slice(ssStart, ssStart + SS_WINDOW);

// ─── T1-T3: 锚点 + 女巫药水状态变量声明 ─────────────────────────────────────

describe('R112: SHERIFF_SPEECH case 块存在 + 女巫药水状态变量声明', () => {
    test('T1: SHERIFF_SPEECH case 块存在（锚点校验）', () => {
        expect(ssStart).toBeGreaterThan(0);
    });

    test('T2: witchSsSaveHave 声明存在（currentPlayer?.hasWitchSave ?? false 安全读取）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const witchSsSaveHave = currentPlayer?.hasWitchSave ?? false;');
    });

    test('T3: witchSsPoisonHave 声明存在（currentPlayer?.hasWitchPoison ?? false 安全读取）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const witchSsPoisonHave = currentPlayer?.hasWitchPoison ?? false;');
    });
});

// ─── T4-T8: witchSsMedStatus 4路径覆盖 ───────────────────────────────────────

describe('R112: witchSsMedStatus 4路径覆盖', () => {
    test('T4: witchSsMedStatus 声明为 let（可变量，由 if-else 赋值）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('let witchSsMedStatus;');
    });

    test('T5: 双药均在分支包含「双药均在」关键词', () => {
        const blk = getSsBlock();
        const medIdx = blk.indexOf('witchSsMedStatus;');
        const medBlock = blk.slice(medIdx, medIdx + 1200);
        expect(medBlock).toContain('双药均在');
    });

    test('T6: 仅解药在分支包含「解药在手/毒药已用」', () => {
        const blk = getSsBlock();
        const medIdx = blk.indexOf('witchSsMedStatus;');
        const medBlock = blk.slice(medIdx, medIdx + 1200);
        expect(medBlock).toContain('解药在手/毒药已用');
    });

    test('T7: 仅毒药在分支包含「毒药在手/解药已用」', () => {
        const blk = getSsBlock();
        const medIdx = blk.indexOf('witchSsMedStatus;');
        const medBlock = blk.slice(medIdx, medIdx + 1200);
        expect(medBlock).toContain('毒药在手/解药已用');
    });

    test('T8: 双药已用分支包含「双药已用」', () => {
        const blk = getSsBlock();
        const medIdx = blk.indexOf('witchSsMedStatus;');
        const medBlock = blk.slice(medIdx, medIdx + 1200);
        expect(medBlock).toContain('双药已用');
    });
});

// ─── T9-T11: witchSsHint 已跳 vs 未公开 分支 ─────────────────────────────────

describe('R112: witchSsHint 已跳身份 vs 未公开 分支', () => {
    test('T9: witchSsHint 声明存在（const witchSsHint = hasRevealedIdentity 三元）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const witchSsHint = hasRevealedIdentity');
    });

    test('T10: witchSsHint 已跳身份分支包含「已跳身份」标签', () => {
        const blk = getSsBlock();
        const hintIdx = blk.indexOf('const witchSsHint = hasRevealedIdentity');
        const hintBlock = blk.slice(hintIdx, hintIdx + 800);
        expect(hintBlock).toContain('已跳身份');
    });

    test('T11: witchSsHint 未公开分支包含「身份未公开」标签', () => {
        const blk = getSsBlock();
        const hintIdx = blk.indexOf('const witchSsHint = hasRevealedIdentity');
        const hintBlock = blk.slice(hintIdx, hintIdx + 1000);
        expect(hintBlock).toContain('身份未公开');
    });
});

// ─── T12-T14: guardSsHint 已公开 vs 未公开 分支 ──────────────────────────────

describe('R112: guardSsHint 已公开身份 vs 未公开 分支', () => {
    test('T12: guardSsHint 声明存在（const guardSsHint = hasRevealedIdentity 三元）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const guardSsHint = hasRevealedIdentity');
    });

    test('T13: guardSsHint 已公开分支包含「守护记录」信任锚点关键词', () => {
        const blk = getSsBlock();
        const gIdx = blk.indexOf('const guardSsHint = hasRevealedIdentity');
        const gBlock = blk.slice(gIdx, gIdx + 600);
        expect(gBlock).toContain('守护记录');
    });

    test('T14: guardSsHint 未公开分支包含「身份未公开」标签', () => {
        const blk = getSsBlock();
        const gIdx = blk.indexOf('const guardSsHint = hasRevealedIdentity');
        const gBlock = blk.slice(gIdx, gIdx + 900);
        expect(gBlock).toContain('身份未公开');
    });
});

// ─── T15-T16: ssHint 链 女巫/守卫 分支插入 ───────────────────────────────────

describe('R112: ssHint 链中 女巫/守卫 分支插入正确', () => {
    test("T15: ssHint 链中 playerRole === '女巫' ? witchSsHint 存在", () => {
        const blk = getSsBlock();
        expect(blk).toContain("playerRole === '女巫'");
        expect(blk).toContain('witchSsHint');
    });

    test("T16: ssHint 链中 playerRole === '守卫' ? guardSsHint 存在", () => {
        const blk = getSsBlock();
        expect(blk).toContain("playerRole === '守卫'");
        expect(blk).toContain('guardSsHint');
    });
});

// ─── T17: 白熊效应合规（第 33 次验证）────────────────────────────────────────

describe('R112: 白熊效应合规（witchSsMedStatus 4路径推断内容）', () => {
    test('T17: witchSsMedStatus 变量块 4路径推断内容为正向描述（无负向游戏策略禁词）', () => {
        const blk = getSsBlock();
        const medStart = blk.indexOf('let witchSsMedStatus;');
        const medEnd = blk.indexOf('const witchSsHint = hasRevealedIdentity', medStart);
        const medBlock = blk.slice(medStart, medEnd);
        // 推断内容应为正向描述，不应出现策略层面的禁词（自曝/禁止/绝不能）
        expect(medBlock).not.toContain('自曝');
        expect(medBlock).not.toContain('禁止');
        expect(medBlock).not.toContain('绝不能');
        expect(medBlock).not.toContain('千万别');
    });
});

// ─── T18-T20: 回归测试 ────────────────────────────────────────────────────────

describe('R112: 回归测试 - 已有角色分支完整保留', () => {
    test('T18: 骑士分支仍存在（knightSsHint）', () => {
        const blk = getSsBlock();
        expect(blk).toContain("playerRole === '骑士'");
        expect(blk).toContain('knightSsHint');
    });

    test('T19: 通用 fallback 仍存在（你是好人（${playerRole}））', () => {
        const blk = getSsBlock();
        expect(blk).toContain('你是好人（${playerRole}）');
    });

    test('T20: SHERIFF_SPEECH 输出 JSON schema 未变（speech + thought）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('"speech":"竞选发言（必须有具体内容）"');
        expect(blk).toContain('"thought":"真实竞选考量（含博弈思路）"');
    });
});
