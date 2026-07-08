/**
 * Round 134: SHERIFF_SPEECH 竞选对跳检测 + 声明写入 claimHistory
 *
 * 问题：狼人在警长竞选中悍跳预言家时：
 *   1. 声明未写入 claimHistory → 后续候选人（含真预言家）无法感知对跳
 *   2. 真预言家的竞选发言缺少对跳反制指引
 *
 * 修复（R134）：
 *   aiPrompts.js:
 *     - ssCounterClaimants（预言家门控）：过滤 claimHistory 的 jump_seer 排除自身
 *     - seerSsCounterHint（有对跳时注入真实查验锚点提示）
 *     - 预言家 ssHint 末尾追加 ${seerSsCounterHint}
 *     - 狼人 ssHint ① 追加 claims 字段声明指引
 *     - 输出 JSON 新增 claims 可选字段
 *   useDayFlow.js:
 *     - 新增 recordClaim = null 参数
 *     - 每次 SHERIFF_SPEECH 响应后解析 res.claims 调用 recordClaim
 *   WerewolfModule.jsx:
 *     - useDayFlow 调用中传入 recordClaim
 *
 * 研究依据：Wang 2025 (arxiv:2408.17177)
 *   对跳场景中：信息权威 = 私有验证数据（seer's actual check）>> NLP 推断
 *   第一发言者的声明写入结构化日志是后续信息闭环的关键前提。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../aiPrompts.js'), 'utf8');
const ssStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_SPEECH:');
const SS_WINDOW = 9500;
const getSsBlock = () => src.slice(ssStart, ssStart + SS_WINDOW);

// ─── T1-T3: ssCounterClaimants 变量声明与门控 ──────────────────────────────────

describe('R134: ssCounterClaimants — 预言家竞选对跳检测变量', () => {
    test('T1: ssCounterClaimants 变量声明存在（预言家门控）', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const ssCounterClaimants = playerRole === \'预言家\'');
    });

    test('T2: ssCounterClaimants 过滤 jump_seer 类型声明', () => {
        const blk = getSsBlock();
        expect(blk).toContain('.filter(c => c.type === \'jump_seer\' && c.playerId !== currentPlayer?.id)');
    });

    test('T3: ssCounterClaimants 映射为 playerId 数组', () => {
        const blk = getSsBlock();
        const ccIdx = blk.indexOf('const ssCounterClaimants =');
        const ccSlice = blk.slice(ccIdx, ccIdx + 300);
        expect(ccSlice).toContain('.map(c => c.playerId)');
    });
});

// ─── T4-T6: seerSsCounterHint 条件注入 ──────────────────────────────────────

describe('R134: seerSsCounterHint — 对跳情境条件化提示', () => {
    test('T4: seerSsCounterHint 变量声明存在', () => {
        const blk = getSsBlock();
        expect(blk).toContain('const seerSsCounterHint = ssCounterClaimants.length > 0');
    });

    test('T5: seerSsCounterHint 空时返回空字符串（零副作用）', () => {
        const blk = getSsBlock();
        const shIdx = blk.indexOf('const seerSsCounterHint =');
        const shSlice = blk.slice(shIdx, shIdx + 400);
        expect(shSlice).toContain(': \'\'');
    });

    test('T6: seerSsCounterHint 有对跳时包含查验结果引导（正向描述，无负向禁词）', () => {
        const blk = getSsBlock();
        const shIdx = blk.indexOf('const seerSsCounterHint =');
        const shSlice = blk.slice(shIdx, shIdx + 400);
        // 正向：引导报出真实查验结果
        expect(shSlice).toContain('真实夜1查验结果');
        expect(shSlice).toContain('真实数据是唯一无法构造的信息差');
        // 白熊效应合规：无负向禁词（"绝不"/"禁止"/"千万别"）
        expect(shSlice).not.toContain('绝不');
        expect(shSlice).not.toContain('禁止');
        expect(shSlice).not.toContain('千万别');
    });
});

// ─── T7-T8: 预言家 ssHint 追加 seerSsCounterHint ────────────────────────────

describe('R134: 预言家 ssHint — 追加 seerSsCounterHint', () => {
    test('T7: 预言家 ssHint 末尾追加 ${seerSsCounterHint}', () => {
        const blk = getSsBlock();
        expect(blk).toContain('理所当然该拿警徽。${seerSsCounterHint}');
    });

    test('T8: seerSsCounterHint 在 ssHint 赋值之后声明（声明顺序正确）', () => {
        const blk = getSsBlock();
        const counterHintIdx = blk.indexOf('const seerSsCounterHint =');
        const ssHintIdx = blk.indexOf('const ssHint = playerRole');
        expect(counterHintIdx).toBeGreaterThan(0);
        expect(ssHintIdx).toBeGreaterThan(counterHintIdx);
    });
});

// ─── T9-T10: 狼人 ssHint — claims 字段声明指引 ──────────────────────────────

describe('R134: 狼人 ssHint — 悍跳预言家 claims 字段声明', () => {
    test('T9: 狼人 ssHint 包含 claims 字段声明指引', () => {
        const blk = getSsBlock();
        expect(blk).toContain('claims 字段声明');
    });

    test('T10: 狼人 ssHint 包含 jump_seer 类型声明格式', () => {
        const blk = getSsBlock();
        expect(blk).toContain('"type":"jump_seer"');
        expect(blk).toContain('"checks"');
    });
});

// ─── T11-T12: 输出 JSON 新增 claims 字段 ─────────────────────────────────────

describe('R134: 输出 JSON — 新增 claims 可选字段', () => {
    test('T11: 输出 JSON 包含 claims 字段', () => {
        const blk = getSsBlock();
        const jsonIdx = blk.indexOf('输出JSON:');
        const jsonSlice = blk.slice(jsonIdx, jsonIdx + 300);
        expect(jsonSlice).toContain('"claims"');
    });

    test('T12: 输出 JSON claims 字段包含 jump_seer 示例', () => {
        const blk = getSsBlock();
        const jsonIdx = blk.indexOf('输出JSON:');
        const jsonSlice = blk.slice(jsonIdx, jsonIdx + 300);
        expect(jsonSlice).toContain('jump_seer');
    });
});

// ─── T13-T14: SS_WINDOW 充裕性 ───────────────────────────────────────────────

describe('R134: SS_WINDOW 充裕性验证', () => {
    test('T13: SHERIFF_SPEECH block 在 SS_WINDOW 内完整（不截断 ssHint 链）', () => {
        const blk = getSsBlock();
        // 确认输出 JSON 在窗口内
        expect(blk).toContain('输出JSON:');
        // 确认 ssHint 链末尾（fallback 好人分支）在窗口内
        expect(blk).toContain('用具体分析证明你值得这个警徽。');
    });

    test('T14: SS_WINDOW 余量充足（block size < SS_WINDOW - 500）', () => {
        const svStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_VOTE:', ssStart);
        const blockSize = svStart - ssStart;
        expect(blockSize).toBeLessThan(SS_WINDOW - 500);
    });
});

// ─── T15-T17: useDayFlow.js 结构验证 ─────────────────────────────────────────

describe('R134: useDayFlow.js — recordClaim 参数 + 竞选声明录入', () => {
    const dayFlowSrc = readFileSync(
        resolve(__dirname, '../../hooks/useDayFlow.js'), 'utf8'
    );

    test('T15: useDayFlow 新增 recordClaim = null 参数', () => {
        expect(dayFlowSrc).toContain('recordClaim = null,');
    });

    test('T16: SHERIFF_SPEECH 循环后有 res.claims 解析块', () => {
        expect(dayFlowSrc).toContain('Array.isArray(res?.claims) && recordClaim');
    });

    test('T17: recordClaim 调用传入正确字段（day, playerId, type, payload）', () => {
        const claimCallIdx = dayFlowSrc.indexOf('recordClaim({ day: dayCount');
        expect(claimCallIdx).toBeGreaterThan(0);
        const callSlice = dayFlowSrc.slice(claimCallIdx, claimCallIdx + 100);
        expect(callSlice).toContain('playerId: c.id');
        expect(callSlice).toContain('type,');
        expect(callSlice).toContain('payload,');
    });
});

// ─── T18: WerewolfModule.jsx 传参验证 ────────────────────────────────────────

describe('R134: WerewolfModule.jsx — useDayFlow 中传入 recordClaim', () => {
    const moduleSrc = readFileSync(
        resolve(__dirname, '../../modules/werewolf/WerewolfModule.jsx'), 'utf8'
    );

    test('T18: useDayFlow 调用中包含 recordClaim', () => {
        const dayFlowCallIdx = moduleSrc.indexOf('} = useDayFlow({');
        expect(dayFlowCallIdx).toBeGreaterThan(0);
        const callSlice = moduleSrc.slice(dayFlowCallIdx, dayFlowCallIdx + 700);
        expect(callSlice).toContain('recordClaim,');
    });
});

// ─── T19: 白熊效应合规总审计 ──────────────────────────────────────────────────

describe('R134: 白熊效应合规审计 — SHERIFF_SPEECH 整块无负向禁词', () => {
    test('T19: ssCounterClaimants + seerSsCounterHint 相关内容全正向描述', () => {
        const blk = getSsBlock();
        const counterHintIdx = blk.indexOf('const ssCounterClaimants =');
        const ssHintStart = blk.indexOf('const ssHint = playerRole');
        const counterSection = blk.slice(counterHintIdx, ssHintStart);
        // 白熊词汇检查
        expect(counterSection).not.toContain('绝不能');
        expect(counterSection).not.toContain('千万别');
        expect(counterSection).not.toContain('自曝');
    });
});
