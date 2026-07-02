/**
 * Round 59: 横向一致性审计 — 狼人写指导补全"追加不覆盖历史"规则
 *
 * 问题：横向一致性审计发现狼人是唯一在 DAY_SPEECH 写指导和 NIGHT_WOLF 写指导中
 * 缺少"追加不覆盖历史"+"【追加示例】"的角色。其他6个角色（预言家/女巫/猎人/守卫/村民/摄梦人）
 * 均已在各自写指导中明确"追加不覆盖历史"规则，防止 AI 覆盖历史积累的战略标注。
 *
 * 本轮修复：
 * 1. DAY_SPEECH 狼人写指导：添加"**追加不覆盖历史**" + "【追加示例】"（DAY侧）
 * 2. NIGHT_WOLF 写指导：在"高威胁好人"条目中添加"**追加不覆盖历史**" + "【追加示例】"（NIGHT侧）
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const aiPromptsPath = resolve(process.cwd(), 'src/services/aiPrompts.js');
const src = readFileSync(aiPromptsPath, 'utf-8');

// ─── 定位工具 ─────────────────────────────────────────────────────────────────

// 定位 ROLE_DAY_SPEECH_PROMPTS['狼人'] 段落
// 使用「日间公开视角」作为唯一锚点（该字符串仅出现在狼人写指导中）
const wolfDaySectionAnchor = '【identity_table 填写策略（日间公开视角，但 reason 可记录私有战略注记）】';
const wolfDayIdx = src.indexOf(wolfDaySectionAnchor);

// 定位 NIGHT_WOLF 写指导段落
// 使用「identity_table 战略更新（读写闭环）」作为唯一锚点
const wolfNightSectionAnchor = '【identity_table 战略更新（读写闭环）】';
const wolfNightIdx = src.indexOf(wolfNightSectionAnchor);

// ─── 测试组 A: DAY_SPEECH 狼人写指导 ─────────────────────────────────────────

describe('R59 测试 A: DAY_SPEECH 狼人写指导', () => {
    it('T1: 狼人 DAY 写指导锚点存在', () => {
        expect(wolfDayIdx).toBeGreaterThan(0);
    });

    it('T2: DAY 写指导含"**追加不覆盖历史**"规则', () => {
        // 从锚点往后取 600 字节，应包含追加规则
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        expect(wolfDayBlock).toContain('追加不覆盖历史');
    });

    it('T3: DAY 写指导含"【追加示例】"', () => {
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        expect(wolfDayBlock).toContain('【追加示例】');
    });

    it('T4: DAY 追加示例含分号拼接格式（D2→D3 模式）', () => {
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        // 示例应包含 "D2" 和 "D3 末尾追加为"
        expect(wolfDayBlock).toContain('D2 reason=');
        expect(wolfDayBlock).toContain('D3 末尾追加为');
    });

    it('T5: DAY 追加示例含"高优先刀口"关键词（与 Step 0 对齐）', () => {
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        const appendExampleIdx = wolfDayBlock.indexOf('【追加示例】D2');
        expect(appendExampleIdx).toBeGreaterThan(-1);
        // 追加示例中应含"高优先刀口"关键词
        const appendLine = wolfDayBlock.slice(appendExampleIdx, appendExampleIdx + 200);
        expect(appendLine).toContain('高优先刀口');
    });

    it('T6: DAY 追加规则位于 suspect 字段说明之前（追加规则不影响 suspect 字段说明）', () => {
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        const appendIdx = wolfDayBlock.indexOf('追加不覆盖历史');
        const suspectIdx = wolfDayBlock.indexOf('suspect 字段统一用好人视角书写');
        expect(appendIdx).toBeGreaterThan(-1);
        expect(suspectIdx).toBeGreaterThan(-1);
        expect(appendIdx).toBeLessThan(suspectIdx);
    });
});

// ─── 测试组 B: NIGHT_WOLF 写指导 ─────────────────────────────────────────────

describe('R59 测试 B: NIGHT_WOLF 写指导', () => {
    it('T7: 狼人 NIGHT 写指导锚点存在', () => {
        expect(wolfNightIdx).toBeGreaterThan(0);
    });

    it('T8: NIGHT 写指导含"追加不覆盖历史"规则', () => {
        // 从锚点往后取 600 字节，应包含追加规则
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        expect(wolfNightBlock).toContain('追加不覆盖历史');
    });

    it('T9: NIGHT 写指导含"【追加示例】"', () => {
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        expect(wolfNightBlock).toContain('【追加示例】');
    });

    it('T10: NIGHT 追加示例含分号拼接格式（N2→N3 模式）', () => {
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        // 示例应包含 "N2 reason=" 和 "N3 末尾追加为"
        expect(wolfNightBlock).toContain('N2 reason=');
        expect(wolfNightBlock).toContain('N3 末尾追加为');
    });

    it('T11: NIGHT 追加示例含"高优先刀口"关键词（与 NIGHT_WOLF Step 0 对齐）', () => {
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        const appendExampleIdx = wolfNightBlock.indexOf('【追加示例】N2');
        expect(appendExampleIdx).toBeGreaterThan(-1);
        const appendLine = wolfNightBlock.slice(appendExampleIdx, appendExampleIdx + 200);
        expect(appendLine).toContain('高优先刀口');
    });

    it('T12: NIGHT 追加规则位于"若本轮刀了某目标"之前（追加通用规则 > 特定案例追加）', () => {
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        const appendIdx = wolfNightBlock.indexOf('追加不覆盖历史');
        const killedIdx = wolfNightBlock.indexOf('若本轮刀了某目标');
        expect(appendIdx).toBeGreaterThan(-1);
        expect(killedIdx).toBeGreaterThan(-1);
        expect(appendIdx).toBeLessThan(killedIdx);
    });
});

// ─── 测试组 C: 关键词对齐验证 ────────────────────────────────────────────────

describe('R59 测试 C: 四环关键词对齐验证', () => {
    it('T13: DAY_SPEECH 写指导含"高优先刀口"（DAY写侧关键词）', () => {
        const wolfDayBlock = src.slice(wolfDayIdx, wolfDayIdx + 600);
        expect(wolfDayBlock).toContain('高优先刀口');
    });

    it('T14: DAY_SPEECH Step 0 含"高优先刀口"（DAY读侧关键词，R55 回归）', () => {
        // 狼人 DAY Step 0 是内联文本，R55 已实装
        // 关键词存在于模板字符串中
        const wolfDayTemplateAnchor = '【思维框架（在 thought 中完成，不要写进 speech）】';
        const wolfDayTemplateIdx = src.indexOf(wolfDayTemplateAnchor);
        expect(wolfDayTemplateIdx).toBeGreaterThan(-1);
        // Step 0 文本在此区域内 300 字节内
        const stepBlock = src.slice(wolfDayTemplateIdx, wolfDayTemplateIdx + 300);
        expect(stepBlock).toContain('高优先刀口');
    });

    it('T15: NIGHT_WOLF Step 0 含"高优先刀口"（NIGHT读侧关键词，R47 回归）', () => {
        // wolfHistoryStep 中的历史读取步骤（使用 【读取历史刀口 + 核查执行结果】 更精确锚点，避免 R102 注释中的"读取历史刀口"误匹配）
        const nightStepAnchor = '【读取历史刀口 + 核查执行结果】';
        const nightStepIdx = src.indexOf(nightStepAnchor);
        expect(nightStepIdx).toBeGreaterThan(-1);
        const nightStepBlock = src.slice(nightStepIdx, nightStepIdx + 200);
        expect(nightStepBlock).toContain('高优先刀口');
    });

    it('T16: NIGHT_WOLF 写指导含"高优先刀口"（NIGHT写侧关键词）', () => {
        const wolfNightBlock = src.slice(wolfNightIdx, wolfNightIdx + 600);
        expect(wolfNightBlock).toContain('高优先刀口');
    });
});

// ─── 测试组 D: 回归验证（其他角色未受影响）──────────────────────────────────

describe('R59 测试 D: 其他角色追加规则完整性回归', () => {
    it('T17: 预言家 DAY 写指导仍含"追加不覆盖历史"（R57 回归）', () => {
        const seerAnchor = '【identity_table 填写指导（预言家有确定性知识，应差异化填写）】';
        const seerIdx = src.indexOf(seerAnchor);
        expect(seerIdx).toBeGreaterThan(-1);
        const seerBlock = src.slice(seerIdx, seerIdx + 600);
        expect(seerBlock).toContain('追加不覆盖历史');
        expect(seerBlock).toContain('【追加示例】');
    });

    it('T18: 女巫 DAY 写指导仍含"追加不覆盖历史"（R58 回归）', () => {
        const witchAnchor = '【identity_table 填写指导（女巫：药水使用历史 + 备选候选记录）】';
        const witchIdx = src.indexOf(witchAnchor);
        expect(witchIdx).toBeGreaterThan(-1);
        const witchBlock = src.slice(witchIdx, witchIdx + 600);
        expect(witchBlock).toContain('追加不覆盖历史');
        expect(witchBlock).toContain('【追加示例】');
    });

    it('T19: 猎人 DAY 写指导仍含"追加不覆盖历史"（R56 回归）', () => {
        const hunterAnchor = '【identity_table 填写指导（猎人：跨轮积累开枪优先级）】';
        const hunterIdx = src.indexOf(hunterAnchor);
        expect(hunterIdx).toBeGreaterThan(-1);
        const hunterBlock = src.slice(hunterIdx, hunterIdx + 600);
        expect(hunterBlock).toContain('追加不覆盖历史');
        expect(hunterBlock).toContain('【追加示例】');
    });

    it('T20: 守卫 DAY 写指导仍含"追加"+"【追加示例】"（R58 回归）', () => {
        const guardAnchor = '【identity_table 填写指导（守卫：跨轮守护记录 + 神职候选标记）】';
        const guardIdx = src.indexOf(guardAnchor);
        expect(guardIdx).toBeGreaterThan(-1);
        const guardBlock = src.slice(guardIdx, guardIdx + 600);
        // 守卫使用的是"不覆盖历史"而非"追加不覆盖历史"（格式略有不同，但含义相同）
        expect(guardBlock).toContain('不覆盖历史');
        expect(guardBlock).toContain('【追加示例】');
    });

    it('T21: NIGHT_GUARD 写指导仍含"【追加示例】"（R40 回归）', () => {
        // 守卫夜间写指导中"守护候选/已守护者"条目有追加格式示例
        const guardNightAnchor = '【identity_table 填写指导（守卫夜间：守护历史跨轮追加，辅助连贯策略）】';
        const guardNightIdx = src.indexOf(guardNightAnchor);
        expect(guardNightIdx).toBeGreaterThan(-1);
        const guardNightBlock = src.slice(guardNightIdx, guardNightIdx + 400);
        expect(guardNightBlock).toContain('【追加示例】');
    });
});
