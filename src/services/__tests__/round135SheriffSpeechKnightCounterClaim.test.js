/**
 * Round 135: SHERIFF_SPEECH 骑士竞选对跳检测（ssKnightCounterClaimants）
 *
 * 问题：与 R134 预言家对跳检测对称——骑士在竞选阶段缺少对抗"悍跳骑士"的结构化感知。
 *   若狼人或其他玩家已在竞选中声称是骑士，真骑士发言时无任何对跳引导。
 *
 * 修复（R135）：
 *   aiPrompts.js SHERIFF_SPEECH block：
 *     - ssKnightCounterClaimants（骑士门控）：过滤 claimHistory 的 jump_knight 排除自身
 *     - knightSsCounterHint（有对跳时注入底气框架提示）
 *     - knightSsHint 分支包裹为 `${knightSsHint}${knightSsCounterHint}` 模板字面量
 *
 * 设计依据：
 *   - 与 R134 seer 检测完全对称（ssCounterClaimants → ssKnightCounterClaimants）
 *   - 与 R125 DAY_SPEECH 骑士悍跳检测（counterClaimants for jump_knight）对称
 *   - 白熊效应合规：反制方向为正向底气框架，非禁词
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const ssStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
const SS_WINDOW = 8500;
const getSsBlock = () => src.slice(ssStart, ssStart + SS_WINDOW);

// ─── T1-T3: ssKnightCounterClaimants 变量声明与门控 ─────────────────────────────

describe('R135: ssKnightCounterClaimants — 骑士竞选对跳检测变量', () => {
    test('T1: ssKnightCounterClaimants 变量声明存在（骑士门控）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssKnightCounterClaimants = playerRole === \'骑士\'');
    });

    test('T2: ssKnightCounterClaimants 过滤 jump_knight 类型声明', () => {
        const blk = getSsBlock();
        expect(blk).toContain('.filter(c => c.type === \'jump_knight\' && c.playerId !== currentPlayer?.id)');
    });

    test('T3: ssKnightCounterClaimants 映射为 playerId 数组', () => {
        const blk = getSsBlock();
        const ccIdx = blk.indexOf('const ssKnightCounterClaimants =');
        const ccSlice = blk.slice(ccIdx, ccIdx + 300);
        expect(ccSlice).toContain('.map(c => c.playerId)');
    });
});

// ─── T4-T6: knightSsCounterHint 条件注入 ────────────────────────────────────────

describe('R135: knightSsCounterHint — 对跳情境条件化提示', () => {
    test('T4: knightSsCounterHint 变量声明存在', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const knightSsCounterHint = ssKnightCounterClaimants.length > 0');
    });

    test('T5: knightSsCounterHint 空时返回空字符串（零副作用）', () => {
        const blk = getSsBlock();
        const hIdx = blk.indexOf('const knightSsCounterHint =');
        const hSlice = blk.slice(hIdx, hIdx + 400);
        expect(hSlice).toContain(': \'\'');
    });

    test('T6: knightSsCounterHint 有对跳时包含底气框架（正向描述，无负向禁词）', () => {
        const blk = getSsBlock();
        const hIdx = blk.indexOf('const knightSsCounterHint =');
        const hSlice = blk.slice(hIdx, hIdx + 400);
        // 正向：底气压制 + 锚点可选
        expect(hSlice).toContain('声称是骑士');
        expect(hSlice).toContain('无需争论身份真假');
        // 白熊效应合规：无负向禁词
        expect(hSlice).not.toContain('绝不能');
        expect(hSlice).not.toContain('禁止');
        expect(hSlice).not.toContain('千万别');
    });
});

// ─── T7-T8: ssHint 骑士分支追加 knightSsCounterHint ──────────────────────────────

describe('R135: ssHint 骑士分支 — 追加 knightSsCounterHint', () => {
    test('T7: ssHint 骑士分支使用模板字面量包裹 knightSsHint + knightSsCounterHint', () => {
        const blk = getSsBlock();
        expect(blk).toContain('`${knightSsHint}${knightSsCounterHint}`');
    });

    test('T8: knightSsCounterHint 在 knightSsHint 变量声明之后、ssHint 赋值之前声明（顺序正确）', () => {
        const blk = getSsBlock();
        const knightHintIdx = blk.indexOf('const knightSsCounterHint =');
        const ssHintIdx = blk.indexOf('const ssHint = playerRole');
        expect(knightHintIdx).toBeGreaterThan(0);
        expect(ssHintIdx).toBeGreaterThan(knightHintIdx);
    });
});

// ─── T9: SS_WINDOW 充裕性 ─────────────────────────────────────────────────────────

describe('R135: SS_WINDOW 充裕性验证（升级至 8500）', () => {
    test('T9: SS_WINDOW 余量充足（block size < SS_WINDOW - 500）', () => {
        const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:', ssStart);
        const blockSize = svStart - ssStart;
        expect(blockSize).toBeLessThan(SS_WINDOW - 500);
    });
});

// ─── T10: 白熊效应合规审计 ────────────────────────────────────────────────────────

describe('R135: 白熊效应合规 — ssKnightCounterClaimants + knightSsCounterHint 全正向', () => {
    test('T10: 新增变量块无负向禁词', () => {
        const blk = getSsBlock();
        const startIdx = blk.indexOf('const ssKnightCounterClaimants =');
        const endIdx = blk.indexOf('const ssHint = playerRole', startIdx);
        const section = blk.slice(startIdx, endIdx);
        expect(section).not.toContain('绝不能');
        expect(section).not.toContain('千万别');
        expect(section).not.toContain('自曝');
    });
});

// ─── T11: 回归测试 ────────────────────────────────────────────────────────────────

describe('R135: 回归测试 — R134 seer 对跳检测完整保留', () => {
    test('T11: ssCounterClaimants + seerSsCounterHint 仍然存在', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssCounterClaimants = playerRole === \'预言家\'');
        expect(blk).toContain('const seerSsCounterHint = ssCounterClaimants.length > 0');
        expect(blk).toContain('真实数据是唯一无法构造的信息差');
    });
});
