/**
 * P1-2: 贝叶斯身份推断模块
 *
 * 基于报告理论：
 * P(Role_i | Action_j) = P(Action_j | Role_i) * P(Role_i) / P(Action_j)
 *
 * - 先验概率 P(Role_i)：基于游戏配置的初始身份分布
 * - 似然度 P(Action_j | Role_i)：特定身份采取特定行动的概率
 * - 后验概率：根据观测行为动态更新
 */

import { ROLE_DEFINITIONS } from '../config/roles';

// ============================================================
// 角色配置
// ============================================================

export const ROLE_TYPES = {
  WEREWOLF: ROLE_DEFINITIONS.WEREWOLF,    // 狼人
  VILLAGER: ROLE_DEFINITIONS.VILLAGER,    // 村民
  SEER: ROLE_DEFINITIONS.SEER,            // 预言家
  WITCH: ROLE_DEFINITIONS.WITCH,          // 女巫
  HUNTER: ROLE_DEFINITIONS.HUNTER,        // 猎人
  GUARD: ROLE_DEFINITIONS.GUARD           // 守卫
};

// 阵营分类
export const FACTIONS = {
  GOOD: [ROLE_TYPES.VILLAGER, ROLE_TYPES.SEER, ROLE_TYPES.WITCH, ROLE_TYPES.HUNTER, ROLE_TYPES.GUARD],
  EVIL: [ROLE_TYPES.WEREWOLF]
};

// ============================================================
// 行为-角色似然度矩阵
// ============================================================

/**
 * 行为类型定义
 * 每种行为在不同角色下的发生概率
 */
export const ACTION_TYPES = {
  CLAIM_SEER: 'claim_seer',           // 声称预言家
  CLAIM_WITCH: 'claim_witch',         // 声称女巫
  CLAIM_HUNTER: 'claim_hunter',       // 声称猎人
  CLAIM_GUARD: 'claim_guard',         // 声称守卫
  CLAIM_VILLAGER: 'claim_villager',   // 声称村民
  ACCUSE_PLAYER: 'accuse',            // 指控他人
  DEFEND_PLAYER: 'defend',            // 为他人辩护
  VOTE_GOLD_WATER: 'vote_gold',       // 投票给金水
  VOTE_KILLED: 'vote_killed',         // 投票给被查杀者
  AGGRESSIVE_SPEECH: 'aggressive',    // 攻击性发言
  PASSIVE_SPEECH: 'passive',          // 划水发言
  LOGICAL_SPEECH: 'logical',          // 逻辑清晰发言
  EMOTIONAL_SPEECH: 'emotional',      // 情绪化发言
  FIRST_NIGHT_DEATH: 'first_death',   // 首夜被刀
  LATER_DEATH: 'later_death',         // 后续被刀
  CONSISTENT_BEHAVIOR: 'consistent',  // 言行一致
  INCONSISTENT_BEHAVIOR: 'inconsistent' // 言行不一
};

/**
 * 似然度矩阵
 * P(Action | Role): 给定角色时，采取特定行动的概率
 * 值范围 [0, 1]
 */
