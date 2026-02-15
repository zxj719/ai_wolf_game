/**
 * 魔术师交换相关工具函数
 * 处理目标重定向逻辑
 */

/**
 * 应用魔术师交换，重定向目标
 * @param {number|null} targetId - 原始目标ID
 * @param {Object|null} swap - 魔术师的交换对象 { player1Id, player2Id }
 * @returns {number|null} 重定向后的目标ID
 */
export function applyMagicianSwap(targetId, swap) {
  // 如果没有交换，或目标为null，直接返回原目标
  if (!swap || targetId === null || targetId === undefined) {
    return targetId;
  }

  const { player1Id, player2Id } = swap;

  // 如果交换信息不完整，返回原目标
  if (player1Id === null || player2Id === null) {
    return targetId;
  }

  // 应用交换重定向
  if (targetId === player1Id) {
    return player2Id;
  } else if (targetId === player2Id) {
    return player1Id;
  }

  // 目标不在交换范围内，返回原目标
  return targetId;
}

/**
 * 验证魔术师交换是否合法
 * @param {Object} swap - 交换对象 { player1Id, player2Id }
 * @param {Object} magicianHistory - 魔术师历史记录
 * @param {Array} alivePlayers - 存活玩家列表
 * @returns {Object} { valid: boolean, reason: string }
 */
export function validateMagicianSwap(swap, magicianHistory, alivePlayers) {
  const { player1Id, player2Id } = swap;

  // 允许不交换（null, null）
  if (player1Id === null && player2Id === null) {
    return { valid: true };
  }

  // 必须交换两个不同的玩家
  if (player1Id === player2Id) {
    return { valid: false, reason: '不能交换同一个玩家' };
  }

  // 必须都是有效的玩家ID
  if (player1Id === null || player2Id === null) {
    return { valid: false, reason: '交换目标不完整' };
  }

  // 检查玩家是否存活
  const aliveIds = alivePlayers.filter(p => p.isAlive).map(p => p.id);
  if (!aliveIds.includes(player1Id) || !aliveIds.includes(player2Id)) {
    return { valid: false, reason: '交换目标必须是存活玩家' };
  }

  // 检查整局限制：每个号码只能被交换一次
  const { swappedPlayers } = magicianHistory;
  if (swappedPlayers.includes(player1Id)) {
    return { valid: false, reason: `${player1Id}号已被交换过，不能再次交换` };
  }
  if (swappedPlayers.includes(player2Id)) {
    return { valid: false, reason: `${player2Id}号已被交换过，不能再次交换` };
  }

  // 检查连续限制：不能连续两晚交换同一个人
  const { lastSwap } = magicianHistory;
  if (lastSwap && lastSwap.player1Id !== null) {
    const lastSwappedIds = [lastSwap.player1Id, lastSwap.player2Id];
    if (lastSwappedIds.includes(player1Id) || lastSwappedIds.includes(player2Id)) {
      return {
        valid: false,
        reason: `不能连续两晚交换 ${lastSwap.player1Id}号 或 ${lastSwap.player2Id}号`
      };
    }
  }

  return { valid: true };
}

/**
 * 更新魔术师历史记录
 * @param {Object} magicianHistory - 当前历史记录
 * @param {Object} swap - 本轮交换 { player1Id, player2Id }
 * @returns {Object} 更新后的历史记录
 */
export function updateMagicianHistory(magicianHistory, swap) {
  const { player1Id, player2Id } = swap;

  // 如果没有交换，只更新 lastSwap
  if (player1Id === null || player2Id === null) {
    return {
      ...magicianHistory,
      lastSwap: { player1Id: null, player2Id: null }
    };
  }

  // 添加到已交换列表
  const newSwappedPlayers = [
    ...magicianHistory.swappedPlayers,
    player1Id,
    player2Id
  ];

  return {
    swappedPlayers: newSwappedPlayers,
    lastSwap: { player1Id, player2Id }
  };
}

/**
 * 获取魔术师可交换的目标列表
 * @param {Array} players - 所有玩家
 * @param {Object} magicianHistory - 魔术师历史记录
 * @returns {Array} 可交换的玩家ID列表
 */
export function getValidSwapTargets(players, magicianHistory) {
  const { swappedPlayers, lastSwap } = magicianHistory;

  // 排除：已死亡、已被交换过、上一晚被交换的
  const excludedIds = new Set([
    ...swappedPlayers,
    ...(lastSwap && lastSwap.player1Id !== null
      ? [lastSwap.player1Id, lastSwap.player2Id]
      : [])
  ]);

  return players
    .filter(p => p.isAlive && !excludedIds.has(p.id))
    .map(p => p.id);
}
