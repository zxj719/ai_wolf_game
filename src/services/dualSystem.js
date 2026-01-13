/**
 * P2: 双系统架构 (Thinker-Listener Framework)
 *
 * 基于报告理论：
 * - System 1 (Listener): 感知层 - 处理NLU，提取关键信息摘要
 * - System 2 (Thinker): 推理层 - 核心逻辑演绎，策略决策
 * - Presenter: 表达层 - 根据战略意图生成说服性语言
 *
 * 这种分离使AI能够：
 * 1. 过滤噪声，保留逻辑骨架
 * 2. 在抽象策略空间进行决策
 * 3. 生成符合角色的自然语言
 */

import { LOGIC_NODE_TYPES } from './ragSchema';

// ============================================================
// P2-1: Listener 感知层
// 负责信息摘要、特征提取、噪声过滤
// ============================================================

/**
 * 玩家特征维度定义
 * 用于构建特征矩阵 F ∈ Z^{N×M}
 */
export const FEATURE_DIMENSIONS = {
  CLAIM_STATUS: 'claimStatus',       // 声称身份状态 (0=无, 1=村民, 2=神职)
  TRUST_LEVEL: 'trustLevel',         // 信任等级 (0-10)
  ACTIVITY_LEVEL: 'activityLevel',   // 活跃度 (0-10)
  AGGRESSION: 'aggression',          // 攻击性 (0-10)
  LOGIC_COHERENCE: 'logicCoherence', // 逻辑连贯性 (0-10)
  VOTE_CONSISTENCY: 'voteConsistency', // 投票一致性 (0-10)
  GOLD_WATER_COUNT: 'goldWaterCount',  // 收到金水数量
  KILL_COUNT: 'killCount',           // 收到查杀数量
  ACCUSATION_COUNT: 'accusationCount', // 被指控次数
  DEFENSE_COUNT: 'defenseCount'      // 被辩护次数
};

/**
 * 创建玩家特征向量
 * @param {number} playerId - 玩家ID
 * @returns {Object} 特征向量
 */
export const createFeatureVector = (playerId) => ({
  playerId,
  features: {
    [FEATURE_DIMENSIONS.CLAIM_STATUS]: 0,
    [FEATURE_DIMENSIONS.TRUST_LEVEL]: 5,
    [FEATURE_DIMENSIONS.ACTIVITY_LEVEL]: 5,
    [FEATURE_DIMENSIONS.AGGRESSION]: 5,
    [FEATURE_DIMENSIONS.LOGIC_COHERENCE]: 5,
    [FEATURE_DIMENSIONS.VOTE_CONSISTENCY]: 5,
    [FEATURE_DIMENSIONS.GOLD_WATER_COUNT]: 0,
    [FEATURE_DIMENSIONS.KILL_COUNT]: 0,
    [FEATURE_DIMENSIONS.ACCUSATION_COUNT]: 0,
    [FEATURE_DIMENSIONS.DEFENSE_COUNT]: 0
  },
  lastUpdated: Date.now()
});

/**
 * Listener: 从发言中提取结构化信息
 * 将冗余口语化发言转换为关键信息摘要
 *
 * @param {Object} speech - 发言记录
 * @param {Object} context - 游戏上下文
 * @returns {Object} 结构化摘要
 */
export const listenerExtract = (speech, context = {}) => {
  const { playerId, content, logicNodes = [], sentiment, claimedRole } = speech;

  // 1. 提取核心断言
  const assertions = [];
  logicNodes.forEach(node => {
    switch (node.type) {
      case LOGIC_NODE_TYPES.CLAIM:
        assertions.push({ type: 'IDENTITY', content: node.content, confidence: node.confidence });
        break;
      case LOGIC_NODE_TYPES.ACCUSE:
        assertions.push({ type: 'ACCUSE', target: node.target, confidence: node.confidence });
        break;
      case LOGIC_NODE_TYPES.DEFEND:
      case LOGIC_NODE_TYPES.SUPPORT:
        assertions.push({ type: 'SUPPORT', target: node.target, confidence: node.confidence });
        break;
      case LOGIC_NODE_TYPES.VERIFY:
        assertions.push({ type: 'VERIFY', target: node.target, content: node.content, confidence: node.confidence });
        break;
      case LOGIC_NODE_TYPES.VOTE_INTENT:
        assertions.push({ type: 'VOTE', target: node.target, confidence: node.confidence });
        break;
    }
  });

  // 2. 计算信息密度（有效信息/总长度）
  const informationDensity = content ? (assertions.length * 10) / Math.max(content.length, 1) : 0;

  // 3. 检测是否划水（低信息密度 + 短内容）
  const isLowQuality = informationDensity < 0.05 && (!content || content.length < 40);

  // 4. 提取关键词
  const keywords = extractKeywords(content);

  // 5. 生成摘要
  const summary = generateListenerSummary(playerId, assertions, claimedRole, sentiment);

  return {
    playerId,
    day: speech.day,
    assertions,
    claimedRole,
    sentiment,
    informationDensity,
    isLowQuality,
    keywords,
    summary,
    originalLength: content?.length || 0
  };
};