const LIKELIHOOD_MATRIX = {
  [ACTION_TYPES.CLAIM_SEER]: {
    [ROLE_TYPES.SEER]: 0.95,      // 真预言家几乎必跳
    [ROLE_TYPES.WEREWOLF]: 0.25,  // 狼人可能悍跳
    [ROLE_TYPES.VILLAGER]: 0.02,  // 平民极少跳预言家
    [ROLE_TYPES.WITCH]: 0.01,
    [ROLE_TYPES.HUNTER]: 0.01,
    [ROLE_TYPES.GUARD]: 0.01
  },
  [ACTION_TYPES.CLAIM_WITCH]: {
    [ROLE_TYPES.WITCH]: 0.7,      // 女巫通常后期才跳
    [ROLE_TYPES.WEREWOLF]: 0.1,
    [ROLE_TYPES.VILLAGER]: 0.01,
    [ROLE_TYPES.SEER]: 0.01,
    [ROLE_TYPES.HUNTER]: 0.01,
    [ROLE_TYPES.GUARD]: 0.01
  },
  [ACTION_TYPES.CLAIM_HUNTER]: {
    [ROLE_TYPES.HUNTER]: 0.6,     // 猎人视情况跳
    [ROLE_TYPES.WEREWOLF]: 0.05,
    [ROLE_TYPES.VILLAGER]: 0.01,
    [ROLE_TYPES.SEER]: 0.01,
    [ROLE_TYPES.WITCH]: 0.01,
    [ROLE_TYPES.GUARD]: 0.01
  },
  [ACTION_TYPES.CLAIM_GUARD]: {
    [ROLE_TYPES.GUARD]: 0.4,      // 守卫通常隐藏
    [ROLE_TYPES.WEREWOLF]: 0.03,
    [ROLE_TYPES.VILLAGER]: 0.01,
    [ROLE_TYPES.SEER]: 0.01,
    [ROLE_TYPES.WITCH]: 0.01,
    [ROLE_TYPES.HUNTER]: 0.01
  },
  [ACTION_TYPES.CLAIM_VILLAGER]: {
    [ROLE_TYPES.VILLAGER]: 0.8,
    [ROLE_TYPES.WEREWOLF]: 0.6,   // 狼人常称村民
    [ROLE_TYPES.SEER]: 0.05,      // 神职不会称村民
    [ROLE_TYPES.WITCH]: 0.3,      // 女巫可能隐藏
    [ROLE_TYPES.HUNTER]: 0.3,
    [ROLE_TYPES.GUARD]: 0.5
  },
  [ACTION_TYPES.VOTE_GOLD_WATER]: {
    [ROLE_TYPES.WEREWOLF]: 0.15,  // 狼人可能投金水
    [ROLE_TYPES.VILLAGER]: 0.05,
    [ROLE_TYPES.SEER]: 0.01,      // 预言家绝不投自己金水
    [ROLE_TYPES.WITCH]: 0.05,
    [ROLE_TYPES.HUNTER]: 0.05,
    [ROLE_TYPES.GUARD]: 0.05
  },
  [ACTION_TYPES.VOTE_KILLED]: {
    [ROLE_TYPES.WEREWOLF]: 0.3,   // 狼人投给查杀保队友
    [ROLE_TYPES.VILLAGER]: 0.7,   // 好人投查杀
    [ROLE_TYPES.SEER]: 0.85,
    [ROLE_TYPES.WITCH]: 0.7,
    [ROLE_TYPES.HUNTER]: 0.7,
    [ROLE_TYPES.GUARD]: 0.7
  },
  [ACTION_TYPES.AGGRESSIVE_SPEECH]: {
    [ROLE_TYPES.WEREWOLF]: 0.4,   // 狼人可能带节奏
    [ROLE_TYPES.VILLAGER]: 0.3,
    [ROLE_TYPES.SEER]: 0.6,       // 预言家常强势
    [ROLE_TYPES.WITCH]: 0.3,
    [ROLE_TYPES.HUNTER]: 0.4,
    [ROLE_TYPES.GUARD]: 0.2
  },
  [ACTION_TYPES.PASSIVE_SPEECH]: {
    [ROLE_TYPES.WEREWOLF]: 0.35,  // 深水狼划水
    [ROLE_TYPES.VILLAGER]: 0.4,
    [ROLE_TYPES.SEER]: 0.05,      // 预言家不应划水
    [ROLE_TYPES.WITCH]: 0.3,
    [ROLE_TYPES.HUNTER]: 0.2,
    [ROLE_TYPES.GUARD]: 0.4       // 守卫可能低调
  },
  [ACTION_TYPES.LOGICAL_SPEECH]: {
    [ROLE_TYPES.WEREWOLF]: 0.5,
    [ROLE_TYPES.VILLAGER]: 0.5,
    [ROLE_TYPES.SEER]: 0.8,       // 预言家逻辑清晰
    [ROLE_TYPES.WITCH]: 0.6,
    [ROLE_TYPES.HUNTER]: 0.5,
    [ROLE_TYPES.GUARD]: 0.5
  },
  [ACTION_TYPES.FIRST_NIGHT_DEATH]: {
    [ROLE_TYPES.WEREWOLF]: 0.01,  // 狼人不会被刀
    [ROLE_TYPES.VILLAGER]: 0.15,
    [ROLE_TYPES.SEER]: 0.3,       // 预言家容易首刀
    [ROLE_TYPES.WITCH]: 0.25,
    [ROLE_TYPES.HUNTER]: 0.15,
    [ROLE_TYPES.GUARD]: 0.15
  },
  [ACTION_TYPES.INCONSISTENT_BEHAVIOR]: {
    [ROLE_TYPES.WEREWOLF]: 0.35,  // 狼人更容易言行不一
    [ROLE_TYPES.VILLAGER]: 0.15,
    [ROLE_TYPES.SEER]: 0.1,
    [ROLE_TYPES.WITCH]: 0.15,
    [ROLE_TYPES.HUNTER]: 0.15,
    [ROLE_TYPES.GUARD]: 0.15
  }
};

