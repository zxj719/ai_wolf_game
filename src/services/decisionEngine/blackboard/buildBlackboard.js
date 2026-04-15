/**
 * Blackboard 构造器 —— 把 reducer state 转成角色视角的只读视图
 *
 * 重要约定：
 *   - 绝不修改原 state
 *   - 按角色过滤不可见信息（村民看不到 seerChecks 原文，只能通过 speechHistory）
 *   - 派生指标（suspicion / trust）在 derivations.js 里计算
 */

import { computeSuspicionScores, computeTrustScores, parseSeerClaims } from './derivations.js';

/**
 * @param {Object} gameState - 游戏状态快照
 *   { players, speechHistory, voteHistory, deathHistory, seerChecks, dayCount, ... }
 * @param {Object} self - 当前决策玩家 (player 对象)
 * @param {Object} params - 额外参数 { validTargets, ... }
 * @returns {Object} Blackboard
 */
export function buildBlackboard(gameState, self, params = {}) {
  const { players, speechHistory = [], voteHistory = [], seerChecks = [], dayCount = 1 } = gameState;

  const alivePlayers = players.filter(p => p.isAlive);
  const aliveIds = alivePlayers.map(p => p.id);

  const validTargets = params.validTargets
    ?? aliveIds.filter(id => id !== self.id);

  // 按角色过滤私密信息
  const mySeerChecks = self.role === '预言家'
    ? seerChecks.filter(c => c.seerId === self.id)
    : [];

  // 从发言历史里解析出所有跳预言家的 claim
  const seerClaims = parseSeerClaims(speechHistory);

  // 狼人私密信息（仅狼人可见自己队友）
  const wolfTeammates = self.role === '狼人'
    ? players.filter(p => p.isAlive && p.role === '狼人' && p.id !== self.id).map(p => p.id)
    : [];

  // 当天已发言的狼队友（用于 shadow_teammate 策略判断）
  const spokenWolfTeammates = wolfTeammates.filter(id =>
    speechHistory.some(s => s.day === (params.currentDay ?? gameState?.dayCount ?? dayCount) && s.playerId === id)
  );

  const state = {
    self,
    dayCount,
    alivePlayers,
    aliveIds,
    validTargets,
    speechHistory,
    voteHistory,
    // 当前玩家可见的查验信息（仅预言家有）
    myChecks: mySeerChecks,
    // 公开的预言家跳身份（全角色可见）
    seerClaims,
    // 狼人私密信息
    wolfTeammates,
    spokenWolfTeammates,
    // 夜间专属参数（由各角色行动点传入）
    cannotGuard: params.cannotGuard ?? null,   // 守卫：上晚守护目标
    dyingId:     params.dyingId     ?? null,   // 女巫：本晚被刀目标
    canSave:     params.canSave     ?? false,  // 女巫：是否还有解药
    hasPoison:   params.hasPoison   ?? false,  // 女巫：是否还有毒药
  };

  // 派生分数
  state.suspicion = computeSuspicionScores(state);
  state.trust = computeTrustScores(state);

  return {
    state,
    decision: null,
    trace: [],
    /**
     * 写入决策结果（两种用法）：
     *   bb.setDecision(targetId, reasoning)          — 只有目标 ID（守卫/预言家/投票）
     *   bb.setDecision({ useSave, usePoison }, reasoning) — 任意结构（女巫）
     */
    setDecision(dataOrId, reasoning) {
      const data = typeof dataOrId === 'object' && dataOrId !== null
        ? dataOrId
        : { targetId: dataOrId };
      this.decision = { ...data, reasoning, path: [...this.trace] };
    }
  };
}