/**
 * 提取关键词
 */
const extractKeywords = (content) => {
  if (!content) return [];

  const keywords = [];
  const patterns = [
    { regex: /预言家/g, keyword: '预言家' },
    { regex: /女巫/g, keyword: '女巫' },
    { regex: /猎人/g, keyword: '猎人' },
    { regex: /守卫/g, keyword: '守卫' },
    { regex: /金水/g, keyword: '金水' },
    { regex: /查杀/g, keyword: '查杀' },
    { regex: /悍跳/g, keyword: '悍跳' },
    { regex: /狼人?/g, keyword: '狼' },
    { regex: /好人/g, keyword: '好人' },
    { regex: /站边/g, keyword: '站边' },
    { regex: /投票?/g, keyword: '投票' },
    { regex: /怀疑/g, keyword: '怀疑' }
  ];

  patterns.forEach(p => {
    if (p.regex.test(content)) {
      keywords.push(p.keyword);
    }
  });

  return [...new Set(keywords)];
};

/**
 * 生成Listener摘要
 */
const generateListenerSummary = (playerId, assertions, claimedRole, sentiment) => {
  const parts = [];

  if (claimedRole) {
    parts.push(`跳${claimedRole}`);
  }

  const accuses = assertions.filter(a => a.type === 'ACCUSE');
  if (accuses.length > 0) {
    parts.push(`踩${accuses.map(a => a.target + '号').join(',')}`);
  }

  const supports = assertions.filter(a => a.type === 'SUPPORT');
  if (supports.length > 0) {
    parts.push(`挺${supports.map(a => a.target + '号').join(',')}`);
  }

  const votes = assertions.filter(a => a.type === 'VOTE');
  if (votes.length > 0) {
    parts.push(`意向投${votes[0].target}号`);
  }

  if (parts.length === 0) {
    if (sentiment === 'hesitant') {
      return '划水/模糊表态';
    }
    return '无关键信息';
  }

  return parts.join('; ');
};

/**
 * 批量处理发言，构建特征矩阵
 * @param {Object[]} speeches - 发言列表
 * @param {Object[]} players - 玩家列表
 * @returns {Object} 特征矩阵 { playerId: featureVector }
 */
