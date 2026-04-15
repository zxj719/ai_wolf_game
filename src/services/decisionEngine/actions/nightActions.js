/**
 * 夜间行动原子动作节点
 *
 * 守卫  → setDecision(targetId, reason)
 * 预言家 → setDecision(targetId, reason)
 * 女巫  → setDecision({ useSave, usePoison }, reason)
 */

import { action } from '../core/nodes.js';

// ────────────────────────────────────────────────
// 守卫动作
// ────────────────────────────────────────────────

/** 守唯一公开预言家 */
export const guardSeerClaimant = action('守公开预言家', bb => {
  const { seerClaims, aliveIds, cannotGuard } = bb.state;
  if (seerClaims.length !== 1) return false;
  const seerId = seerClaims[0].playerId;
  if (!aliveIds.includes(seerId) || seerId === cannotGuard) return false;
  bb.setDecision(seerId, `守护唯一预言家${seerId}号`);
  return true;
});

/** 守随机公开金水（排除昨晚守护目标） */
export const guardGoldWater = action('守公开金水', bb => {
  const { seerClaims, aliveIds, cannotGuard, self } = bb.state;
  const candidates = [];
  for (const claim of seerClaims) {
    claim.goldWaters.forEach(id => {
      if (aliveIds.includes(id) && id !== cannotGuard && id !== self.id) {
        candidates.push(id);
      }
    });
  }
  if (candidates.length === 0) return false;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  bb.setDecision(target, `守护金水${target}号`);
  return true;
});

/** 守随机存活玩家（兜底，排除昨晚守护目标） */
export const guardRandom = action('守随机存活', bb => {
  const { aliveIds, cannotGuard, self } = bb.state;
  const candidates = aliveIds.filter(id => id !== cannotGuard && id !== self.id);
  if (candidates.length === 0) {
    // 所有人都是昨晚目标（极端情况）→ 空守
    bb.setDecision(null, '无合法守护目标，空守');
    return true;
  }
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  bb.setDecision(target, `守护随机目标${target}号`);
  return true;
});

// ────────────────────────────────────────────────
// 预言家动作
// ────────────────────────────────────────────────

/** 查最可疑且未查过的目标（嫌疑分最高） */
export const checkHighestSuspicion = action('查高嫌疑目标', bb => {
  const { suspicion, validTargets } = bb.state;
  const ranked = validTargets
    .map(id => ({ id, score: suspicion.get(id) ?? 0 }))
    .filter(e => e.score >= 30)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return false;
  // 10% 随机选次优
  const target = ranked.length > 1 && Math.random() < 0.1
    ? ranked[1].id
    : ranked[0].id;
  bb.setDecision(target, `查验嫌疑最高的${target}号（分数${ranked[0].score}）`);
  return true;
});

/** 对抗局：查嫌疑更高的那个对立预言家 */
export const checkSuspiciousSeer = action('查对抗假预言家', bb => {
  const { seerClaims, suspicion, validTargets } = bb.state;
  const candidates = seerClaims
    .map(c => ({ id: c.playerId, score: suspicion.get(c.playerId) ?? 0 }))
    .filter(e => validTargets.includes(e.id))
    .sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return false;
  const target = candidates[0].id;
  bb.setDecision(target, `对抗局，查嫌疑较高的预言家${target}号`);
  return true;
});

/** 兜底：随机查未验过的目标 */
export const checkRandom = action('随机查验兜底', bb => {
  const { validTargets } = bb.state;
  if (validTargets.length === 0) return false;
  const target = validTargets[Math.floor(Math.random() * validTargets.length)];
  bb.setDecision(target, `无明显线索，随机查验${target}号`);
  return true;
});

// ────────────────────────────────────────────────
// 女巫动作
// ────────────────────────────────────────────────

/** 使用解药 */
export const useSavePotion = action('使用解药', bb => {
  const { canSave, dyingId } = bb.state;
  if (!canSave || dyingId === null) return false;
  bb.setDecision({ useSave: true, usePoison: null }, `使用解药救${dyingId}号`);
  return true;
});

/** 使用毒药：优先毒预言家指名查杀的目标 */
export const usePoisonOnSeerKill = action('毒查杀目标', bb => {
  const { hasPoison, seerClaims, validTargets } = bb.state;
  if (!hasPoison) return false;
  const killTargets = [];
  seerClaims.forEach(c => c.kills.forEach(id => {
    if (validTargets.includes(id)) killTargets.push(id);
  }));
  if (killTargets.length === 0) return false;
  const target = killTargets[Math.floor(Math.random() * killTargets.length)];
  bb.setDecision({ useSave: false, usePoison: target }, `毒查杀目标${target}号`);
  return true;
});

/** 使用毒药：毒最高嫌疑目标 */
export const usePoisonHighSuspicion = action('毒高嫌疑', bb => {
  const { hasPoison, suspicion, validTargets } = bb.state;
  if (!hasPoison) return false;
  const ranked = validTargets
    .map(id => ({ id, score: suspicion.get(id) ?? 0 }))
    .filter(e => e.score >= 40)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return false;
  const target = ranked[0].id;
  bb.setDecision({ useSave: false, usePoison: target }, `毒高嫌疑目标${target}号（分数${ranked[0].score}）`);
  return true;
});

/** 什么都不做（女巫兜底） */
export const doNothing = action('不使用药水', bb => {
  bb.setDecision({ useSave: false, usePoison: null }, '本晚不使用药水，留作后用');
  return true;
});
