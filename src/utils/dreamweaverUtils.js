/**
 * 摄梦人相关工具函数
 * 处理入梦验证、连梦判定、免疫效果、同生共死
 */

/**
 * 验证入梦目标是否合法
 * @param {number} targetId - 入梦目标ID
 * @param {number} dreamweaverId - 摄梦人ID
 * @param {Array} players - 所有玩家
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateDreamTarget(targetId, dreamweaverId, players) {
  if (targetId === null || targetId === undefined) {
    return { valid: false, reason: '必须选择入梦目标（每晚强制入梦）' };
  }

  if (targetId === dreamweaverId) {
    return { valid: false, reason: '摄梦人不能入梦自己' };
  }

  const target = players.find(p => p.id === targetId);
  if (!target) {
    return { valid: false, reason: `目标玩家 ${targetId} 不存在` };
  }

  if (!target.isAlive) {
    return { valid: false, reason: `目标玩家 ${targetId} 已死亡` };
  }

  return { valid: true };
}

/**
 * 判断是否为连梦（连续两晚入梦同一人）
 * @param {number} targetId - 今晚入梦目标
 * @param {number|null} lastDreamTarget - 上一晚入梦目标
 * @returns {boolean}
 */
export function isConsecutiveDream(targetId, lastDreamTarget) {
  return lastDreamTarget !== null && targetId === lastDreamTarget;
}

/**
 * 检查入梦者是否免疫攻击
 * @param {number} attackTargetId - 被攻击的目标ID
 * @param {number|null} dreamTargetId - 被入梦的目标ID
 * @returns {boolean} 是否免疫
 */
export function isDreamImmune(attackTargetId, dreamTargetId) {
  if (dreamTargetId === null || dreamTargetId === undefined) {
    return false;
  }
  return attackTargetId === dreamTargetId;
}

/**
 * 应用摄梦人效果到夜间结算
 * 核心结算逻辑：
 * 1. 连梦必死：连续两晚入梦同一人 → 该人死亡（无法被救）
 * 2. 免疫效果：被入梦者免疫狼刀和毒药（除非是连梦击杀）
 * 3. 同生共死：摄梦人死亡 → 被入梦者也死亡
 *
 * @param {Object} params
 * @param {number|null} params.dreamTargetId - 今晚入梦目标
 * @param {number|null} params.lastDreamTarget - 上一晚入梦目标
 * @param {number|null} params.wolfTargetId - 狼人袭击目标（交换后）
 * @param {number|null} params.witchPoisonId - 女巫毒药目标
 * @param {boolean} params.isDreamweaverDead - 摄梦人本轮是否死亡（被狼刀/毒杀等）
 * @returns {Object} {
 *   immuneFromWolf: boolean,     // 是否免疫狼刀
 *   immuneFromPoison: boolean,   // 是否免疫毒药
 *   consecutiveKill: number|null, // 连梦击杀的目标ID
 *   sympathyDeath: number|null   // 同生共死的目标ID
 * }
 */
export function resolveDreamweaverEffects(params) {
  const {
    dreamTargetId,
    lastDreamTarget,
    wolfTargetId,
    witchPoisonId,
    isDreamweaverDead
  } = params;

  const result = {
    immuneFromWolf: false,
    immuneFromPoison: false,
    consecutiveKill: null,
    sympathyDeath: null
  };

  // 如果没有入梦目标，无任何效果
  if (dreamTargetId === null || dreamTargetId === undefined) {
    return result;
  }

  // 1. 连梦必死判定（优先级最高）
  const consecutive = isConsecutiveDream(dreamTargetId, lastDreamTarget);
  if (consecutive) {
    result.consecutiveKill = dreamTargetId;
    // 连梦击杀时，不提供免疫效果（目标直接死亡，无法被救）
    return result;
  }

  // 2. 免疫效果（非连梦情况下）
  if (wolfTargetId !== null && isDreamImmune(wolfTargetId, dreamTargetId)) {
    result.immuneFromWolf = true;
  }

  if (witchPoisonId !== null && isDreamImmune(witchPoisonId, dreamTargetId)) {
    result.immuneFromPoison = true;
  }

  // 3. 同生共死判定
  if (isDreamweaverDead) {
    result.sympathyDeath = dreamTargetId;
  }

  return result;
}

/**
 * 更新摄梦人历史记录
 * @param {Object} dreamweaverHistory - 当前历史
 * @param {number|null} dreamTargetId - 本晚入梦目标
 * @returns {Object} 更新后的历史
 */
export function updateDreamweaverHistory(dreamweaverHistory, dreamTargetId) {
  const history = dreamweaverHistory || { dreamedPlayers: [], lastDreamTarget: null, currentDreamTarget: null };

  if (dreamTargetId === null || dreamTargetId === undefined) {
    return {
      ...history,
      lastDreamTarget: null,
      currentDreamTarget: null
    };
  }

  const newDreamedPlayers = history.dreamedPlayers.includes(dreamTargetId)
    ? [...history.dreamedPlayers]
    : [...history.dreamedPlayers, dreamTargetId];

  return {
    dreamedPlayers: newDreamedPlayers,
    lastDreamTarget: dreamTargetId,
    currentDreamTarget: dreamTargetId
  };
}

/**
 * 获取摄梦人可入梦的目标列表
 * @param {Array} players - 所有玩家
 * @param {number} dreamweaverId - 摄梦人ID
 * @returns {Array} 可入梦的玩家ID列表
 */
export function getValidDreamTargets(players, dreamweaverId) {
  return players
    .filter(p => p.isAlive && p.id !== dreamweaverId)
    .map(p => p.id);
}