export const buildFeatureMatrix = (speeches, players) => {
  const matrix = {};

  // 初始化
  players.forEach(p => {
    matrix[p.id] = createFeatureVector(p.id);
  });

  // 处理每条发言
  speeches.forEach(speech => {
    const extracted = listenerExtract(speech);
    const features = matrix[speech.playerId]?.features;
    if (!features) return;

    // 更新声称状态
    if (extracted.claimedRole) {
      const claimMap = { '村民': 1, '预言家': 2, '女巫': 2, '猎人': 2, '守卫': 2 };
      features[FEATURE_DIMENSIONS.CLAIM_STATUS] = claimMap[extracted.claimedRole] || 0;
    }

    // 更新活跃度
    features[FEATURE_DIMENSIONS.ACTIVITY_LEVEL] = Math.min(10,
      features[FEATURE_DIMENSIONS.ACTIVITY_LEVEL] + (extracted.isLowQuality ? 0.5 : 1.5));

    // 更新攻击性
    const accuseCount = extracted.assertions.filter(a => a.type === 'ACCUSE').length;
    if (accuseCount > 0) {
      features[FEATURE_DIMENSIONS.AGGRESSION] = Math.min(10,
        features[FEATURE_DIMENSIONS.AGGRESSION] + accuseCount);
    }

    // 更新逻辑连贯性
    if (extracted.informationDensity > 0.1) {
      features[FEATURE_DIMENSIONS.LOGIC_COHERENCE] = Math.min(10,
        features[FEATURE_DIMENSIONS.LOGIC_COHERENCE] + 1);
    } else if (extracted.isLowQuality) {
      features[FEATURE_DIMENSIONS.LOGIC_COHERENCE] = Math.max(0,
        features[FEATURE_DIMENSIONS.LOGIC_COHERENCE] - 0.5);
    }

    // 更新被指控/辩护计数
    extracted.assertions.forEach(a => {
      if (a.type === 'ACCUSE' && matrix[a.target]) {
        matrix[a.target].features[FEATURE_DIMENSIONS.ACCUSATION_COUNT]++;
      }
      if (a.type === 'SUPPORT' && matrix[a.target]) {
        matrix[a.target].features[FEATURE_DIMENSIONS.DEFENSE_COUNT]++;
      }
      if (a.type === 'VERIFY' && matrix[a.target]) {
        if (a.content?.includes('金水')) {
          matrix[a.target].features[FEATURE_DIMENSIONS.GOLD_WATER_COUNT]++;
        } else if (a.content?.includes('查杀')) {
          matrix[a.target].features[FEATURE_DIMENSIONS.KILL_COUNT]++;
        }
      }
    });

    matrix[speech.playerId].lastUpdated = Date.now();
  });

  return matrix;
};

// ============================================================
// P2-2: Thinker 推理层
// 核心逻辑演绎，策略空间决策
// ============================================================

/**
 * 策略空间定义
 * 将复杂发言映射到离散策略
 */
export const STRATEGY_SPACE = {
  // 身份策略
  CLAIM_SEER: 'claim_seer',           // 跳预言家
  CLAIM_WITCH: 'claim_witch',         // 跳女巫
  CLAIM_HUNTER: 'claim_hunter',       // 跳猎人
  CLAIM_VILLAGER: 'claim_villager',   // 称村民
  HIDE_IDENTITY: 'hide_identity',     // 隐藏身份

  // 攻击策略
  ACCUSE_SINGLE: 'accuse_single',     // 单点踩人
  ACCUSE_MULTIPLE: 'accuse_multiple', // 多点踩人
  ISSUE_KILL: 'issue_kill',           // 发查杀

  // 防御策略
  DEFEND_SELF: 'defend_self',         // 自辩
  DEFEND_ALLY: 'defend_ally',         // 帮队友辩护
  ISSUE_GOLD: 'issue_gold',           // 发金水

  // 站边策略
  SIDE_SEER_A: 'side_seer_a',         // 站边预言家A
  SIDE_SEER_B: 'side_seer_b',         // 站边预言家B
  NEUTRAL: 'neutral',                 // 中立观望

  // 投票策略
  VOTE_CONSENSUS: 'vote_consensus',   // 跟随多数
  VOTE_INDEPENDENT: 'vote_independent', // 独立判断
  VOTE_PROTECT: 'vote_protect',       // 保护队友

  // 狼人特殊策略
  DEEP_COVER: 'deep_cover',           // 深水潜伏
  INVERTED_HOOK: 'inverted_hook',     // 倒钩（站边好人）
  SELF_DESTRUCT: 'self_destruct'      // 自爆
};

/**
 * Thinker: 策略决策引擎
 * 基于特征矩阵和游戏状态选择最优策略
 *
 * @param {Object} params - 决策参数
 * @returns {Object} 策略建议
 */
export const thinkerDecide = ({
  player,
  featureMatrix,
  gameState,
  trustProfiles,
  identityDistributions
}) => {
  const { role } = player;
  const { dayCount, phase } = gameState;
  const alivePlayers = gameState.players.filter(p => p.isAlive && p.id !== player.id);

  // 分析场上局势
  const situation = analyzeSituation(featureMatrix, alivePlayers, gameState);

  // 根据角色选择策略
  let strategies = [];

  switch (role) {
    case '预言家':
      strategies = decideSeerStrategy(player, situation, gameState);
      break;
    case '女巫':
      strategies = decideWitchStrategy(player, situation, gameState);
      break;
    case '猎人':
      strategies = decideHunterStrategy(player, situation, gameState);
      break;
    case '守卫':
      strategies = decideGuardStrategy(player, situation, gameState);
      break;
    case '狼人':
      strategies = decideWerewolfStrategy(player, situation, gameState, alivePlayers);
      break;
    default: // 村民
      strategies = decideVillagerStrategy(player, situation, gameState);
  }

  // 评估策略风险和收益
  const rankedStrategies = strategies.map(s => ({
    ...s,
    score: calculateStrategyScore(s, situation, player)
  })).sort((a, b) => b.score - a.score);

  return {
    recommended: rankedStrategies[0],
    alternatives: rankedStrategies.slice(1, 3),
    situation,
    reasoning: generateStrategyReasoning(rankedStrategies[0], situation)
  };
};

