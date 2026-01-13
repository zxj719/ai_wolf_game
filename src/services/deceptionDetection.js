/**
 * P2-3: 欺骗检测模块
 *
 * 基于报告理论：
 * - 认知负荷分析：说谎者需要更多认知资源，表现为逻辑冗余、延迟、不严密
 * - 行为一致性检测：言行不一是欺骗的重要信号
 * - 战术性暴露检测：识别故意露出破绽的行为
 * - 反向心理检测：识别利用好人逻辑的欺骗手段
 */

import { LOGIC_NODE_TYPES, SENTIMENT_TYPES } from './ragSchema';

// ============================================================
// 欺骗信号定义
// ============================================================

export const DECEPTION_SIGNALS = {
  // 认知负荷信号
  EXCESSIVE_DETAIL: 'excessive_detail',         // 过度细节（补充说明过多）
  LOGIC_GAP: 'logic_gap',                       // 逻辑断层
  DELAYED_RESPONSE: 'delayed_response',         // 延迟响应（发言犹豫）
  CONTRADICTION: 'contradiction',               // 自相矛盾

  // 行为信号
  VOTE_BETRAYAL: 'vote_betrayal',              // 投票背叛（投自己说支持的人）
  STANCE_FLIP: 'stance_flip',                  // 立场翻转
  SELECTIVE_MEMORY: 'selective_memory',         // 选择性记忆
  AVOIDING_TOPIC: 'avoiding_topic',            // 回避话题

  // 社交信号
  OVER_DEFENSE: 'over_defense',                // 过度辩护
  PREEMPTIVE_ACCUSATION: 'preemptive_accusation', // 先发制人指控
  EMOTIONAL_MANIPULATION: 'emotional_manipulation', // 情绪操控
  ALLIANCE_INCONSISTENCY: 'alliance_inconsistency', // 联盟不一致

  // 高级欺骗
  TACTICAL_EXPOSURE: 'tactical_exposure',       // 战术性暴露
  REVERSE_PSYCHOLOGY: 'reverse_psychology',     // 反向心理
  DEEP_COVER: 'deep_cover'                     // 深度潜伏
};

// 欺骗信号权重
const SIGNAL_WEIGHTS = {
  [DECEPTION_SIGNALS.CONTRADICTION]: 0.9,
  [DECEPTION_SIGNALS.VOTE_BETRAYAL]: 0.85,
  [DECEPTION_SIGNALS.STANCE_FLIP]: 0.7,
  [DECEPTION_SIGNALS.LOGIC_GAP]: 0.6,
  [DECEPTION_SIGNALS.OVER_DEFENSE]: 0.5,
  [DECEPTION_SIGNALS.PREEMPTIVE_ACCUSATION]: 0.45,
  [DECEPTION_SIGNALS.EXCESSIVE_DETAIL]: 0.4,
  [DECEPTION_SIGNALS.EMOTIONAL_MANIPULATION]: 0.4,
  [DECEPTION_SIGNALS.AVOIDING_TOPIC]: 0.35,
  [DECEPTION_SIGNALS.SELECTIVE_MEMORY]: 0.3,
  [DECEPTION_SIGNALS.ALLIANCE_INCONSISTENCY]: 0.5,
  [DECEPTION_SIGNALS.TACTICAL_EXPOSURE]: 0.6,
  [DECEPTION_SIGNALS.REVERSE_PSYCHOLOGY]: 0.55,
  [DECEPTION_SIGNALS.DEEP_COVER]: 0.3
};

// ============================================================
// 欺骗检测分析器
// ============================================================

/**
 * 创建玩家欺骗档案
 * @param {number} playerId - 玩家ID
 * @returns {Object} 欺骗档案
 */
export const createDeceptionProfile = (playerId) => ({
  playerId,
  signals: [],                    // 检测到的欺骗信号
  deceptionScore: 0,              // 欺骗可能性评分 (0-1)
  patterns: [],                   // 识别的欺骗模式
  speechHistory: [],              // 发言历史摘要
  stanceHistory: [],              // 立场变化历史
  lastUpdated: Date.now()
});

