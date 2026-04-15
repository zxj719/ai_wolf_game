/**
 * 投票动作节点 —— 根据规则选择 targetId 并写入 bb.decision
 *
 * 所有动作都会：
 *   1. 过滤 validTargets（不能投自己、必须存活）
 *   2. 过滤已被当前玩家信任为金水的目标（避免投自己人）
 *   3. 加 10% 随机扰动（防止过于机械）
 */

import { action } from '../core/nodes.js';

// ────────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────────

function excludeTrustedGoldWaters(bb, candidates) {
  // 预言家不投自己的金水（硬约束）
  if (bb.state.self.role === '预言家') {
    const myGood = bb.state.myChecks.filter(c => !c.isWolf).map(c => c.targetId);
    return candidates.filter(id => !myGood.includes(id));
  }
  // 其他角色不投公开金水（软约束，允许对抗局打金水）
  if (bb.state.seerClaims.length === 1) {
    const good = bb.state.seerClaims[0].goldWaters;
    const filtered = candidates.filter(id => !good.includes(id));
    return filtered.length > 0 ? filtered : candidates;
  }
  return candidates;
}

/**
 * 在 candidates 中选一个，10% 概率选次优以增加随机性。
 * candidates 应已按优先级排序（首位最优）。
 */
function pickWithJitter(candidates) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (Math.random() < 0.10) {
    return candidates[1] ?? candidates[0];
  }
  return candidates[0];
}

// ────────────────────────────────────────────────
// 动作节点
// ────────────────────────────────────────────────

/** 投唯一跳预言家指出的查杀目标（最高优先级） */
export const voteSeerKill = action('投预言家查杀', bb => {
  const { seerClaims, validTargets } = bb.state;
  if (seerClaims.length !== 1) return false;

  const candidates = seerClaims[0].kills.filter(id => validTargets.includes(id));
  const filtered = excludeTrustedGoldWaters(bb, candidates);
  const target = pickWithJitter(filtered);
  if (target == null) return false;

  bb.setDecision(target, `跟随预言家${seerClaims[0].playerId}号查杀${target}号`);
  return true;
});

/** 多预言家对抗时，投后跳且怀疑分更高的那个 */
export const voteSuspiciousSeer = action('投对抗假预言家', bb => {
  const { seerClaims, suspicion, validTargets } = bb.state;
  if (seerClaims.length < 2) return false;

  const sorted = [...seerClaims].sort((a, b) => {
    const sa = suspicion.get(a.playerId) ?? 0;
    const sb = suspicion.get(b.playerId) ?? 0;
    return sb - sa; // 嫌疑高的在前
  });

  const candidates = sorted.map(c => c.playerId).filter(id => validTargets.includes(id));
  const target = pickWithJitter(candidates);
  if (target == null) return false;

  bb.setDecision(target, `${sorted.length}个预言家对抗，投嫌疑最高的${target}号`);
  return true;
});

/** 按怀疑分最高的目标投 */
export const voteHighestSuspicion = action('投最高嫌疑', bb => {
  const { suspicion, validTargets } = bb.state;
  const ranked = validTargets
    .map(id => ({ id, score: suspicion.get(id) ?? 0 }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);

  const candidates = excludeTrustedGoldWaters(bb, ranked.map(r => r.id));
  const target = pickWithJitter(candidates);
  if (target == null) return false;

  bb.setDecision(target, `场上怀疑集中在${target}号（嫌疑分${ranked[0]?.score}）`);
  return true;
});

/** 兜底：随机挑一个非金水的有效目标 */
export const voteRandom = action('随机兜底', bb => {
  const candidates = excludeTrustedGoldWaters(bb, bb.state.validTargets);
  if (candidates.length === 0) return false;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  bb.setDecision(target, '无明显线索，随机观察');
  return true;
});