/**
 * 分析场上局势
 */
const analyzeSituation = (featureMatrix, alivePlayers, gameState) => {
  const { seerChecks = [], deathHistory = [] } = gameState;

  // 统计跳身份情况
  const claimers = {
    seer: [],
    witch: [],
    hunter: [],
    guard: []
  };

  Object.entries(featureMatrix).forEach(([id, data]) => {
    const status = data.features[FEATURE_DIMENSIONS.CLAIM_STATUS];
    if (status === 2) {
      // 需要根据具体声称判断
      // 这里简化处理
    }
  });

  // 统计金水/查杀
  const goldWaters = seerChecks.filter(c => !c.isWolf).map(c => c.targetId);
  const kills = seerChecks.filter(c => c.isWolf).map(c => c.targetId);

  // 计算好人/狼人存活估计
  const deadWolves = deathHistory.filter(d => {
    const p = gameState.players.find(p => p.id === d.playerId);
    return p?.role === '狼人';
  }).length;

  const estimatedAliveWolves = 2 - deadWolves; // 假设标准8人局2狼

  // 判断局势紧张度
  const tension = alivePlayers.length <= 4 ? 'critical' :
    alivePlayers.length <= 6 ? 'tense' : 'early';

  return {
    aliveCount: alivePlayers.length,
    goldWaters,
    kills,
    estimatedAliveWolves,
    tension,
    hasSeerConflict: claimers.seer.length > 1,
    dayCount: gameState.dayCount
  };
};

/**
 * 预言家策略
 */
const decideSeerStrategy = (player, situation, gameState) => {
  const strategies = [];
  const { dayCount } = situation;

  if (dayCount === 1) {
    // 首日必跳
    strategies.push({
      type: STRATEGY_SPACE.CLAIM_SEER,
      priority: 'high',
      action: '跳预言家，报验人',
      targets: []
    });
  }

  // 查杀目标策略
  if (situation.kills.length > 0) {
    strategies.push({
      type: STRATEGY_SPACE.ISSUE_KILL,
      priority: 'high',
      action: '公布查杀结果，带动投票',
      targets: situation.kills
    });
  }

  return strategies;
};

/**
 * 女巫策略
 */
const decideWitchStrategy = (player, situation, gameState) => {
  const strategies = [];

  if (situation.tension === 'critical') {
    // 关键时刻跳身份
    strategies.push({
      type: STRATEGY_SPACE.CLAIM_WITCH,
      priority: 'medium',
      action: '跳女巫，报银水/毒亡信息',
      targets: []
    });
  } else {
    // 隐藏身份
    strategies.push({
      type: STRATEGY_SPACE.HIDE_IDENTITY,
      priority: 'high',
      action: '伪装平民，低调发言',
      targets: []
    });
  }

  return strategies;
};

/**
 * 猎人策略
 */
const decideHunterStrategy = (player, situation, gameState) => {
  const strategies = [];

  if (situation.tension !== 'critical') {
    strategies.push({
      type: STRATEGY_SPACE.HIDE_IDENTITY,
      priority: 'high',
      action: '隐藏身份，保持威慑',
      targets: []
    });
  } else {
    strategies.push({
      type: STRATEGY_SPACE.CLAIM_HUNTER,
      priority: 'medium',
      action: '跳猎人，展示威慑力',
      targets: []
    });
  }

  return strategies;
};

/**
 * 守卫策略
 */
const decideGuardStrategy = (player, situation, gameState) => {
  return [{
    type: STRATEGY_SPACE.HIDE_IDENTITY,
    priority: 'high',
    action: '隐藏身份，低调参与讨论',
    targets: []
  }];
};

/**
 * 狼人策略
 */