/**
 * 初始化所有玩家欺骗档案
 * @param {Object[]} players - 玩家列表
 * @returns {Object} playerId -> DeceptionProfile
 */
export const initializeDeceptionProfiles = (players) => {
  const profiles = {};
  players.forEach(p => {
    profiles[p.id] = createDeceptionProfile(p.id);
  });
  return profiles;
};

/**
 * 分析发言中的欺骗信号
 * @param {Object} speech - 增强后的发言
 * @param {Object} profile - 玩家欺骗档案
 * @param {Object} context - 游戏上下文
 * @returns {Object[]} 检测到的信号列表
 */
export const analyzeDeceptionSignals = (speech, profile, context = {}) => {
  const signals = [];
  const { content, logicNodes = [], sentiment, claimedRole } = speech;
  const { speechHistory = [], voteHistory = [] } = context;

  // 1. 检测自相矛盾
  const contradictions = detectContradictions(speech, profile.speechHistory);
  if (contradictions.length > 0) {
    signals.push({
      type: DECEPTION_SIGNALS.CONTRADICTION,
      details: contradictions,
      confidence: 0.85,
      day: speech.day
    });
  }

  // 2. 检测立场翻转
  const stanceFlip = detectStanceFlip(speech, profile.stanceHistory);
  if (stanceFlip) {
    signals.push({
      type: DECEPTION_SIGNALS.STANCE_FLIP,
      details: stanceFlip,
      confidence: 0.7,
      day: speech.day
    });
  }

  // 3. 检测过度辩护
  if (detectOverDefense(content, sentiment)) {
    signals.push({
      type: DECEPTION_SIGNALS.OVER_DEFENSE,
      details: '发言中包含大量自我辩护',
      confidence: 0.5,
      day: speech.day
    });
  }

  // 4. 检测先发制人指控
  if (detectPreemptiveAccusation(speech, speechHistory)) {
    signals.push({
      type: DECEPTION_SIGNALS.PREEMPTIVE_ACCUSATION,
      details: '在被质疑前主动攻击他人',
      confidence: 0.45,
      day: speech.day
    });
  }

  // 5. 检测逻辑断层
  const logicGaps = detectLogicGaps(content, logicNodes);
  if (logicGaps.length > 0) {
    signals.push({
      type: DECEPTION_SIGNALS.LOGIC_GAP,
      details: logicGaps,
      confidence: 0.6,
      day: speech.day
    });
  }

  // 6. 检测情绪操控
  if (detectEmotionalManipulation(content, sentiment)) {
    signals.push({
      type: DECEPTION_SIGNALS.EMOTIONAL_MANIPULATION,
      details: '使用情绪化语言试图影响判断',
      confidence: 0.4,
      day: speech.day
    });
  }

  // 7. 检测深度潜伏（低活跃度+低信息量）
  if (detectDeepCover(speech, profile)) {
    signals.push({
      type: DECEPTION_SIGNALS.DEEP_COVER,
      details: '持续低调发言，可能是深水狼',
      confidence: 0.3,
      day: speech.day
    });
  }

  return signals;
};

/**
 * 检测自相矛盾
 */
const detectContradictions = (currentSpeech, speechHistory) => {
  const contradictions = [];
  const currentNodes = currentSpeech.logicNodes || [];

  speechHistory.forEach(pastSpeech => {
    const pastNodes = pastSpeech.logicNodes || [];

    currentNodes.forEach(current => {
      pastNodes.forEach(past => {
        // 对同一目标的相反断言
        if (current.target === past.target && current.target !== null) {
          // 之前支持，现在指控
          if ((past.type === LOGIC_NODE_TYPES.SUPPORT || past.type === LOGIC_NODE_TYPES.DEFEND) &&
            current.type === LOGIC_NODE_TYPES.ACCUSE) {
            contradictions.push({
              past: `D${pastSpeech.day}支持${current.target}号`,
              current: `D${currentSpeech.day}指控${current.target}号`,
              severity: 'high'
            });
          }
          // 之前指控，现在支持
          if (past.type === LOGIC_NODE_TYPES.ACCUSE &&
            (current.type === LOGIC_NODE_TYPES.SUPPORT || current.type === LOGIC_NODE_TYPES.DEFEND)) {
            contradictions.push({
              past: `D${pastSpeech.day}指控${current.target}号`,
              current: `D${currentSpeech.day}支持${current.target}号`,
              severity: 'medium'
            });
          }
        }
      });
    });
  });

  return contradictions;
};

