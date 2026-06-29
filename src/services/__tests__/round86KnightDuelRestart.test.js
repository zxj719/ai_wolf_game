/**
 * R86: 骑士延迟决斗补救策略 — 三路径评估 + 续战搜索框架
 *
 * 验证 knightHistoryStep 升级后包含：
 * - 路径A（候选存活）/ 路径B（候选被投票出局）/ 路径C（候选被狼夜杀）三路径
 * - 续战搜索框架（路径B/C 触发，按优先级A>B>C 扫描）
 * - identity_table 新关键词 "→已投票出局（好人方向一致）" / "→已被狼击杀（铁好人确认）" / "→重启决斗候选"
 *
 * 已知模式（R56/R57 教训）：
 * - knight.js 使用函数体形式：变量声明在 return 之前，模板里只有 ${变量名} 占位符
 * - 测试 knightHistoryStep 内容需从变量声明区查找，不能从 return 模板区
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const knightSrc = readFileSync(
  path.resolve('src/services/rolePrompts/knight.js'),
  'utf-8'
);

// 定位 knightHistoryStep 变量声明区
const histIdx = knightSrc.indexOf('const knightHistoryStep');
const histEnd = knightSrc.indexOf('const duelStatus', histIdx);
const histBlock = knightSrc.slice(histIdx, histEnd);

// 定位 identity_table 写指导区
const idTableIdx = knightSrc.indexOf('identity_table 填写指导');
const idTableEnd = knightSrc.indexOf('输出JSON:', idTableIdx);
const idTableBlock = knightSrc.slice(idTableIdx, idTableEnd);

// 定位 return 模板区（验证插值占位符位置）
const returnIdx = knightSrc.indexOf('return `${getBaseContext(ctx)}');
const returnEnd = knightSrc.indexOf('getKnightDuelPrompt', returnIdx);
const returnBlock = knightSrc.slice(returnIdx, returnEnd);

describe('R86: knightHistoryStep 三路径评估框架', () => {

  // ─── T1: D2+ 分支包含"续战搜索"概念 ───
  it('T1: knightHistoryStep D2+ 分支包含"续战搜索"文本', () => {
    // histBlock 包含三元运算符的两个分支
    expect(histBlock).toContain('续战搜索');
  });

  // ─── T2: 路径B（候选被投票出局）存在 ───
  it('T2: knightHistoryStep 包含路径B（候选已被投票出局）', () => {
    expect(histBlock).toContain('路径B');
    expect(histBlock).toContain('候选已被投票出局');
  });

  // ─── T3: 路径C（候选被狼夜杀）存在 ───
  it('T3: knightHistoryStep 包含路径C（候选已被狼夜杀）', () => {
    expect(histBlock).toContain('路径C');
    expect(histBlock).toContain('候选已被狼夜杀');
  });

  // ─── T4: D1 fallback 不变（"第一天"降级） ───
  it('T4: knightHistoryStep D1 fallback 仍含"第一天"文本', () => {
    expect(histBlock).toContain('第一天');
    expect(histBlock).toContain('无历史决斗候选记录');
  });

  // ─── T5: 续战搜索使用动态阈值插值（thresholdA / thresholdB） ───
  it('T5: 续战搜索通过 ${thresholdA} / ${thresholdB} 引用动态阈值', () => {
    expect(histBlock).toContain('${thresholdA}');
    expect(histBlock).toContain('${thresholdB}');
  });

});

describe('R86: knightHistoryStep 续战搜索内容验证', () => {

  // ─── T6: 路径B identity_table 关键词正确 ───
  it('T6: 路径B 包含 "→已投票出局（好人方向一致）" 关键词', () => {
    expect(histBlock).toContain('→已投票出局（好人方向一致）');
  });

  // ─── T7: 路径C identity_table 关键词正确 ───
  it('T7: 路径C 包含 "→已被狼击杀（铁好人确认）" 关键词', () => {
    expect(histBlock).toContain('→已被狼击杀（铁好人确认）');
  });

  // ─── T8: 续战搜索包含三级优先级扫描 ───
  it('T8: 续战搜索框架包含决斗优先级A/B/C 三级扫描', () => {
    expect(histBlock).toContain('决斗优先级A');
    expect(histBlock).toContain('决斗优先级B');
    expect(histBlock).toContain('决斗优先级C');
  });

  // ─── T9: 续战搜索包含"→重启决斗候选"关键词 ───
  it('T9: 续战搜索框架包含 "→重启决斗候选" 关键词', () => {
    expect(histBlock).toContain('→重启决斗候选');
  });

  // ─── T10: 三步结构（① ② ③）完整 ───
  it('T10: knightHistoryStep 包含三步骤 ① ② ③ 结构', () => {
    expect(histBlock).toContain('①');
    expect(histBlock).toContain('②');
    expect(histBlock).toContain('③');
  });

});

describe('R86: 注入位置与模板结构验证', () => {

  // ─── T11: ${knightHistoryStep} 插值仍在模板中 ───
  it('T11: return 模板中仍有 ${knightHistoryStep} 插值占位符', () => {
    expect(returnBlock).toContain('${knightHistoryStep}');
  });

  // ─── T12: ${knightHistoryStep} 在 Step1 局势分析之前 ───
  it('T12: ${knightHistoryStep} 出现在 "Step1: 场上局势分析" 之前', () => {
    const injectPos = returnBlock.indexOf('${knightHistoryStep}');
    const step1Pos = returnBlock.indexOf('Step1: 场上局势分析');
    expect(injectPos).toBeGreaterThan(-1);
    expect(step1Pos).toBeGreaterThan(-1);
    expect(injectPos).toBeLessThan(step1Pos);
  });

  // ─── T13: 路径A（候选存活）正常流程保留 ───
  it('T13: 路径A（候选存活）正常评估流程仍存在', () => {
    expect(histBlock).toContain('路径A');
    expect(histBlock).toContain('候选存活');
    expect(histBlock).toContain('正常进入决斗评估流程');
  });

  // ─── T14: identity_table 写指导包含"→已投票出局" ───
  it('T14: identity_table 写指导已包含"→已投票出局（好人方向一致）"', () => {
    expect(idTableBlock).toContain('→已投票出局（好人方向一致）');
  });

  // ─── T15: identity_table 写指导包含"→重启决斗候选" ───
  it('T15: identity_table 写指导已包含"→重启决斗候选"关键词', () => {
    expect(idTableBlock).toContain('→重启决斗候选');
  });

});

describe('R86: 回归验证', () => {

  // ─── T16: ctx.dayCount > 1 条件未改变 ───
  it('T16: knightHistoryStep 触发条件仍是 ctx.dayCount > 1', () => {
    expect(histBlock).toContain('ctx.dayCount > 1');
  });

  // ─── T17: 白熊效应合规 — 续战搜索使用正向描述 ───
  it('T17: 白熊合规 — histBlock 不含"禁止""不要"等负向禁词', () => {
    // 路径B/C 均为正向描述（"好人阵营已消灭"/"目标已确认为好人"），无"不要"等
    const bearWords = ['不要决斗', '禁止决斗', '不能决斗'];
    for (const w of bearWords) {
      expect(histBlock).not.toContain(w);
    }
  });

  // ─── T18: **追加不覆盖历史** 仍存在（R60 回归） ───
  it('T18: knight.js 仍含 **追加不覆盖历史**（R60 格式要求回归）', () => {
    expect(knightSrc).toContain('**追加不覆盖历史**');
  });

  // ─── T19: 运行时 D1 → 返回"第一天"fallback ───
  it('T19: 运行时 D1 时 knightHistoryStep 为"第一天"fallback', async () => {
    const { getKnightDaySpeechPrompt } = await import('../rolePrompts/knight.js');
    const ctx = { dayCount: 1, players: [], speeches: [], deadPlayers: [], lastNightDeaths: [], seerChecks: [], existingRoles: {}, gameSetup: {} };
    const params = { hasUsedDuel: false, aliveCount: 8 };
    const prompt = getKnightDaySpeechPrompt(ctx, params);
    expect(prompt).toContain('第一天');
    expect(prompt).not.toContain('续战搜索');
  });

  // ─── T20: 运行时 D2+ → 生成的提示词包含"续战搜索" ───
  it('T20: 运行时 D2+ 时生成的提示词包含"续战搜索"', async () => {
    const { getKnightDaySpeechPrompt } = await import('../rolePrompts/knight.js');
    const ctx = { dayCount: 2, players: [], speeches: [], deadPlayers: [], lastNightDeaths: [], seerChecks: [], existingRoles: {}, gameSetup: {} };
    const params = { hasUsedDuel: false, aliveCount: 8 };
    const prompt = getKnightDaySpeechPrompt(ctx, params);
    expect(prompt).toContain('续战搜索');
    expect(prompt).toContain('→重启决斗候选');
    expect(prompt).toContain('→已投票出局（好人方向一致）');
  });

});