const decideWerewolfStrategy = (player, situation, gameState, alivePlayers) => {
  const strategies = [];
  const { tension, hasSeerConflict, estimatedAliveWolves } = situation;

  // 悍跳策略
  if (!hasSeerConflict && situation.dayCount === 1) {
    strategies.push({
      type: STRATEGY_SPACE.CLAIM_SEER,
      priority: 'medium',
      action: '悍跳预言家，给好人发查杀',
      targets: alivePlayers.slice(0, 2).map(p => p.id)
    });
  }

  // 深水策略
  strategies.push({
    type: STRATEGY_SPACE.DEEP_COVER,
    priority: 'high',
    action: '深水潜伏，发言中庸',
    targets: []
  });

  // 倒钩策略
  if (estimatedAliveWolves >= 2 && tension !== 'critical') {
    strategies.push({
      type: STRATEGY_SPACE.INVERTED_HOOK,
      priority: 'low',
      action: '倒钩战术，站边好人换取信任',
      targets: situation.goldWaters.slice(0, 1)
    });
  }

  return strategies;
};

/**
 * 村民策略
 */
const decideVillagerStrategy = (player, situation, gameState) => {
  const strategies = [];

  // 站边策略
  if (situation.hasSeerConflict) {
    strategies.push({
      type: STRATEGY_SPACE.SIDE_SEER_A,
      priority: 'high',
      action: '分析预言家发言质量，选择站边',
      targets: []
    });
  }

  // 逻辑分析
  strategies.push({
    type: STRATEGY_SPACE.ACCUSE_SINGLE,
    priority: 'medium',
    action: '分析场上局势，找出可疑玩家',
    targets: []
  });

  return strategies;
};

/**
 * 计算策略评分
 */
const calculateStrategyScore = (strategy, situation, player) => {
  let score = 50; // 基础分

  // 优先级加成
  const priorityBonus = { high: 30, medium: 15, low: 5 };
  score += priorityBonus[strategy.priority] || 0;

  // 局势适配加成
  if (situation.tension === 'critical' && strategy.type.includes('claim')) {
    score += 10; // 关键时刻跳身份加分
  }

  if (situation.tension === 'early' && strategy.type === STRATEGY_SPACE.HIDE_IDENTITY) {
    score += 15; // 前期隐藏加分
  }

  return score;
};

/**
 * 生成策略推理说明
 */
const generateStrategyReasoning = (strategy, situation) => {
  const parts = [];

  parts.push(`当前局势: ${situation.tension}`);
  parts.push(`存活人数: ${situation.aliveCount}`);
  parts.push(`推荐策略: ${strategy.action}`);

  if (strategy.targets.length > 0) {
    parts.push(`目标: ${strategy.targets.join(', ')}号`);
  }

  return parts.join('; ');
};

// ============================================================
// P2-3: 策略上下文生成
// ============================================================

/**
 * 生成Thinker分析上下文（供AI提示词使用）
 * @param {Object} params - 参数
 * @returns {string} 策略分析文本
 */
export const generateThinkerContext = ({
  player,
  featureMatrix,
  gameState,
  trustProfiles,
  identityDistributions
}) => {
  const decision = thinkerDecide({
    player,
    featureMatrix,
    gameState,
    trustProfiles,
    identityDistributions
  });

  const parts = [];

  // 局势分析
  parts.push(`【局势评估】${decision.situation.tension}阶段，存活${decision.situation.aliveCount}人`);

  if (decision.situation.goldWaters.length > 0) {
    parts.push(`【已知金水】${decision.situation.goldWaters.join(',')}号`);
  }

  if (decision.situation.kills.length > 0) {
    parts.push(`【已知查杀】${decision.situation.kills.join(',')}号`);
  }

  // 策略建议
  parts.push(`【推荐策略】${decision.recommended.action}`);

  if (decision.alternatives.length > 0) {
    parts.push(`【备选策略】${decision.alternatives.map(a => a.action).join('; ')}`);
  }

  return parts.join('\n');
};

/**
 * 生成Listener摘要上下文
 * @param {Object[]} speeches - 今日发言
 * @returns {string} 摘要文本
 */
export const generateListenerContext = (speeches) => {
  if (!speeches || speeches.length === 0) return '';

  const summaries = speeches.map(speech => {
    const extracted = listenerExtract(speech);
    return `${speech.playerId}号: ${extracted.summary}`;
  });

  return `【发言摘要】\n${summaries.join('\n')}`;
};