/**
 * 检测立场翻转
 */
const detectStanceFlip = (speech, stanceHistory) => {
  if (stanceHistory.length === 0) return null;

  const lastStance = stanceHistory[stanceHistory.length - 1];
  const currentNodes = speech.logicNodes || [];

  // 检查是否有支持/反对的翻转
  const currentSupports = currentNodes
    .filter(n => n.type === LOGIC_NODE_TYPES.SUPPORT)
    .map(n => n.target);

  if (lastStance.supports && currentSupports.length > 0) {
    // 之前支持A，现在支持B（且A、B不同）
    const flipped = currentSupports.filter(t => !lastStance.supports.includes(t));
    if (flipped.length > 0 && lastStance.supports.some(s => !currentSupports.includes(s))) {
      return {
        from: lastStance.supports,
        to: currentSupports,
        reason: '站边目标发生变化'
      };
    }
  }

  return null;
};

/**
 * 检测过度辩护
 */
const detectOverDefense = (content, sentiment) => {
  if (!content) return false;

  const defensePatterns = [
    /我真的不是/,
    /相信我/,
    /你们冤枉/,
    /我怎么可能/,
    /我发誓/,
    /绝对不是/,
    /我保证/
  ];

  const matchCount = defensePatterns.filter(p => p.test(content)).length;
  return matchCount >= 2 || (sentiment === SENTIMENT_TYPES.DEFENSIVE && matchCount >= 1);
};

/**
 * 检测先发制人指控
 */
const detectPreemptiveAccusation = (speech, speechHistory) => {
  const currentNodes = speech.logicNodes || [];
  const accusations = currentNodes.filter(n => n.type === LOGIC_NODE_TYPES.ACCUSE);

  if (accusations.length === 0) return false;

  // 检查是否在没被质疑的情况下主动攻击
  const wasQuestioned = speechHistory.some(s =>
    s.day === speech.day &&
    s.logicNodes?.some(n =>
      (n.type === LOGIC_NODE_TYPES.ACCUSE || n.type === LOGIC_NODE_TYPES.DOUBT) &&
      n.target === speech.playerId
    )
  );

  // 如果没被质疑但主动攻击多人
  return !wasQuestioned && accusations.length >= 2;
};

/**
 * 检测逻辑断层
 */
const detectLogicGaps = (content, logicNodes) => {
  const gaps = [];

  if (!content || content.length < 50) return gaps;

  // 如果发言长但逻辑节点少，说明信息密度低
  const density = logicNodes.length / (content.length / 50);
  if (density < 0.3) {
    gaps.push('发言冗长但缺乏实质内容');
  }

  // 检查是否有未完成的逻辑链
  const hasAccusation = logicNodes.some(n => n.type === LOGIC_NODE_TYPES.ACCUSE);
  const hasReasoning = content.includes('因为') || content.includes('所以') || content.includes('理由');

  if (hasAccusation && !hasReasoning) {
    gaps.push('指控缺乏理由支撑');
  }

  return gaps;
};

/**
 * 检测情绪操控
 */
const detectEmotionalManipulation = (content, sentiment) => {
  if (!content) return false;

  const manipulationPatterns = [
    /大家想想/,
    /难道不觉得/,
    /明眼人都能看出/,
    /这还用说吗/,
    /你们怎么还不明白/,
    /我太失望了/
  ];

  const matchCount = manipulationPatterns.filter(p => p.test(content)).length;
  return matchCount >= 1 && sentiment === SENTIMENT_TYPES.EMOTIONAL;
};

