/**
 * 狼人专属条件节点
 *
 * 关键前提：wolfTeammates / spokenWolfTeammates 在 Blackboard 里由
 * buildBlackboard 自动注入（role === '狼人' 时）。
 */

import { condition } from '../core/nodes.js';

// ────────────────────────────────────────────────
// 投票条件
// ────────────────────────────────────────────────

/** 有非队友的有效投票目标 */
export const hasWolfSafeTarget = condition('有非队友可投目标', bb => {
  const { wolfTeammates, validTargets } = bb.state;
  return validTargets.some(id => !wolfTeammates.includes(id));
});

/** 场上唯一跳预言家且其在可投目标中（值得杀的信息源） */
export const seerClaimInValidTargets = condition('跳预言家在可投范围', bb => {
  const { seerClaims, validTargets, wolfTeammates } = bb.state;
  if (seerClaims.length !== 1) return false;
  const seerId = seerClaims[0].playerId;
  return validTargets.includes(seerId) && !wolfTeammates.includes(seerId);
});

/** 有公开金水玩家在可投目标中（消灭验证好人） */
export const goldWaterInValidTargets = condition('金水在可投范围', bb => {
  const { seerClaims, validTargets, wolfTeammates } = bb.state;
  for (const claim of seerClaims) {
    if (claim.goldWaters.some(id => validTargets.includes(id) && !wolfTeammates.includes(id))) {
      return true;
    }
  }
  return false;
});

// ────────────────────────────────────────────────
// 发言策略条件
// ────────────────────────────────────────────────

/** 目前没有玩家跳预言家（悍跳机会窗口） */
export const noSeerClaimYet = condition('场上无预言家跳身份', bb =>
  bb.state.seerClaims.length === 0
);

/** 恰好有 1 个预言家跳，可以对抗跳 */
export const exactlyOneSeerClaim = condition('场上恰好1个预言家', bb =>
  bb.state.seerClaims.length === 1
);

/** 有狼队友今天已发言（可以 shadow） */
export const hasSpokenWolfTeammate = condition('有已发言狼队友', bb =>
  bb.state.spokenWolfTeammates.length > 0
);

/** 狼队数量 ≥ 好人数量 (优势局，可激进推票) */
export const wolvesInMajority = condition('狼队占多数', bb => {
  const { alivePlayers } = bb.state;
  const wolves = alivePlayers.filter(p => p.role === '狼人').length;
  const good = alivePlayers.filter(p => p.role !== '狼人').length;
  return wolves >= good;
});
