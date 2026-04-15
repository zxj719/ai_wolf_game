/**
 * 夜间行动专属条件节点
 */

import { condition } from '../core/nodes.js';

// ──────────────── 守卫 ────────────────

/** 场上存在唯一公开跳预言家且该玩家存活、不是昨晚守护目标 */
export const canGuardSeer = condition('可守公开预言家', bb => {
  const { seerClaims, aliveIds, cannotGuard } = bb.state;
  if (seerClaims.length !== 1) return false;
  const seerId = seerClaims[0].playerId;
  return aliveIds.includes(seerId) && seerId !== cannotGuard;
});

/** 场上存在公开金水玩家（被预言家声称验过的好人）且存活、不是昨晚守护目标 */
export const hasGuardableGoldWater = condition('可守公开金水', bb => {
  const { seerClaims, aliveIds, cannotGuard, self } = bb.state;
  for (const claim of seerClaims) {
    for (const gwId of claim.goldWaters) {
      if (aliveIds.includes(gwId) && gwId !== cannotGuard && gwId !== self.id) {
        return true;
      }
    }
  }
  return false;
});

// ──────────────── 预言家 ────────────────

/** 有多个预言家跳，且至少一个尚未被查验 */
export const hasUncheckSeerConflict = condition('对抗预言家未查', bb => {
  const { seerClaims, validTargets } = bb.state;
  if (seerClaims.length < 2) return false;
  return seerClaims.some(c => validTargets.includes(c.playerId));
});

/** 场上有嫌疑分 >= 30 且尚未被本预言家查验的目标 */
export const hasUncheckedSuspect = condition('有高嫌疑未查目标', bb => {
  const { suspicion, validTargets } = bb.state;
  for (const id of validTargets) {
    if ((suspicion.get(id) ?? 0) >= 30) return true;
  }
  return false;
});

// ──────────────── 女巫 ────────────────

/** 有解药且救人有价值（被刀目标是金水 / 第1夜 / 被刀的是唯一预言家） */
export const shouldSave = condition('应使用解药', bb => {
  const { canSave, dyingId, seerClaims, dayCount } = bb.state;
  if (!canSave || dyingId === null) return false;
  // 第一夜：保守策略，有药就救
  if (dayCount === 1) return true;
  // 被刀目标是公开金水
  const isGoldWater = seerClaims.some(c => c.goldWaters.includes(dyingId));
  if (isGoldWater) return true;
  // 被刀目标是唯一跳预言家
  const isSeer = seerClaims.length === 1 && seerClaims[0].playerId === dyingId;
  if (isSeer) return true;
  return false;
});

/** 有毒药且存在明确查杀目标（预言家指名、且仍存活、且在有效毒药目标里） */
export const hasPoisonTarget = condition('有可毒查杀目标', bb => {
  const { hasPoison, seerClaims, validTargets } = bb.state;
  if (!hasPoison) return false;
  for (const claim of seerClaims) {
    if (claim.kills.some(id => validTargets.includes(id))) return true;
  }
  return false;
});

/** 有毒药且有高嫌疑目标（fallback：没有明确查杀时的次优选择） */
export const hasPoisonHighSuspicion = condition('有可毒高嫌疑', bb => {
  const { hasPoison, suspicion, validTargets } = bb.state;
  if (!hasPoison) return false;
  return validTargets.some(id => (suspicion.get(id) ?? 0) >= 40);
});