/**
 * 检测深度潜伏
 */
const detectDeepCover = (speech, profile) => {
  // 连续多轮低信息量发言
  const recentSpeeches = profile.speechHistory.slice(-3);
  if (recentSpeeches.length < 2) return false;

  const allLowQuality = recentSpeeches.every(s =>
    !s.logicNodes || s.logicNodes.length <= 1
  );

  const currentLowQuality = !speech.logicNodes || speech.logicNodes.length <= 1;

  return allLowQuality && currentLowQuality;
};

// ============================================================
// 投票行为欺骗分析
// ============================================================

/**
 * 分析投票中的欺骗信号
 * @param {Object} vote - 投票记录
 * @param {Object} lastSpeech - 最后发言
 * @param {Object} profile - 欺骗档案
 * @returns {Object[]} 检测到的信号
 */
export const analyzeVoteDeception = (vote, lastSpeech, profile) => {
  const signals = [];

  // 投票背叛检测
  if (lastSpeech && lastSpeech.voteIntention !== undefined) {
    if (lastSpeech.voteIntention !== vote.to) {
      // 检查是否投给了之前支持的人
      const supportedTargets = lastSpeech.logicNodes
        ?.filter(n => n.type === LOGIC_NODE_TYPES.SUPPORT)
        .map(n => n.target) || [];

      if (supportedTargets.includes(vote.to)) {
        signals.push({
          type: DECEPTION_SIGNALS.VOTE_BETRAYAL,
          details: `发言支持${vote.to}号，却投票给他`,
          confidence: 0.85
        });
      }
    }
  }

  // 联盟不一致检测
  const allianceHistory = profile.stanceHistory
    .filter(s => s.supports && s.supports.length > 0);

  if (allianceHistory.length > 0) {
    const lastAlliance = allianceHistory[allianceHistory.length - 1];
    if (lastAlliance.supports.includes(vote.to)) {
      signals.push({
        type: DECEPTION_SIGNALS.ALLIANCE_INCONSISTENCY,
        details: `投票给之前站边的${vote.to}号`,
        confidence: 0.5
      });
    }
  }

  return signals;
};

// ============================================================
// 欺骗评分计算
// ============================================================

/**
 * 更新欺骗档案
 * @param {Object} profile - 当前档案
 * @param {Object[]} newSignals - 新检测到的信号
 * @param {Object} speech - 当前发言
 * @returns {Object} 更新后的档案
 */
export const updateDeceptionProfile = (profile, newSignals, speech) => {
  const updatedProfile = { ...profile };

  // 添加新信号
  updatedProfile.signals = [...profile.signals, ...newSignals];

  // 更新发言历史
  updatedProfile.speechHistory = [...profile.speechHistory, {
    day: speech.day,
    logicNodes: speech.logicNodes,
    sentiment: speech.sentiment,
    claimedRole: speech.claimedRole
  }];

  // 更新立场历史
  const supports = speech.logicNodes
    ?.filter(n => n.type === LOGIC_NODE_TYPES.SUPPORT)
    .map(n => n.target) || [];
  const accuses = speech.logicNodes
    ?.filter(n => n.type === LOGIC_NODE_TYPES.ACCUSE)
    .map(n => n.target) || [];

  if (supports.length > 0 || accuses.length > 0) {
    updatedProfile.stanceHistory = [...profile.stanceHistory, {
      day: speech.day,
      supports,
      accuses
    }];
  }

  // 计算欺骗评分
  updatedProfile.deceptionScore = calculateDeceptionScore(updatedProfile.signals);

  // 识别欺骗模式
  updatedProfile.patterns = identifyDeceptionPatterns(updatedProfile);

  updatedProfile.lastUpdated = Date.now();

  return updatedProfile;
};

/**
 * 计算欺骗评分
 */
