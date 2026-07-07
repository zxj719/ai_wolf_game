/**
 * Round 54: 读写闭环扩展 — 村民 DAY_SPEECH Step 0 + LAST_WORDS identity_table 读取
 *
 * 问题：village 的 DAY_SPEECH 思维链无 Step 0（读取历史推理积累），
 *       LAST_WORDS 的好人/狼人分支也没有"先读 identity_table"指导。
 *       这是 R38-R41 修复所有 NIGHT_* case 读写闭环之后遗留的日间对称缺口。
 *
 * 修复：
 * 1. DAY_SPEECH '村民' 思维链：Step0 = 读取历史推理积累（D2+适用）
 * 2. LAST_WORDS 好人 fallback：先查身份推理表 confidence 最高 → 作为遗言核心
 * 3. LAST_WORDS 狼人分支：先查身份推理表 confidence 最高（威胁最大）→ 遗言"怀疑"目标
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');

// ─── Section 1: DAY_SPEECH 村民 Step 0 ─────────────────────────────────────

// 定位村民 DAY_SPEECH 段落（R67 改为函数体语法，使用函数体标记定位；R56 教训：函数体形式需用非箭头标记）
const villagerDaySpeechMarker = "'村民': (ctx, params) => {";
const villagerStart = src.indexOf(villagerDaySpeechMarker);

describe('R54: DAY_SPEECH 村民 思维链 Step 0（读写闭环）', () => {
    test('T1: 村民 DAY_SPEECH 模板存在', () => {
        expect(villagerStart).toBeGreaterThan(0);
    });

    test('T2: 村民段落包含 Step0', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('Step0');
    });

    test('T3: Step0 包含"历史推理积累"关键词', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('历史推理积累');
    });

    test('T4: Step0 包含"身份推理表"关键词（指向 identity_table）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('身份推理表');
    });

    test('T5: Step0 包含 confidence 阈值指导（≥ 60）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('≥ 60');
    });

    test('T6: Step0 包含首日免责说明（首日无历史可跳过）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('首日');
    });

    test('T7: Step0 在 Step1 之前（正确顺序）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        const step0Pos = segment.indexOf('Step0');
        const step1Pos = segment.indexOf('Step1');
        expect(step0Pos).toBeGreaterThan(0);
        expect(step1Pos).toBeGreaterThan(0);
        expect(step0Pos).toBeLessThan(step1Pos);
    });

    test('T8: Step1-Step4 均存在（未破坏原思维链结构）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('Step1');
        expect(segment).toContain('Step2');
        expect(segment).toContain('Step3');
        expect(segment).toContain('Step4');
    });

    test('T9: identity_table 写指导仍存在（追加示例未被删除）', () => {
        const segment = src.slice(villagerStart, villagerStart + 5500);
        expect(segment).toContain('追加示例');
    });
});

// ─── Section 2: LAST_WORDS 好人/村民 fallback Step 0 ─────────────────────────

// 定位 LAST_WORDS case 块（case 带花括号形式，R11/R12 教训）
const lastWordsCaseMarker = "case PROMPT_ACTIONS.LAST_WORDS: {";
const lwStart = src.indexOf(lastWordsCaseMarker);

describe('R54: LAST_WORDS 好人 fallback identity_table 读取', () => {
    test('T10: LAST_WORDS case 块存在', () => {
        expect(lwStart).toBeGreaterThan(0);
    });

    // 在 LAST_WORDS 块内搜索好人 fallback（else 分支）
    test('T11: 好人 fallback 包含"身份推理表"指导', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        // else 分支 lwRoleHint 赋值中包含"身份推理表"
        expect(segment).toContain('身份推理表');
    });

    test('T12: 好人 fallback 包含 confidence 最高的指导', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('confidence 最高');
    });

    test('T13: 好人 fallback 包含"整局积累"或"积累"相关词', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('整局积累');
    });

    test('T14: 好人 fallback 仍保留"帮助场上好人继续追查"', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('帮助场上好人继续追查');
    });
});

// ─── Section 3: LAST_WORDS 狼人分支 identity_table 读取 ─────────────────────

describe('R54: LAST_WORDS 狼人分支 identity_table 读取', () => {
    test('T15: 狼人 lwRoleHint 包含"身份推理表"', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('身份推理表');
    });

    test('T16: 狼人分支包含 confidence 最高（威胁最大）指导', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        // 寻找狼人分支内的 confidence 词
        const wolfBranchStart = segment.indexOf("playerRole === '狼人'");
        expect(wolfBranchStart).toBeGreaterThan(0);
        // 狼人分支内包含 confidence 字样
        const wolfSegment = segment.slice(wolfBranchStart, wolfBranchStart + 600);
        expect(wolfSegment).toContain('confidence');
    });

    test('T17: 狼人分支保留"普通好人的视角"（不破坏原有策略）', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('普通好人的视角');
    });

    test('T18: 狼人分支不包含"高优先刀口"字面量（避免白熊效应 R30 规则）', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        const wolfBranchStart = segment.indexOf("playerRole === '狼人'");
        expect(wolfBranchStart).toBeGreaterThan(0);
        const wolfSegment = segment.slice(wolfBranchStart, wolfBranchStart + 600);
        expect(wolfSegment).not.toContain('高优先刀口');
    });

    test('T19: 狼人分支包含"遗言"语义锚（完整遗言语境）', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        const wolfBranchStart = segment.indexOf("playerRole === '狼人'");
        const wolfSegment = segment.slice(wolfBranchStart, wolfBranchStart + 600);
        expect(wolfSegment).toContain('遗言');
    });
});

// ─── Section 4: 回归测试 ──────────────────────────────────────────────────────

describe('R54: 回归测试（预言家/女巫/守卫等分支未受影响）', () => {
    test('T20: 预言家 LAST_WORDS 分支仍包含按夜次列出查验结果的指导', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('按夜次列出全部查验结果');
    });

    test('T21: 女巫 LAST_WORDS 分支仍包含药品状态（hasSave/hasPoison）', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('hasSave');
        expect(segment).toContain('hasPoison');
    });

    test('T22: 骑士 LAST_WORDS 分支仍包含 hasUsedDuel 判断', () => {
        const segment = src.slice(lwStart, lwStart + 9000);
        expect(segment).toContain('hasUsedDuel');
    });

    test('T23: 村民 DAY_SPEECH identity_table 填写指导中的追加示例未被删除', () => {
        const villagerSeg = src.slice(villagerStart, villagerStart + 5500);
        expect(villagerSeg).toContain('N1发言带节奏');
    });

    test('T24: 村民 DAY_SPEECH 输出 JSON schema 未变（含 identity_table）', () => {
        // 窗口已从 4000 升至 5000（R88），再从 5000 升至 5500（R100 新增 isTripleConsecutivePeacefulVillager + tripleHint 变量块，identity_table 移至 ~4913 处）
        const villagerSeg = src.slice(villagerStart, villagerStart + 5500);
        expect(villagerSeg).toContain('"identity_table"');
        expect(villagerSeg).toContain('"voteIntention"');
    });
});
