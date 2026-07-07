/**
 * Round 111: LAST_WORDS 遗言背景上下文增强
 *
 * 问题：当前 LAST_WORDS 提示词缺少：
 *   - 当前天次（AI 不知道自己在第几天死亡）
 *   - 先行出局玩家列表（无法给出有背景感的遗言）
 *   - 被投出时的票型摘要（无法识别哪些玩家是潜在对立面）
 *
 * 修复（R111）：
 *   1. 新增 lwDay（当前天次），lwContextBlock（遗言背景行）
 *   2. 先行出局玩家摘要（排除自身，格式 X号(DY夜/投票)）
 *   3. 被投出时附加"投你出局：Z号"，帮助识别对立阵营
 *   4. return 模板首行由 "你已死亡（${cause}）" 改为 "你已死亡（D${lwDay}，${cause}）"
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177) - 结构化历史上下文显著提升 AI 决策精准度。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const lwStart = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS: {');
const LW_WINDOW = 9000; // R133: block 6640→LW_WINDOW=9000（余量从360→2360）
const getLwBlock = () => src.slice(lwStart, lwStart + LW_WINDOW);

// ─── T1-T3: lwDay 声明 ────────────────────────────────────────────────────────

describe('R111: lwDay 声明', () => {
    test('T1: LAST_WORDS case 块存在（锚点校验）', () => {
        expect(lwStart).toBeGreaterThan(0);
    });

    test('T2: lwDay 声明存在（gameState?.dayCount ?? 1 安全读取）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const lwDay = gameState?.dayCount ?? 1;');
    });

    test('T3: lwDay 在 lwRoleHint 之前声明', () => {
        const blk = getLwBlock();
        const lwDayIdx = blk.indexOf('const lwDay = gameState?.dayCount ?? 1;');
        const lwRoleHintIdx = blk.indexOf('let lwRoleHint;');
        expect(lwDayIdx).toBeGreaterThan(0);
        expect(lwRoleHintIdx).toBeGreaterThan(0);
        expect(lwDayIdx).toBeLessThan(lwRoleHintIdx);
    });
});

// ─── T4-T6: priorDeaths / lwDeathsText ───────────────────────────────────────

describe('R111: priorDeaths 先行出局玩家列表', () => {
    test('T4: priorDeaths 声明存在（过滤 deathHistory）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const priorDeaths = (gameState?.deathHistory || [])');
    });

    test('T5: 过滤条件排除当前死亡玩家（d.playerId !== currentPlayer?.id）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('.filter(d => d.playerId !== currentPlayer?.id)');
    });

    test('T6: lwDeathsText 包含有死亡 / 无死亡两路三元表达式', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const lwDeathsText = priorDeaths.length > 0');
        expect(blk).toContain('（无先行出局玩家）');
    });
});

// ─── T7-T10: isVotedOut / lwVotedByText ──────────────────────────────────────

describe('R111: 被投出票型摘要', () => {
    test('T7: isVotedOut 条件声明（cause 含"投"字）', () => {
        const blk = getLwBlock();
        expect(blk).toContain("const isVotedOut = (cause || '').includes('投');");
    });

    test('T8: lwVotedByText 初始化为空字符串', () => {
        const blk = getLwBlock();
        expect(blk).toContain("let lwVotedByText = '';");
    });

    test('T9: if (isVotedOut) 块内读取 voteHistory 最后一轮', () => {
        const blk = getLwBlock();
        const ifStart = blk.indexOf('if (isVotedOut) {');
        expect(ifStart).toBeGreaterThan(0);
        const ifBlock = blk.slice(ifStart, ifStart + 400);
        expect(ifBlock).toContain('const lastVoteRound = (gameState?.voteHistory || []).slice(-1)[0];');
    });

    test('T10: votesAgainstMe 用 v.to === currentPlayer?.id 过滤（R96 规范：from/to 键）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('v.to === currentPlayer?.id');
        // 不能用 targetId（R96 教训：voteHistory 已映射为 from/to 格式）
        const ifStart = blk.indexOf('if (isVotedOut) {');
        const ifBlock = blk.slice(ifStart, ifStart + 400);
        expect(ifBlock).not.toContain('v.targetId');
    });
});

// ─── T11-T13: lwContextBlock 组装 ────────────────────────────────────────────

describe('R111: lwContextBlock 背景行组装', () => {
    test('T11: lwContextBlock 声明存在', () => {
        const blk = getLwBlock();
        expect(blk).toContain('const lwContextBlock = ');
    });

    test('T12: lwContextBlock 包含 D${lwDay} 出局背景标签', () => {
        const blk = getLwBlock();
        expect(blk).toContain('D${lwDay}出局背景');
    });

    test('T13: lwContextBlock 包含先行出局列表插值', () => {
        const blk = getLwBlock();
        expect(blk).toContain('先行出局：${lwDeathsText}');
    });
});

// ─── T14-T16: return 模板注入位置 ────────────────────────────────────────────

describe('R111: return 模板 - lwContextBlock 注入位置', () => {
    const blk = getLwBlock();
    const retStart = blk.lastIndexOf('return `你已死亡');

    test('T14: return 模板存在', () => {
        expect(retStart).toBeGreaterThan(0);
    });

    test('T15: return 首行包含 D${lwDay} 天次标注', () => {
        const retBlock = blk.slice(retStart, retStart + 200);
        expect(retBlock).toContain('D${lwDay}');
        expect(retBlock).toContain('${cause}');
    });

    test('T16: ${lwContextBlock} 在 return 中位于 ${lwRoleHint} 之前', () => {
        const retBlock = blk.slice(retStart, retStart + 500);
        const ctxIdx = retBlock.indexOf('${lwContextBlock}');
        const hintIdx = retBlock.indexOf('${lwRoleHint}');
        expect(ctxIdx).toBeGreaterThan(0);
        expect(hintIdx).toBeGreaterThan(0);
        expect(ctxIdx).toBeLessThan(hintIdx);
    });
});

// ─── T17: 白熊效应合规（第 32 次验证）───────────────────────────────────────

describe('R111: 白熊效应合规（新增代码段）', () => {
    test('T17: R111 新增变量块无负向禁词（自曝/禁止/绝不能）', () => {
        const blk = getLwBlock();
        // 新增变量块范围 (lwDay 到 lwContextBlock)
        const r111Start = blk.indexOf('const lwDay = gameState?.dayCount ?? 1;');
        const r111End = blk.indexOf('const lwContextBlock = ') + 300;
        const r111Block = blk.slice(r111Start, r111End);
        expect(r111Block).not.toContain('自曝');
        expect(r111Block).not.toContain('禁止');
        expect(r111Block).not.toContain('绝不能');
        expect(r111Block).not.toContain('不要');
        expect(r111Block).not.toContain('千万别');
    });
});

// ─── T18-T20: 回归测试 - 已有角色分支未破坏 ─────────────────────────────────

describe('R111: 回归测试 - 已有角色分支完整保留', () => {
    test('T18: 狼人遗言分支仍包含 confidence 最高（威胁最大）指导', () => {
        const blk = getLwBlock();
        const wolfIdx = blk.indexOf("playerRole === '狼人'");
        const wolfBlock = blk.slice(wolfIdx, wolfIdx + 600);
        expect(wolfBlock).toContain('confidence 最高（威胁最大）');
    });

    test('T19: 遗言输出 JSON schema 未变（speech + thought）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('"speech":"遗言内容"');
        expect(blk).toContain('"thought":"你的真实想法"');
    });

    test('T20: 80字上限要求仍存在（未破坏字数限制）', () => {
        const blk = getLwBlock();
        expect(blk).toContain('80字以内');
    });
});
