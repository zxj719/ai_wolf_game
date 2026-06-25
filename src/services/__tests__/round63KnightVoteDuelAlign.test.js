/**
 * R63: 骑士 DAY_VOTE 读写闭环补完 — vote-duel 对齐框架
 *
 * 验证：骑士 DAY_SPEECH 写入"决斗候选"到 identity_table，
 * DAY_VOTE 现在应有专属框架读取该标注并对齐投票方向（vote-duel 对齐，R63）。
 *
 * 已知模式（R56/R57 教训）：
 * - 函数体形式：变量声明在 return 之前；模板字符串里只有 ${变量名} 占位符
 * - DAY_VOTE case 有花括号 { } (R11 教训)
 * - getCOTTemplate 也有 DAY_VOTE case（假 case）——用 "case PROMPT_ACTIONS.DAY_VOTE: {" 定位真实块
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const src = readFileSync(
  path.resolve('src/services/aiPrompts.js'),
  'utf-8'
);

// 锚定真实 DAY_VOTE 块（花括号区分假 case，R12 教训）
const dvCaseIdx = src.indexOf('case PROMPT_ACTIONS.DAY_VOTE: {');
const dvCaseEnd = src.indexOf('case PROMPT_ACTIONS.HUNTER_SHOOT:', dvCaseIdx);
const dvBlock = src.slice(dvCaseIdx, dvCaseEnd);

describe('R63: 骑士 DAY_VOTE vote-duel 对齐框架', () => {

  // ─── T1: knightVoteStrategy 常量声明存在于 DAY_VOTE 块内 ───
  it('T1: DAY_VOTE 块内声明 knightVoteStrategy 常量', () => {
    expect(dvBlock).toContain('knightVoteStrategy');
    expect(dvBlock).toContain('knightHasDueledForVote');
  });

  // ─── T2: 包含"决斗候选"关键词（与 knight.js identity_table 写指导一致） ───
  it('T2: knightVoteStrategy 含"决斗候选"关键词（与 knight.js 写指导对齐）', () => {
    const stratIdx = dvBlock.indexOf('knightVoteStrategy');
    const stratBlock = dvBlock.slice(stratIdx, stratIdx + 800);
    expect(stratBlock).toContain('决斗候选');
  });

  // ─── T3: vote-duel 对齐原则文本存在 ───
  it('T3: knightVoteStrategy 含 vote-duel 对齐概念', () => {
    const stratIdx = dvBlock.indexOf('knightVoteStrategy');
    const stratBlock = dvBlock.slice(stratIdx, stratIdx + 800);
    // Should contain the resource conservation principle
    expect(stratBlock).toContain('保留决斗');
  });

  // ─── T4: 已使用决斗时走领袖框架分支 ───
  it('T4: knightVoteStrategy 包含已决斗后的领袖框架', () => {
    const stratIdx = dvBlock.indexOf('knightVoteStrategy');
    const stratBlock = dvBlock.slice(stratIdx, stratIdx + 800);
    expect(stratBlock).toContain('公信力锚点');
  });

  // ─── T5: 骑士分支插入 playerRole 链条（猎人之后，通用 fallback 之前） ───
  it('T5: playerRole 链条顺序正确（狼→预→猎→骑士→通用）', () => {
    const hunterBranchIdx = dvBlock.indexOf("playerRole === '猎人'");
    const knightBranchIdx = dvBlock.indexOf("playerRole === '骑士'");
    const genericIdx = dvBlock.indexOf('有查杀 → 跟投查杀');
    expect(hunterBranchIdx).toBeGreaterThan(-1);
    expect(knightBranchIdx).toBeGreaterThan(hunterBranchIdx);
    expect(genericIdx).toBeGreaterThan(knightBranchIdx);
  });

  // ─── T6: hasUsedDuel 状态用于分支（骑士领袖/待用双状态） ───
  it('T6: DAY_VOTE 块内通过 currentPlayer?.hasUsedDuel 判断骑士状态', () => {
    expect(dvBlock).toContain('hasUsedDuel');
  });

});

describe('R63: 回归验证 — 前序骑士闭环未被破坏', () => {

  const knightSrc = readFileSync(
    path.resolve('src/services/rolePrompts/knight.js'),
    'utf-8'
  );

  it('T7: knight.js 仍含 knightHistoryStep（R44 DAY→DAY 闭环回归）', () => {
    expect(knightSrc).toContain('knightHistoryStep');
    const idx = knightSrc.indexOf('knightHistoryStep');
    const segment = knightSrc.slice(idx, idx + 700);
    expect(segment).toContain('决斗候选');
  });

  it('T8: knight.js 仍含 **追加不覆盖历史**（R60 格式要求回归）', () => {
    expect(knightSrc).toContain('**追加不覆盖历史**');
  });

  it('T9: aiPrompts.js hunterVoteStrategy 未被破坏（R62 回归）', () => {
    expect(dvBlock).toContain('hunterVoteStrategy');
    expect(dvBlock).toContain('开枪优先级：高');
  });

  it('T10: aiPrompts.js seerVoteStrategy 未被破坏（R27 回归）', () => {
    expect(dvBlock).toContain('seerVoteStrategy');
    expect(dvBlock).toContain('seerCounterClaimantsInVote');
  });

});