// ============================================================
// 贝叶斯推断核心
// ============================================================

/**
 * 创建玩家身份概率分布
 * @param {number} playerId - 玩家ID
 * @param {Object} gameSetup - 游戏配置（角色分布）
 * @returns {Object} 身份概率分布
 */
export const createIdentityDistribution = (playerId, gameSetup) => {
  const { STANDARD_ROLES, TOTAL_PLAYERS } = gameSetup;

  // 计算先验概率（基于角色数量）
  const roleCounts = {};
  STANDARD_ROLES.forEach(role => {
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  const priors = {};
  Object.entries(roleCounts).forEach(([role, count]) => {
    priors[role] = count / TOTAL_PLAYERS;
  });

  return {
    playerId,
    priors,                           // 先验概率
    posteriors: { ...priors },        // 后验概率（初始等于先验）
    observedActions: [],              // 已观测行为
    lastUpdated: Date.now()
  };
};

/**
 * 初始化所有玩家的身份分布
 * @param {Object[]} players - 玩家列表
 * @param {Object} gameSetup - 游戏配置
 * @returns {Object} playerId -> IdentityDistribution 映射
 */
export const initializeIdentityDistributions = (players, gameSetup) => {
  const distributions = {};
  players.forEach(p => {
    distributions[p.id] = createIdentityDistribution(p.id, gameSetup);
  });
  return distributions;
};

/**
 * 贝叶斯更新：根据观测行为更新后验概率
 * P(Role | Action) = P(Action | Role) * P(Role) / P(Action)
 *
 * @param {Object} distribution - 当前身份分布
 * @param {string} actionType - 观测到的行为类型
 * @param {Object} context - 行为上下文（可选）
 * @returns {Object} 更新后的分布
 */
export const bayesianUpdate = (distribution, actionType, context = {}) => {
  const { posteriors } = distribution;
  const likelihoods = LIKELIHOOD_MATRIX[actionType];

  if (!likelihoods) {
    console.warn(`Unknown action type: ${actionType}`);
    return distribution;
  }

  // 计算 P(Action) = Σ P(Action|Role) * P(Role)
  let pAction = 0;
  Object.entries(posteriors).forEach(([role, pRole]) => {
    const pActionGivenRole = likelihoods[role] || 0.1;
    pAction += pActionGivenRole * pRole;
  });

  // 避免除零
  if (pAction === 0) pAction = 0.001;

  // 更新后验概率
  const newPosteriors = {};
  Object.entries(posteriors).forEach(([role, pRole]) => {
    const pActionGivenRole = likelihoods[role] || 0.1;
    // 贝叶斯公式
    newPosteriors[role] = (pActionGivenRole * pRole) / pAction;
  });

  // 归一化确保总和为1
  const total = Object.values(newPosteriors).reduce((a, b) => a + b, 0);
  Object.keys(newPosteriors).forEach(role => {
    newPosteriors[role] /= total;
  });

  return {
    ...distribution,
    posteriors: newPosteriors,
    observedActions: [...distribution.observedActions, { actionType, context, timestamp: Date.now() }],
    lastUpdated: Date.now()
  };
};

/**
 * 批量更新：处理多个观测行为
 * @param {Object} distribution - 身份分布
 * @param {Object[]} actions - 行为列表 [{ type, context }]
 * @returns {Object} 更新后的分布
 */
export const batchBayesianUpdate = (distribution, actions) => {
  let updated = distribution;
  actions.forEach(action => {
    updated = bayesianUpdate(updated, action.type, action.context);
  });
  return updated;
};

// ============================================================
// 行为检测与映射
// ============================================================

/**
 * 从发言中检测行为类型
 * @param {Object} speech - 增强后的发言记录
 * @returns {Object[]} 检测到的行为列表
 */
export const detectActionsFromSpeech = (speech) => {
  const actions = [];
  const { claimedRole, logicNodes, sentiment } = speech;

  // 1. 身份声称
  if (claimedRole) {
    const claimMap = {
      '预言家': ACTION_TYPES.CLAIM_SEER,
      '女巫': ACTION_TYPES.CLAIM_WITCH,
      '猎人': ACTION_TYPES.CLAIM_HUNTER,
      '守卫': ACTION_TYPES.CLAIM_GUARD,
      '村民': ACTION_TYPES.CLAIM_VILLAGER
    };
    if (claimMap[claimedRole]) {
      actions.push({ type: claimMap[claimedRole], context: { claimed: claimedRole } });
    }
  }

  // 2. 发言风格
  if (sentiment === 'aggressive') {
    actions.push({ type: ACTION_TYPES.AGGRESSIVE_SPEECH });
  } else if (sentiment === 'hesitant' || sentiment === 'neutral') {
    // 检查是否划水（发言内容少）
    if (speech.content && speech.content.length < 30) {
      actions.push({ type: ACTION_TYPES.PASSIVE_SPEECH });
    }
  }

  // 3. 逻辑清晰度
  if (logicNodes && logicNodes.length >= 2) {
    actions.push({ type: ACTION_TYPES.LOGICAL_SPEECH });
  }

  return actions;
};

/**
 * 从投票中检测行为类型
 * @param {Object} vote - 投票记录
 * @param {Object} gameState - 游戏状态
 * @returns {Object[]} 检测到的行为列表
 */
export const detectActionsFromVote = (vote, gameState) => {
  const actions = [];
  const { to } = vote;
  const { seerChecks = [] } = gameState;

  // 检查是否投给金水
  const targetCheck = seerChecks.find(c => c.targetId === to);
  if (targetCheck) {
    if (!targetCheck.isWolf) {
      actions.push({ type: ACTION_TYPES.VOTE_GOLD_WATER, context: { target: to } });
    } else {
      actions.push({ type: ACTION_TYPES.VOTE_KILLED, context: { target: to } });
    }
  }

  return actions;
};

/**
 * 从死亡事件检测行为
 * @param {Object} death - 死亡记录
 * @param {number} dayCount - 当前天数
 * @returns {Object[]} 行为列表
 */
export const detectActionsFromDeath = (death, dayCount) => {
  const actions = [];

  if (death.phase === '夜' && death.cause === '被刀') {
    if (dayCount === 1) {
      actions.push({ type: ACTION_TYPES.FIRST_NIGHT_DEATH });
    } else {
      actions.push({ type: ACTION_TYPES.LATER_DEATH });
    }
  }

  return actions;
};

// ============================================================
// 概率查询与解读
// ============================================================

/**
 * 获取最可能的角色
 * @param {Object} distribution - 身份分布
 * @returns {Object} { role, probability }
 */
export const getMostLikelyRole = (distribution) => {
  const { posteriors } = distribution;
  let maxRole = null;
  let maxProb = 0;

  Object.entries(posteriors).forEach(([role, prob]) => {
    if (prob > maxProb) {
      maxProb = prob;
      maxRole = role;
    }
  });

  return { role: maxRole, probability: maxProb };
};

/**
 * 获取狼人概率
 * @param {Object} distribution - 身份分布
 * @returns {number} 狼人概率
 */
export const getWerewolfProbability = (distribution) => {
  return distribution.posteriors[ROLE_TYPES.WEREWOLF] || 0;
};

/**
 * 获取好人概率（所有非狼角色概率之和）
 * @param {Object} distribution - 身份分布
 * @returns {number} 好人概率
 */
export const getGoodProbability = (distribution) => {
  const { posteriors } = distribution;
  return FACTIONS.GOOD.reduce((sum, role) => sum + (posteriors[role] || 0), 0);
};

/**
 * 按狼人概率排序玩家
 * @param {Object} distributions - 所有玩家身份分布
 * @param {Object[]} alivePlayers - 存活玩家
 * @returns {Object[]} 排序后的玩家列表
 */
export const rankByWerewolfProbability = (distributions, alivePlayers) => {
  return alivePlayers
    .map(p => ({
      playerId: p.id,
      werewolfProb: getWerewolfProbability(distributions[p.id] || {}),
      mostLikely: getMostLikelyRole(distributions[p.id] || {}),
      distribution: distributions[p.id]?.posteriors || {}
    }))
    .sort((a, b) => b.werewolfProb - a.werewolfProb);
};

// ============================================================
// 概率上下文生成（用于Prompt）
// ============================================================

/**
 * 生成身份推断上下文（供AI使用）
 * @param {Object} distributions - 身份分布
 * @param {Object[]} alivePlayers - 存活玩家
 * @param {number} selfId - 当前玩家ID
 * @returns {string} 推断分析文本
 */
export const generateBayesianContext = (distributions, alivePlayers, selfId) => {
  const parts = [];

  // 按狼人概率排序
  const ranked = rankByWerewolfProbability(distributions, alivePlayers.filter(p => p.id !== selfId));

  // 高概率狼人
  const suspects = ranked.filter(r => r.werewolfProb > 0.4).slice(0, 3);
  if (suspects.length > 0) {
    const suspectList = suspects.map(s =>
      `${s.playerId}号(狼概率:${(s.werewolfProb * 100).toFixed(0)}%)`
    ).join(', ');
    parts.push(`【高狼概率】${suspectList}`);
  }

  // 低概率狼人（可信好人）
  const trusted = ranked.filter(r => r.werewolfProb < 0.2).slice(-2);
  if (trusted.length > 0) {
    const trustedList = trusted.map(t => {
      const likely = t.mostLikely;
      return `${t.playerId}号(${likely.role}概率${(likely.probability * 100).toFixed(0)}%)`;
    }).join(', ');
    parts.push(`【低狼概率】${trustedList}`);
  }

  // 身份分布不确定的玩家
  const uncertain = ranked.filter(r => {
    const probs = Object.values(r.distribution);
    const max = Math.max(...probs);
    return max < 0.4; // 最高概率不到40%，说明身份不明确
  });
  if (uncertain.length > 0) {
    parts.push(`【身份模糊】${uncertain.map(u => u.playerId + '号').join(', ')}（需要更多信息）`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
};

/**
 * 结合死亡信息更新存活玩家的分布
 * @param {Object} distributions - 所有分布
 * @param {Object} death - 死亡玩家信息
 * @param {string} actualRole - 死亡玩家真实角色
 * @returns {Object} 更新后的分布
 */
export const updateDistributionsOnDeath = (distributions, death, actualRole) => {
  const updated = { ...distributions };

  // 移除死亡玩家
  delete updated[death.playerId];

  // 根据已知信息调整其他玩家的先验
  // 例如：如果一个狼人死了，其他玩家是狼的概率会相应调整
  Object.keys(updated).forEach(playerId => {
    const dist = updated[playerId];
    const { posteriors } = dist;

    // 简单调整：如果死者是狼，剩余玩家中狼的比例下降
    if (actualRole === ROLE_TYPES.WEREWOLF) {
      // 狼人概率略微下调
      if (posteriors[ROLE_TYPES.WEREWOLF]) {
        posteriors[ROLE_TYPES.WEREWOLF] *= 0.9;
      }
    }

    // 重新归一化
    const total = Object.values(posteriors).reduce((a, b) => a + b, 0);
    Object.keys(posteriors).forEach(role => {
      posteriors[role] /= total;
    });

    updated[playerId] = { ...dist, posteriors, lastUpdated: Date.now() };
  });

  return updated;
};
