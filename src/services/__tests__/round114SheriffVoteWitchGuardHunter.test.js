/**
 * Round 114: 女巫 + 守卫 + 猎人 SHERIFF_VOTE 专属提示词
 *
 * 问题：SHERIFF_VOTE 中 女巫/守卫/猎人 合并在同一"神职策略"分支，
 *   未利用角色私有信息：
 *   - 女巫：witchHistory.savedIds（银水 = 亲手救过的候选好人）是最高可信度投票锚点
 *   - 守卫：guardHistory（守护频次）是不可伪造的候选人信任排序依据
 *   - 猎人：枪 + 警徽连锁效应是独特的两连打击价值框架
 *
 * 修复（R114）：
 *   1. 女巫：svWitchSavedAlive（银水候选人过滤）→ svWitchHint
 *   2. 守卫：svGuardCounts 频次分析 → svTopGuarded → svGuardHint
 *   3. 猎人：枪+警徽连锁框架 → svHunterHint
 *   4. svRoleHint：5路径（狼/预言家/女巫/守卫/猎人）独立分支
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) — 角色私有信息注入显著提升 AI 决策精准度；
 *   同 R112 SHERIFF_SPEECH / R113 SHERIFF_BADGE_PASS 设计模式。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:');
const SV_WINDOW = 7500; // R116 后 svRoleHint 移至偏移 6073，原 5400 截断 T19/T20；更新至 7500（block=7296）
const getSvBlock = () => src.slice(svStart, svStart + SV_WINDOW);

// ─── T1: 锚点校验 ────────────────────────────────────────────────────────────

describe('R114: SHERIFF_VOTE case 块存在', () => {
    test('T1: SHERIFF_VOTE case 块存在（锚点校验）', () => {
        expect(svStart).toBeGreaterThan(0);
    });
});

// ─── T2-T6: 女巫分支（svWitchHint）────────────────────────────────────────────

describe('R114: 女巫 SHERIFF_VOTE 银水候选人路径', () => {
    test('T2: svWitchHistory 变量声明存在（gameState.witchHistory 安全读取）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svWitchHistory = gameState.witchHistory');
    });

    test('T3: svWitchSavedAlive 过滤声明存在（savedIds 按 svCandidateSet 过滤）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svWitchSavedAlive =');
        expect(blk).toContain('svCandidateSet.has(id)');
    });

    test("T4: svWitchHint 声明为 let 且女巫判断分支存在（playerRole === '女巫'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain('let svWitchHint = \'\';');
        expect(blk).toContain("playerRole === '女巫'");
    });

    test('T5: svWitchHint 内容包含「银水」和「亲手救过」关键词（正向信任锚点）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('银水');
        expect(blk).toContain('亲手救过');
    });

    test('T6: svWitchHint 包含「保命」和「保药」关键词（女巫自保策略框架）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('保命');
        expect(blk).toContain('保药');
    });
});

// ─── T7-T11: 守卫分支（svGuardHint）──────────────────────────────────────────

describe('R114: 守卫 SHERIFF_VOTE 守护频次候选人路径', () => {
    test('T7: svGuardHistory 变量声明存在（gameState.guardHistory 安全读取）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svGuardHistory = gameState.guardHistory');
    });

    test('T8: svGuardCounts 频次统计声明存在', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svGuardCounts = {};');
    });

    test('T9: svTopGuarded Top-2 排序声明存在（守护频次最高候选人）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('const svTopGuarded = Object.entries(svGuardCounts)');
        expect(blk).toContain('.slice(0, 2)');
    });

    test("T10: svGuardHint 声明为 let 且守卫判断分支存在（playerRole === '守卫'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain('let svGuardHint = \'\';');
        expect(blk).toContain("playerRole === '守卫'");
    });

    test('T11: svGuardHint 内容包含「守护」和「暴露」关键词（守卫自保框架）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('守护频次');
        expect(blk).toContain('暴露');
    });
});

// ─── T12-T14: 猎人分支（svHunterHint）────────────────────────────────────────

describe('R114: 猎人 SHERIFF_VOTE 枪+警徽连锁框架', () => {
    test("T12: svHunterHint 声明为 let 且猎人判断分支存在（playerRole === '猎人'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain('let svHunterHint = \'\';');
        expect(blk).toContain("playerRole === '猎人'");
    });

    test('T13: svHunterHint 内容包含「枪」和「连锁」关键词（两连打击框架）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('枪连锁');
    });

    test('T14: svHunterHint 内容包含「警徽」关键词（警徽+枪连锁逻辑）', () => {
        const blk = getSvBlock();
        expect(blk).toContain('警徽传递');
    });
});

// ─── T15-T17: svRoleHint 5路径独立分支 ──────────────────────────────────────

describe('R114: svRoleHint 5路径独立分支（狼/预言家/女巫/守卫/猎人）', () => {
    test("T15: svRoleHint 包含女巫独立分支（playerRole === '女巫'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '女巫'");
        expect(blk).toContain('svWitchHint');
    });

    test("T16: svRoleHint 包含守卫独立分支（playerRole === '守卫'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '守卫'");
        expect(blk).toContain('svGuardHint');
    });

    test("T17: svRoleHint 包含猎人独立分支（playerRole === '猎人'）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '猎人'");
        expect(blk).toContain('svHunterHint');
    });
});

// ─── T18: 白熊效应（第 35 次验证）──────────────────────────────────────────────

describe('R114: 白熊效应验证（第 35 次）— svWitchHint + svGuardHint + svHunterHint 无负向禁词', () => {
    test('T18: 女巫/守卫/猎人 hint 块无负向游戏策略禁词（全正向描述）', () => {
        const blk = getSvBlock();
        // 提取三个 hint 块（从 let svWitchHint 到 const svRoleHint）
        const hintStart = blk.indexOf('let svWitchHint');
        const hintEnd = blk.indexOf('const svRoleHint');
        const hintBlock = hintStart >= 0 && hintEnd > hintStart
            ? blk.slice(hintStart, hintEnd)
            : blk;
        // 白熊效应：禁止出现"自曝/承认/千万别/绝对不要/绝不能"等负向禁令
        const negativeKeywords = ['自曝', '承认是狼', '千万别', '绝对不要', '绝不能'];
        negativeKeywords.forEach(kw => {
            expect(hintBlock).not.toContain(kw);
        });
    });
});

// ─── T19-T20: 回归验证 ───────────────────────────────────────────────────────

describe('R114: 回归验证 — 现有分支保留', () => {
    test("T19: 狼人策略分支保留（playerRole === '狼人' → 队友优先）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '狼人'");
        expect(blk).toContain('狼队友');
    });

    test("T20: 预言家策略分支保留（playerRole === '预言家' → 报验杠杆）", () => {
        const blk = getSvBlock();
        expect(blk).toContain("playerRole === '预言家'");
        expect(blk).toContain('1.5票杠杆');
    });
});
