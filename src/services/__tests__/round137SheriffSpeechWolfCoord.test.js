/**
 * Round 137: SHERIFF_SPEECH 多狼竞选协调——避免两只狼悍跳同一身份
 *
 * 问题：两只狼人同时上警竞选时，可能各自独立决策都选择悍跳预言家（路径①）
 *   或悍跳骑士（路径②），产生高度内聚的身份信号，好人能通过
 *   "两个发言结构相同"识别身份关联，降低狼方信息混淆效果。
 *
 * 修复（R137）：
 *   在 wolf ssHint 中检测其他狼队友已有的声明（从 claimHistory 读取）：
 *   - ssOtherWolfCandidates：其他狼候选人 ID 列表（用 players 过滤角色）
 *   - ssWolfClaimedSeer：已悍跳预言家的狼队友
 *   - ssWolfClaimedKnight：已悍跳骑士的狼队友
 *   - ssWolfCoordHint：有队友已跳时，推荐走路径③（好人竞选）分工
 *   append 到 wolf ssHint ③ 路径末尾（空时零副作用）
 *
 * 设计依据：
 *   - Wang 2025 (arxiv:2408.17177)：角色分工策略——一狼建立身份信息框架，
 *     另一狼以不同角度参与，最大化信息混淆，最小化身份关联暴露风险
 *   - 与 R134/R135/R136 构建的 jump_seer/jump_knight claimHistory 读写闭环对称
 *   - ssOtherWolfCandidates 使用 playerRole === '狼人' 门控，零副作用（非狼人时 []）
 *
 * SS_WINDOW: 8500 → 9500（block 8894 > 8500；9500 余量 606 > 500 ✅）
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const ssStart = src.lastIndexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
const SS_WINDOW = 9500;
const getSsBlock = () => src.slice(ssStart, ssStart + SS_WINDOW);

// ─── T1-T2: ssOtherWolfCandidates 变量存在且逻辑正确 ─────────────────────────────

describe('R137: ssOtherWolfCandidates — 其他狼候选检测', () => {
    test('T1: ssOtherWolfCandidates 变量存在于 SS block', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssOtherWolfCandidates =');
    });

    test('T2: ssOtherWolfCandidates 用 playerRole 门控（非狼人时返回 []）', () => {
        const blk = getSsBlock();
        const varIdx = blk.indexOf('const ssOtherWolfCandidates =');
        const varSlice = blk.slice(varIdx, varIdx + 300);
        expect(varSlice).toContain('playerRole === \'狼人\'');
        expect(varSlice).toContain(': []');
    });
});

// ─── T3-T4: ssWolfClaimedSeer / ssWolfClaimedKnight 检测变量 ─────────────────────

describe('R137: ssWolfClaimedSeer / ssWolfClaimedKnight — 已声明身份检测', () => {
    test('T3: ssWolfClaimedSeer 检测 jump_seer 类型', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssWolfClaimedSeer =');
        const varIdx = blk.indexOf('const ssWolfClaimedSeer =');
        const varSlice = blk.slice(varIdx, varIdx + 200);
        expect(varSlice).toContain('jump_seer');
    });

    test('T4: ssWolfClaimedKnight 检测 jump_knight 类型', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssWolfClaimedKnight =');
        const varIdx = blk.indexOf('const ssWolfClaimedKnight =');
        const varSlice = blk.slice(varIdx, varIdx + 200);
        expect(varSlice).toContain('jump_knight');
    });
});

// ─── T5-T7: ssWolfCoordHint 变量及内容 ───────────────────────────────────────────

describe('R137: ssWolfCoordHint — 多狼分工建议注入', () => {
    test('T5: ssWolfCoordHint 变量存在于 SS block', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssWolfCoordHint =');
    });

    test('T6: ssWolfCoordHint 有队友时注入路径③建议', () => {
        const blk = getSsBlock();
        const varIdx = blk.indexOf('const ssWolfCoordHint =');
        const varSlice = blk.slice(varIdx, varIdx + 500);
        expect(varSlice).toContain('路径③');
        expect(varSlice).toContain('队友');
    });

    test('T7: ssWolfCoordHint 无多狼情况时为空字符串（零副作用 :\'\'）', () => {
        const blk = getSsBlock();
        const varIdx = blk.indexOf('const ssWolfCoordHint =');
        const varSlice = blk.slice(varIdx, varIdx + 500);
        expect(varSlice).toContain(': \'\'');
    });
});

// ─── T8: ssWolfCoordHint 追加到 wolf ssHint ③ 路径 ──────────────────────────────

describe('R137: ssWolfCoordHint 注入位置正确', () => {
    test('T8: ssWolfCoordHint 追加在 wolf ssHint ③ 路径（claims 留 [] 之后）', () => {
        const blk = getSsBlock();
        const coordIdx = blk.indexOf('${ssWolfCoordHint}');
        expect(coordIdx).toBeGreaterThan(0);
        // Must appear within the wolf ssHint section (after '③' and after 'claims 留 []')
        const thirdPathIdx = blk.indexOf('③ 若以好人身份竞选：');
        expect(coordIdx).toBeGreaterThan(thirdPathIdx);
        // Must appear before the next role check (猎人)
        const hunterIdx = blk.indexOf('playerRole === \'猎人\'');
        expect(coordIdx).toBeLessThan(hunterIdx);
    });
});

// ─── T9: SS_WINDOW 余量充足 ──────────────────────────────────────────────────────

describe('R137: SS_WINDOW 余量验证（升级至 9500）', () => {
    test('T9: SS block size < SS_WINDOW - 500（余量安全）', () => {
        const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:', ssStart);
        const blockSize = svStart - ssStart;
        expect(blockSize).toBeLessThan(SS_WINDOW - 500);
    });
});

// ─── T10: 白熊效应合规 ───────────────────────────────────────────────────────────

describe('R137: 白熊效应合规 — ssWolfCoordHint 全正向描述', () => {
    test('T10: ssWolfCoordHint 内容中无负向禁令词汇', () => {
        const blk = getSsBlock();
        const varIdx = blk.indexOf('const ssWolfCoordHint =');
        const varSlice = blk.slice(varIdx, varIdx + 500);
        expect(varSlice).not.toContain('绝不');
        expect(varSlice).not.toContain('千万别');
        expect(varSlice).not.toContain('自曝');
    });
});

// ─── T11: ssOtherWolfCandidates 排除当前玩家自身 ─────────────────────────────────

describe('R137: ssOtherWolfCandidates 精确过滤', () => {
    test('T11: ssOtherWolfCandidates 过滤排除 currentPlayer 自身 ID', () => {
        const blk = getSsBlock();
        const varIdx = blk.indexOf('const ssOtherWolfCandidates =');
        const varSlice = blk.slice(varIdx, varIdx + 300);
        // Must check against currentPlayer.id
        expect(varSlice).toContain('currentPlayer?.id');
        expect(varSlice).toContain('狼人');
    });
});

// ─── T12: 回归测试 ───────────────────────────────────────────────────────────────

describe('R137: 回归测试 — R134/R135/R136 功能完整保留', () => {
    test('T12: R134/R135/R136 所有关键变量和路径仍然存在', () => {
        const blk = getSsBlock();
        // R134: seerSsCounterHint
        expect(blk).toContain('const ssCounterClaimants = playerRole === \'预言家\'');
        expect(blk).toContain('const seerSsCounterHint =');
        // R135: knightSsCounterHint
        expect(blk).toContain('const ssKnightCounterClaimants = playerRole === \'骑士\'');
        expect(blk).toContain('const knightSsCounterHint =');
        // R136: wolf ssHint 三路径
        expect(blk).toContain('① 若悍跳预言家：');
        expect(blk).toContain('② 若悍跳骑士：');
        expect(blk).toContain('③ 若以好人身份竞选：');
        // R136: JSON template jump_knight 说明
        expect(blk).toContain('悍跳骑士时填写');
    });
});