const calculateDeceptionScore = (signals) => {
  if (signals.length === 0) return 0;

  // 加权平均
  let totalWeight = 0;
  let weightedSum = 0;

  signals.forEach(signal => {
    const weight = SIGNAL_WEIGHTS[signal.type] || 0.3;
    const contribution = weight * signal.confidence;
    weightedSum += contribution;
    totalWeight += weight;
  });

  // 归一化到 0-1
  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // 应用信号数量的影响（更多信号 = 更高确信度）
  const countMultiplier = Math.min(1, signals.length / 5);

  return Math.min(1, rawScore * (0.5 + 0.5 * countMultiplier));
};

/**
 * 识别欺骗模式
 */
const identifyDeceptionPatterns = (profile) => {
  const patterns = [];
  const { signals, stanceHistory } = profile;

  // 模式1: 频繁矛盾
  const contradictionCount = signals.filter(s => s.type === DECEPTION_SIGNALS.CONTRADICTION).length;
  if (contradictionCount >= 2) {
    patterns.push({
      type: 'FREQUENT_CONTRADICTIONS',
      description: '多次自相矛盾，可能在编造谎言',
      severity: 'high'
    });
  }

  // 模式2: 立场摇摆
  if (stanceHistory.length >= 3) {
    const stanceChanges = stanceHistory.slice(1).filter((s, i) => {
      const prev = stanceHistory[i];
      return JSON.stringify(s.supports) !== JSON.stringify(prev.supports);
    }).length;

    if (stanceChanges >= 2) {
      patterns.push({
        type: 'STANCE_WOBBLING',
        description: '立场频繁变化，可能在试探或隐藏',
        severity: 'medium'
      });
    }
  }

  // 模式3: 攻击性掩护
  const preemptiveCount = signals.filter(s => s.type === DECEPTION_SIGNALS.PREEMPTIVE_ACCUSATION).length;
  const overDefenseCount = signals.filter(s => s.type === DECEPTION_SIGNALS.OVER_DEFENSE).length;
  if (preemptiveCount >= 1 && overDefenseCount >= 1) {
    patterns.push({
      type: 'AGGRESSIVE_COVER',
      description: '通过主动攻击来转移注意力',
      severity: 'high'
    });
  }

  return patterns;
};

// ============================================================
// 欺骗上下文生成
// ============================================================

/**
 * 生成欺骗检测上下文（供AI提示词使用）
 * @param {Object} profiles - 所有玩家欺骗档案
 * @param {Object[]} alivePlayers - 存活玩家
 * @param {number} selfId - 当前玩家ID
 * @returns {string} 欺骗分析文本
 */
export const generateDeceptionContext = (profiles, alivePlayers, selfId) => {
  const parts = [];

  // 按欺骗评分排序
  const ranked = alivePlayers
    .filter(p => p.id !== selfId)
    .map(p => ({
      playerId: p.id,
      score: profiles[p.id]?.deceptionScore || 0,
      patterns: profiles[p.id]?.patterns || [],
      recentSignals: (profiles[p.id]?.signals || []).slice(-3)
    }))
    .sort((a, b) => b.score - a.score);

  // 高欺骗嫌疑
  const suspicious = ranked.filter(r => r.score > 0.5);
  if (suspicious.length > 0) {
    const suspList = suspicious.map(s => {
      const patternDesc = s.patterns.length > 0
        ? `(${s.patterns[0].description})`
        : '';
      return `${s.playerId}号(欺骗度:${(s.score * 100).toFixed(0)}%)${patternDesc}`;
    }).join('; ');
    parts.push(`【高欺骗嫌疑】${suspList}`);
  }

  // 最近检测到的信号
  const recentAlerts = [];
  ranked.forEach(r => {
    r.recentSignals.forEach(signal => {
      if (signal.confidence > 0.6) {
        recentAlerts.push(`${r.playerId}号: ${signal.details || signal.type}`);
      }
    });
  });
  if (recentAlerts.length > 0 && recentAlerts.length <= 3) {
    parts.push(`【欺骗信号】${recentAlerts.join('; ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
};
