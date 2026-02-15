/**
 * 骑士决斗相关工具函数
 * 处理决斗目标验证、结果判定、玩家淘汰逻辑
 */

/**
 * 验证骑士决斗是否合法
 * @param {Object} knight - 骑士玩家对象
 * @param {number} targetId - 决斗目标ID
 * @param {Array} players - 所有玩家列表
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateKnightDuel(knight, targetId, players) {
  // 检查骑士是否还活着
  if (!knight.isAlive) {
    return { valid: false, reason: '骑士已死亡，无法决斗' };
  }

  // 检查是否已使用过决斗
  if (knight.hasUsedDuel) {
    return { valid: false, reason: '骑士已使用过决斗技能（整局仅一次）' };
  }

  // 检查目标是否有效
  if (targetId === null || targetId === undefined) {
    return { valid: false, reason: '决斗目标不能为空' };
  }

  // 检查目标玩家是否存在
  const target = players.find(p => p.id === targetId);
  if (!target) {
    return { valid: false, reason: `目标玩家 ${targetId} 不存在` };
  }

  // 检查目标是否存活
  if (!target.isAlive) {
    return { valid: false, reason: `目标玩家 ${targetId} 已死亡` };
  }

  // 检查是否对自己决斗
  if (knight.id === targetId) {
    return { valid: false, reason: '不能对自己决斗' };
  }

  return { valid: true };
}

/**
 * 执行骑士决斗，判定结果并返回
 * @param {Object} knight - 骑士玩家对象
 * @param {Object} target - 决斗目标玩家对象
 * @param {string} ROLE_DEFINITIONS - 角色定义常量
 * @returns {Object} {
 *   success: boolean,
 *   targetIsWolf: boolean,
 *   killedPlayer: Object,
 *   message: string
 * }
 */
export function executeDuel(knight, target, ROLE_DEFINITIONS) {
  const targetIsWolf = target.role === ROLE_DEFINITIONS.WEREWOLF;

  if (targetIsWolf) {
    // 目标是狼人：狼人出局，骑士胜利
    return {
      success: true,
      targetIsWolf: true,
      killedPlayer: target,
      survivor: knight,
      message: `决斗成功！${target.id}号是狼人，被骑士淘汰！`
    };
  } else {
    // 目标是好人：骑士羞愧自刎
    return {
      success: false,
      targetIsWolf: false,
      killedPlayer: knight,
      survivor: target,
      message: `决斗失败！${target.id}号是好人，骑士羞愧自刎。`
    };
  }
}

/**
 * 应用决斗结果到玩家状态
 * @param {Array} players - 玩家列表
 * @param {Object} duelResult - 决斗结果对象
 * @param {number} knightId - 骑士ID
 * @returns {Array} 更新后的玩家列表
 */
export function applyDuelResult(players, duelResult, knightId) {
  return players.map(p => {
    if (p.id === knightId) {
      // 标记骑士已使用决斗
      return { ...p, hasUsedDuel: true };
    }
    if (p.id === duelResult.killedPlayer.id) {
      // 淘汰被击杀的玩家
      return { ...p, isAlive: false };
    }
    return p;
  });
}

/**
 * 获取骑士可决斗的目标列表
 * @param {Array} players - 所有玩家
 * @param {number} knightId - 骑士ID
 * @returns {Array} 可决斗的玩家ID列表
 */
export function getValidDuelTargets(players, knightId) {
  return players
    .filter(p => p.isAlive && p.id !== knightId)
    .map(p => p.id);
}
