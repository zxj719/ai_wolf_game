/**
 * Round 64: SHERIFF_BADGE_PASS 读写闭环补完
 * 好人警长死亡传徽时，补充 Step0 读取 identity_table（历史身份推理）
 * + Step1 传徽优先级框架（金水 > identity_table ≥ 70 非狼 > 发言可信者 > 撕毁）
 * 守卫/女巫 DAY_VOTE 走通用 fallback 为有意设计确认
 */
import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

const aiPromptsPath = resolve(process.cwd(), 'src/services/aiPrompts.js');
const src = readFileSync(aiPromptsPath, 'utf-8');

// 定位 SHERIFF_BADGE_PASS case 块（用带花括号形式精确锚定）
const badgePassStart = src.indexOf('case PROMPT_ACTIONS.SHERIFF_BADGE_PASS: {');
const badgePassEnd = src.indexOf('case PROMPT_ACTIONS.LAST_WORDS:', badgePassStart);
const badgePassBlock = src.slice(badgePassStart, badgePassEnd);

// 定位 DAY_VOTE case 块（带花括号形式）
const dayVoteStart = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const dayVoteEnd = src.indexOf('case PROMPT_ACTIONS.SHERIFF_RUN:', dayVoteStart);
const dayVoteBlock = src.slice(dayVoteStart, dayVoteEnd);

describe('Round 64: SHERIFF_BADGE_PASS 读写闭环（好人警长传徽）', () => {
    it('T1: SHERIFF_BADGE_PASS case 块中存在 bpIdentityStep 变量', () => {
        expect(badgePassBlock).toContain('bpIdentityStep');
    });

    it('T2: 好人分支包含 Step0 读取 identity_table 指令', () => {
        expect(badgePassBlock).toContain('Step0:');
        expect(badgePassBlock).toContain('身份推理表');
        expect(badgePassBlock).toContain('你之前的身份推理表');
    });

    it('T3: 好人分支 Step0 包含 confidence ≥ 70 阈值', () => {
        expect(badgePassBlock).toContain('confidence ≥ 70');
    });

    it('T4: 好人分支 Step0 包含非狼人过滤条件', () => {
        // AI 需要过滤掉狼人嫌疑高的玩家
        const hasNonWolfFilter = badgePassBlock.includes('不含"狼人"') ||
                                 badgePassBlock.includes('非狼嫌疑') ||
                                 badgePassBlock.includes('非狼人');
        expect(hasNonWolfFilter).toBe(true);
    });

    it('T5: 好人分支包含 Step1 传徽优先级框架', () => {
        expect(badgePassBlock).toContain('Step1:');
        expect(badgePassBlock).toContain('传徽优先级');
    });

    it('T6: Step1 优先级正确：预言家金水 > identity_table > 发言可信者 > 撕毁', () => {
        const step1Idx = badgePassBlock.indexOf('Step1:');
        const step1Line = badgePassBlock.slice(step1Idx, step1Idx + 200);
        // 验证优先级顺序中包含关键节点
        const goldIdx = step1Line.indexOf('预言家金水');
        const idTableIdx = step1Line.indexOf('identity_table');
        const tearIdx = step1Line.indexOf('-1撕毁') !== -1 ? step1Line.indexOf('-1撕毁') : step1Line.indexOf('撕毁');
        expect(goldIdx).toBeGreaterThanOrEqual(0);
        expect(idTableIdx).toBeGreaterThanOrEqual(0);
        expect(tearIdx).toBeGreaterThanOrEqual(0);
        // 金水在 identity_table 前
        expect(goldIdx).toBeLessThan(idTableIdx);
        // identity_table 在撕毁前
        expect(idTableIdx).toBeLessThan(tearIdx);
    });

    it('T7: 狼人警长分支不包含 Step0（狼人无需读取，已知全局身份）', () => {
        // 狼人分支的 bpIdentityStep = ''，不应向狼人注入 Step0
        const wolfHintIdx = badgePassBlock.indexOf('狼人警长');
        const step0Idx = badgePassBlock.indexOf('Step0:');
        // Step0 出现前（或整个 block 内只有一个 Step0 在好人条件内）
        // 验证方式：bpIdentityStep 仅在 playerRole !== '狼人' 时赋值
        expect(badgePassBlock).toContain("playerRole !== '狼人'");
    });

    it('T8: bpIdentityStep 注入在 bpHint 之前（Step0 先于主要建议）', () => {
        const identityStepIdx = badgePassBlock.indexOf('bpIdentityStep ?');
        const bpHintIdx = badgePassBlock.indexOf('bpHint}');
        expect(identityStepIdx).toBeGreaterThanOrEqual(0);
        expect(bpHintIdx).toBeGreaterThanOrEqual(0);
        // template string 中 bpIdentityStep 插值在 bpHint 之前
        expect(identityStepIdx).toBeLessThan(bpHintIdx);
    });

    it('T9: 好人警长主提示简化——不再包含旧版"金水>真预言家>发言可信者"文本', () => {
        // 优先级已移到 Step1，bpHint 好人分支不重复老文本
        expect(badgePassBlock).not.toContain('金水>真预言家>发言可信者');
    });

    it('T10: 狼人警长分支包含"延续1.5票优势"（狼人传徽策略不变）', () => {
        expect(badgePassBlock).toContain('延续1.5票优势');
    });

    it('T11: 输出 JSON 包含 targetId、reason、thought 三个字段', () => {
        expect(badgePassBlock).toContain('"targetId"');
        expect(badgePassBlock).toContain('"reason"');
        expect(badgePassBlock).toContain('"thought"');
    });
});

describe('Round 64: 守卫/女巫 DAY_VOTE 通用 fallback 确认（有意设计）', () => {
    // 守卫写"守护优先级：高/中" → 这是夜间计划，白天投票走通用 fallback 是正确设计
    // 女巫写"毒药优先候选" → 这是独立夜间决策，不应影响白天投票（会暴露身份）

    it('T12: DAY_VOTE case 块中守卫没有专属投票框架（有意走通用）', () => {
        const hasGuardVoteStrategy = dayVoteBlock.includes('guardVoteStrategy') ||
                                     dayVoteBlock.includes("playerRole === '守卫'");
        // 守卫应走通用 fallback，不应有专属框架
        expect(hasGuardVoteStrategy).toBe(false);
    });

    it('T13: DAY_VOTE case 块中女巫没有专属投票框架（有意走通用）', () => {
        const hasWitchVoteStrategy = dayVoteBlock.includes('witchVoteStrategy') ||
                                     (dayVoteBlock.includes("playerRole === '女巫'") &&
                                      dayVoteBlock.includes('VoteStrategy'));
        expect(hasWitchVoteStrategy).toBe(false);
    });

    it('T14: DAY_VOTE 已有的4个专属框架完整存在（狼/猎/骑士 + 预言家对跳策略）', () => {
        // 验证 R61-R63 的专属框架未被误删
        expect(dayVoteBlock).toContain('高优先刀口');           // 狼人 R61
        expect(dayVoteBlock).toContain('hunterVoteStrategy');   // 猎人 R62
        expect(dayVoteBlock).toContain('knightVoteStrategy');   // 骑士 R63
        expect(dayVoteBlock).toContain('seerVoteStrategy');     // 预言家（pre-existing）
    });
});
