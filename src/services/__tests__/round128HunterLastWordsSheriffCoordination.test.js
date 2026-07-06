/**
 * Round 128: 猎人 LAST_WORDS 专属分支 — identity_table 枪击锚点 + 警长协同提示
 *
 * 问题（R127 遗留）：
 *   猎人 LAST_WORDS 使用通用文本，缺少：
 *   1. identity_table 读取指引（其他神职均有角色专属数据注入）
 *   2. 警长协同提示（hasPoliceFlow 时，枪与徽应各自指向不同目标）
 *
 * 优化（R128）：
 *   1. 猎人分支添加 identity_table 阅读指引（confidence 最高 + suspect 为"狼人"）
 *   2. 添加 hunterIsSheriff 条件检测（hasPoliceFlow && isSheriff）
 *   3. 添加 hunterBadgeHint 模板变量，触发条件：猎人兼任警长时在遗言中声明传徽意向
 *   4. 协同约束：枪击目标与传徽目标应不同（R127 双输出协同原则延伸至 LAST_WORDS）
 *
 * 博弈论依据：
 *   Wang 2025 (arxiv:2408.17177) — 结构化私有信息注入显著提升决策精准度
 *   R127 猎人 BADGE_PASS 设计原则：枪×徽协同（两张牌互补，勿合一）
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS: {');
const LW_WINDOW = 5500;
const getLwBlock = () => src.slice(lwStart, lwStart + LW_WINDOW);

// 定位猎人分支（在 lwRoleHint 链内）
const lwBlock = getLwBlock();
const hunterBranchStart = lwBlock.indexOf("playerRole === '猎人'");

// ─── T1-T2: hunterIsSheriff 声明 ─────────────────────────────────────────────

describe('R128: hunterIsSheriff 条件变量', () => {
    test('T1: hunterIsSheriff 声明存在（LAST_WORDS 猎人分支内）', () => {
        expect(hunterBranchStart).toBeGreaterThan(0);
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('hunterIsSheriff');
    });

    test('T2: hunterIsSheriff 使用 hasPoliceFlow && isSheriff 条件', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('hasPoliceFlow');
        expect(hunterBlock).toContain('isSheriff');
        // 应从 currentPlayer 读取（不是从 gameState.sheriff）
        expect(hunterBlock).toContain('currentPlayer?.isSheriff');
    });
});

// ─── T3-T5: hunterBadgeHint 协同提示 ─────────────────────────────────────────

describe('R128: hunterBadgeHint 警长协同提示', () => {
    test('T3: hunterBadgeHint 条件变量存在', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('hunterBadgeHint');
    });

    test('T4: hunterBadgeHint 包含 R127 枪×徽协同原则文本', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('枪与徽各自指向不同目标');
    });

    test('T5: hunterBadgeHint 包含"传徽意向"引导（遗言中声明）', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('传徽意向');
    });
});

// ─── T6-T8: lwRoleHint 赋值 — identity_table 枪击锚点 ────────────────────────

describe('R128: 猎人 lwRoleHint identity_table 阅读指引', () => {
    test('T6: lwRoleHint 包含身份推理表阅读指引', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('身份推理表');
    });

    test('T7: lwRoleHint 包含 confidence 最高 + suspect 为"狼人" 指引', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('confidence 最高');
        expect(hunterBlock).toContain('狼人');
    });

    test('T8: lwRoleHint 使用模板字符串并插值 ${hunterBadgeHint}', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('${hunterBadgeHint}');
    });
});

// ─── T9: 白熊效应合规 ────────────────────────────────────────────────────────

describe('R128: 白熊效应合规（R121-C 铁律）', () => {
    test('T9: 猎人新增代码块无负向禁令词汇', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).not.toContain('不要');
        expect(hunterBlock).not.toContain('禁止');
        expect(hunterBlock).not.toContain('绝不能');
        expect(hunterBlock).not.toContain('千万别');
    });
});

// ─── T10-T12: LW_WINDOW 窗口验证 ─────────────────────────────────────────────

describe('R128: LW_WINDOW 窗口边界验证', () => {
    test('T10: LW block size ≤ 5500（LW_WINDOW 余量充足）', () => {
        const lwEnd = src.indexOf('case PROMPT_ACTIONS.SUMMARIZE_CONTENT:', lwStart);
        const blockSize = lwEnd - lwStart;
        expect(blockSize).toBeLessThanOrEqual(5500);
    });

    test('T11: "80字以内" 仍在 LW_WINDOW 内（回归防止溢出）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('80字以内');
    });

    test('T12: 遗言 JSON schema 仍在 LW_WINDOW 内（speech + thought）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('"speech":"遗言内容"');
        expect(blk).toContain('"thought":"你的真实想法"');
    });
});

// ─── T13: 回归 - hasPoliceFlow 变量在 LAST_WORDS 块内已定义 ──────────────────

describe('R128: 回归 — hasPoliceFlow 已在 LAST_WORDS 块中定义', () => {
    test('T13: hasPoliceFlow 在 lwRoleHint 链之前定义（依赖变量可用）', () => {
        const blk = getLwBlock();
        const hasPoliceFlowIdx = blk.indexOf('const hasPoliceFlow = isLargeGame(');
        const lwRoleHintIdx = blk.indexOf('let lwRoleHint;');
        expect(hasPoliceFlowIdx).toBeGreaterThan(0);
        expect(lwRoleHintIdx).toBeGreaterThan(0);
        expect(hasPoliceFlowIdx).toBeLessThan(lwRoleHintIdx);
    });
});

// ─── T14: 与 R127 一致性 — hunterBadgeHint 引导文本包含"协同价值" ─────────────

describe('R128: 与 R127 BADGE_PASS 设计一致性验证', () => {
    test('T14: hunterBadgeHint 包含"两张牌发挥最大协同价值"（与 R127 原则对齐）', () => {
        const hunterBlock = lwBlock.slice(hunterBranchStart, hunterBranchStart + 800);
        expect(hunterBlock).toContain('两张牌发挥最大协同价值');
    });
});
