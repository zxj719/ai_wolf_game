/**
 * gameSelectors.js — 权威派生数据选择器
 *
 * 柱一基础设施：所有"谁活着、谁死了、还剩几只狼"这类派生数据
 * 必须经由 selector 从 reducer 状态计算，禁止 hook 各自 filter。
 *
 * 使用约定：
 *   - selector 必须是纯函数，只读 state
 *   - 每次调用重新计算（目前无 memo），state 小开销可忽略
 *   - 调用方传入完整 state 或 state 的切片
 */

const WEREWOLF_ROLE = '狼人';

export function selectPlayers(state) {
  return state.players || [];
}

export function selectAlivePlayers(state) {
  return selectPlayers(state).filter(p => p.isAlive);
}

export function selectDeadPlayers(state) {
  return selectPlayers(state).filter(p => !p.isAlive);
}

export function selectAliveIds(state) {
  return selectAlivePlayers(state).map(p => p.id);
}

export function selectPlayerById(state, id) {
  return selectPlayers(state).find(p => p.id === id) || null;
}

export function selectIsAlive(state, id) {
  const p = selectPlayerById(state, id);
  return !!(p && p.isAlive);
}

export function selectAliveWolves(state) {
  return selectAlivePlayers(state).filter(p => p.role === WEREWOLF_ROLE);
}

export function selectAliveWolvesCount(state) {
  return selectAliveWolves(state).length;
}

export function selectTotalWolves(state) {
  return selectPlayers(state).filter(p => p.role === WEREWOLF_ROLE).length;
}

export function selectAliveGoodsCount(state) {
  return selectAlivePlayers(state).filter(p => p.role !== WEREWOLF_ROLE).length;
}

/**
 * 残局判定：剩余狼 ≤ 1 即进入残局模式
 * 柱四会用到，柱一先立选择器
 */
export function selectIsEndgame(state) {
  return selectAliveWolvesCount(state) <= 1;
}

export function selectRemainingWolvesCap(state) {
  return selectAliveWolvesCount(state);
}

export function selectIsWolfMajority(state) {
  return selectAliveWolvesCount(state) >= selectAliveGoodsCount(state);
}

/**
 * 是否已死（死亡记录存在）
 * 与 selectIsAlive 互为补：后者从 players 看，前者从 deathHistory 看
 * KILL_PLAYER 保证两者一致，此 selector 可用于 cross-check
 */
export function selectHasDeathRecord(state, playerId) {
  return (state.deathHistory || []).some(d => d.playerId === playerId);
}
