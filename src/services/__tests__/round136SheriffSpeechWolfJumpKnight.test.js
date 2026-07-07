/**
 * Round 136: SHERIFF_SPEECH 狼人悍跳骑士 claims 字段指引
 *
 * 问题：R135 已实现骑士对真骑士的对跳感知（ssKnightCounterClaimants），但狼人悍跳骑士时
 *   wolf ssHint 只有 ①悍跳预言家（含claims格式）和 ②好人身份竞选，缺少悍跳骑士路径。
 *   导致：狼人悍跳骑士时不知道如何填写 claims 字段，claimHistory 中缺少 jump_knight 记录，
 *   R135 的 ssKnightCounterClaimants 检测无效（找不到 jump_knight 记录）。
 *
 * 修复（R136）：
 *   aiPrompts.js SHERIFF_SPEECH wolf ssHint 新增 ② 路径（悍跳骑士）：
 *     - 声称已向某人发起或准备发起决斗，给出具体决斗目标
 *     - claims 字段格式：[{"type":"jump_knight","duel":{"targetId":X}}]
 *   原 ② 好人身份竞选 → 重编为 ③
 *   JSON 输出模板新增 jump_knight 说明（与 jump_seer 对称）
 *
 * 设计依据：
 *   - 完整写→读闭环：wolf fills claims → recordClaim writes claimHistory →
 *     ssKnightCounterClaimants detects jump_knight → 真骑士获得 knightSsCounterHint
 *   - 与 jump_seer 路径完全对称（R134）
 *   - 骑士身份独占原则（R125）：wolf 声称骑士 = 100% 假，R135 的真骑士检测依赖 claimHistory 写入
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const ssStart = src.lastIndexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
const SS_WINDOW = 8500;
const getSsBlock = () => src.slice(ssStart, ssStart + SS_WINDOW);

// ─── T1-T3: wolf ssHint ② 悍跳骑士路径存在 ──────────────────────────────────────

describe('R136: wolf ssHint ② — 悍跳骑士路径声明', () => {
    test('T1: wolf ssHint 包含 "② 若悍跳骑士" 路径', () => {
        const blk = getSsBlock();
        expect(blk).toContain('② 若悍跳骑士：');
    });

    test('T2: wolf ssHint ② 路径包含 jump_knight 类型的 claims 格式', () => {
        const blk = getSsBlock();
        const wolfIdx = blk.indexOf('② 若悍跳骑士：');
        const wolfSlice = blk.slice(wolfIdx, wolfIdx + 300);
        expect(wolfSlice).toContain('"type":"jump_knight"');
        expect(wolfSlice).toContain('"duel":{"targetId":X}');
    });

    test('T3: wolf ssHint ② 路径包含 claims 字段声明指引', () => {
        const blk = getSsBlock();
        const wolfIdx = blk.indexOf('② 若悍跳骑士：');
        const wolfSlice = blk.slice(wolfIdx, wolfIdx + 300);
        expect(wolfSlice).toContain('claims 字段声明');
    });
});

// ─── T4-T5: 原 ② 好人身份竞选 → 重编为 ③ ─────────────────────────────────────────

describe('R136: wolf ssHint ③ — 原"好人身份竞选"正确重编', () => {
    test('T4: wolf ssHint 包含 "③ 若以好人身份竞选" 路径', () => {
        const blk = getSsBlock();
        expect(blk).toContain('③ 若以好人身份竞选：');
    });

    test('T5: wolf ssHint ③ 路径包含 "claims 留 []"', () => {
        const blk = getSsBlock();
        const thirdIdx = blk.indexOf('③ 若以好人身份竞选：');
        const thirdSlice = blk.slice(thirdIdx, thirdIdx + 200);
        expect(thirdSlice).toContain('claims 留 []');
    });
});

// ─── T6: JSON 输出模板包含 jump_knight 说明 ──────────────────────────────────────

describe('R136: JSON 输出模板 — claims 说明补充 jump_knight', () => {
    test('T6: JSON 输出模板包含悍跳骑士时的 claims 格式说明', () => {
        const blk = getSsBlock();
        const jsonIdx = blk.indexOf('输出JSON:');
        const jsonSlice = blk.slice(jsonIdx, jsonIdx + 350);
        expect(jsonSlice).toContain('悍跳骑士时填写');
        expect(jsonSlice).toContain('"type":"jump_knight"');
        expect(jsonSlice).toContain('"duel":{"targetId":X}');
    });
});

// ─── T7: jump_knight 在 wolf ssHint 区先于 JSON 模板出现（顺序正确）─────────────

describe('R136: jump_knight 写→读闭环顺序', () => {
    test('T7: jump_knight 首次出现在 wolf ssHint（② 路径）中，早于 JSON 模板', () => {
        const blk = getSsBlock();
        const firstJumpKnight = blk.indexOf('"type":"jump_knight"');
        const jsonIdx = blk.indexOf('输出JSON:');
        expect(firstJumpKnight).toBeGreaterThan(0);
        expect(firstJumpKnight).toBeLessThan(jsonIdx);
    });
});

// ─── T8: SS_WINDOW 余量充足 ──────────────────────────────────────────────────────

describe('R136: SS_WINDOW 余量验证', () => {
    test('T8: SS block size < SS_WINDOW - 500（余量安全）', () => {
        const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:', ssStart);
        const blockSize = svStart - ssStart;
        expect(blockSize).toBeLessThan(SS_WINDOW - 500);
    });
});

// ─── T9-T10: 白熊效应合规 ────────────────────────────────────────────────────────

describe('R136: 白熊效应合规 — wolf ssHint 新增路径全正向', () => {
    test('T9: 悍跳骑士路径无负向禁词', () => {
        const blk = getSsBlock();
        const wolfIdx = blk.indexOf('② 若悍跳骑士：');
        const wolfSlice = blk.slice(wolfIdx, wolfIdx + 300);
        expect(wolfSlice).not.toContain('绝不能');
        expect(wolfSlice).not.toContain('千万别');
        expect(wolfSlice).not.toContain('自曝');
    });

    test('T10: JSON 模板中悍跳骑士说明无白熊词汇', () => {
        const blk = getSsBlock();
        const jsonIdx = blk.indexOf('悍跳骑士时填写');
        const jsonSlice = blk.slice(jsonIdx, jsonIdx + 100);
        expect(jsonSlice).not.toContain('禁止');
        expect(jsonSlice).not.toContain('不要');
    });
});

// ─── T11: 回归测试 ───────────────────────────────────────────────────────────────

describe('R136: 回归测试 — R134/R135 功能完整保留', () => {
    test('T11: R134 jump_seer 路径和 R135 骑士对跳检测仍然存在', () => {
        const blk = getSsBlock();
        // R134: wolf ssHint ① 悍跳预言家
        expect(blk).toContain('"type":"jump_seer"');
        expect(blk).toContain('"checks":[{"night":1,"targetId":X');
        // R135: 骑士对跳检测
        expect(blk).toContain('const ssKnightCounterClaimants = playerRole === \'骑士\'');
        expect(blk).toContain('const knightSsCounterHint = ssKnightCounterClaimants.length > 0');
        // R134: 预言家对跳检测
        expect(blk).toContain('const ssCounterClaimants = playerRole === \'预言家\'');
    });
});
