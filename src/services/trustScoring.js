/**
 * P1-1: 动态信任评分系统 (GRATR - Graph Attention Trust Reasoning)
 *
 * 基于报告理论：
 * - 证据检索：从对话历史中检索可观测的证据
 * - 幻觉抑制：将推理锚定在事实行为（投票、技能输出）而非单纯言语
 * - 多维度评分：身份得分、逻辑连贯得分、情绪真实得分
 */

import { LOGIC_NODE_TYPES } from './ragSchema';

// ============================================================
// 信任维度定义
// ============================================================

export const TRUST_DIMENSIONS = {
  IDENTITY: 'identity',           // 身份可信度（是否像声称的角色）
  LOGIC: 'logic',                 // 逻辑连贯性（发言是否自洽）
  BEHAVIOR: 'behavior',           // 行为一致性（言行是否匹配）
  EMOTION: 'emotion',             // 情绪真实度（是否有伪装痕迹）
  ALIGNMENT: 'alignment',         // 阵营倾向（偏向好人还是狼人）
  CONSISTENCY: 'consistency'      // 逻辑严密度（发言前后是否一致，立场是否反复）
};

// 初始信任分数（中立）
const INITIAL_TRUST_SCORE = 0.5;

// 信任分数调整权重
const TRUST_WEIGHTS = {
  // 正向信任因子
  GOLD_WATER_RECEIVED: 0.25,       // 被发金水
  CONSISTENT_VOTE: 0.1,            // 投票与发言一致
  DEFEND_VERIFIED_GOOD: 0.08,      // 为已验证好人辩护
  ACCUSE_VERIFIED_WOLF: 0.12,      // 指控已验证狼人
  LOGICAL_SPEECH: 0.05,            // 发言逻辑清晰
  CLAIM_VERIFIED: 0.2,             // 声称身份被验证
  STABLE_STANCE: 0.08,             // 立场稳定

  // 负向信任因子
  KILL_RECEIVED: -0.3,             // 被查杀
  INCONSISTENT_VOTE: -0.15,        // 投票与发言不一致
  DEFEND_VERIFIED_WOLF: -0.2,      // 为已验证狼人辩护
  ACCUSE_VERIFIED_GOOD: -0.15,     // 指控已验证好人
  LOGIC_CONTRADICTION: -0.12,      // 逻辑矛盾
  CLAIM_CONFLICT: -0.25,           // 身份声称冲突（如两人都跳预言家）
  SUSPICIOUS_BEHAVIOR: -0.08,      // 可疑行为（划水、模糊表态）

  // 行为模式因子
  BANDWAGON_VOTE: -0.05,           // 跟风投票
  COUNTER_LOGIC: -0.1,             // 逆逻辑操作
  EMOTIONAL_OUTBURST: -0.03,       // 情绪爆发（可能是伪装）

  // 逻辑严密度因子（新增）
  FLIP_FLOP_VOTE: -0.15,           // 投票意向反复
  STANCE_FLIP: -0.2,               // 立场反水
  EVALUATION_FLIP: -0.1,           // 对同一人评价反复
  LOGIC_CHAIN_BREAK: -0.12,        // 逻辑链断裂
  RULE_VIOLATION: -0.25            // 违反游戏基础规则（如"平安夜女巫不能救人"）
};

// ============================================================
// 玩家信任档案
// ============================================================

/**
 * 创建玩家信任档案
 * @param {number} playerId - 玩家ID
 * @returns {Object} 信任档案
 */
export const createTrustProfile = (playerId) => ({
  playerId,
  scores: {
    [TRUST_DIMENSIONS.IDENTITY]: INITIAL_TRUST_SCORE,
    [TRUST_DIMENSIONS.LOGIC]: INITIAL_TRUST_SCORE,
    [TRUST_DIMENSIONS.BEHAVIOR]: INITIAL_TRUST_SCORE,
    [TRUST_DIMENSIONS.EMOTION]: INITIAL_TRUST_SCORE,
    [TRUST_DIMENSIONS.ALIGNMENT]: INITIAL_TRUST_SCORE,
    [TRUST_DIMENSIONS.CONSISTENCY]: INITIAL_TRUST_SCORE
  },
  // 证据列表
  evidence: [],
  // 信任变化历史
  history: [],
  // 综合信任分数
  overallTrust: INITIAL_TRUST_SCORE,
  // 身份概率分布（将由贝叶斯模块更新）
  identityProbabilities: null,
  // 逻辑严密度追踪（新增）
  consistencyTracker: {
    voteIntentions: [],     // 投票意向历史
    stances: [],            // 站边历史
    evaluations: {},        // 对其他玩家的评价历史
    ruleViolations: []      // 规则违反记录
  },
  // 最后更新时间
  lastUpdated: Date.now()
});

/**
 * 初始化所有玩家的信任档案
 * @param {Object[]} players - 玩家列表
 * @returns {Object} playerId -> TrustProfile 映射
 */
export const initializeTrustProfiles = (players) => {
  const profiles = {};
  players.forEach(p => {
    profiles[p.id] = createTrustProfile(p.id);
  });
  return profiles;
};

// ============================================================
// 证据提取与评估
// ============================================================

/**
 * 从发言中提取信任证据
 * @param {Object} speech - 增强后的发言记录
 * @param {Object} gameState - 游戏状态
 * @returns {Object[]} 证据列表
 */
export const extractTrustEvidence = (speech, gameState) => {
  const evidence = [];
  const { playerId, logicNodes, sentiment, day } = speech;
  const { seerChecks = [] } = gameState;

  // 1. 分析逻辑断言
  if (logicNodes && logicNodes.length > 0) {
    logicNodes.forEach(node => {
      switch (node.type) {
        case LOGIC_NODE_TYPES.CLAIM:
          // 声称身份 - 需要后续验证
          evidence.push({
            type: 'CLAIM',
            source: playerId,
            target: playerId,
            content: node.content,
            impact: 0, // 待验证
            day,
            confidence: node.confidence
          });
          break;

        case LOGIC_NODE_TYPES.ACCUSE:
          // 指控他人
          evidence.push({
            type: 'ACCUSE',
            source: playerId,
            target: node.target,
            content: node.content,
            impact: evaluateAccusation(node.target, seerChecks),
            day,
            confidence: node.confidence
          });
          break;

        case LOGIC_NODE_TYPES.DEFEND:
        case LOGIC_NODE_TYPES.SUPPORT:
          // 为他人辩护/支持
          evidence.push({
            type: 'DEFEND',
            source: playerId,
            target: node.target,
            content: node.content,
            impact: evaluateDefense(node.target, seerChecks),
            day,
            confidence: node.confidence
          });
          break;

        case LOGIC_NODE_TYPES.VERIFY:
          // 验证信息（如报金水/查杀）
          evidence.push({
            type: 'VERIFY',
            source: playerId,
            target: node.target,
            content: node.content,
            impact: 0, // 需要与真实查验对比
            day,
            confidence: node.confidence
          });
          break;
      }
    });
  }

  // 2. 情感分析证据
  if (sentiment === 'emotional' || sentiment === 'aggressive') {
    evidence.push({
      type: 'EMOTION',
      source: playerId,
      target: playerId,
      content: `情绪表现: ${sentiment}`,
      impact: TRUST_WEIGHTS.EMOTIONAL_OUTBURST,
      day,
      confidence: 0.6
    });
  }

  return evidence;
};

/**
 * 评估指控的影响
 * @param {number} targetId - 被指控者ID
 * @param {Object[]} seerChecks - 预言家查验记录
 * @returns {number} 信任影响值
 */
const evaluateAccusation = (targetId, seerChecks) => {
  // 检查目标是否被查验过
  const check = seerChecks.find(c => c.targetId === targetId);
  if (check) {
    // 指控被查杀的人 = 正向
    if (check.isWolf) return TRUST_WEIGHTS.ACCUSE_VERIFIED_WOLF;
    // 指控金水 = 负向
    return TRUST_WEIGHTS.ACCUSE_VERIFIED_GOOD;
  }
  return 0; // 无法验证
};

/**
 * 评估辩护的影响
 * @param {number} targetId - 被辩护者ID
 * @param {Object[]} seerChecks - 预言家查验记录
 * @returns {number} 信任影响值
 */
const evaluateDefense = (targetId, seerChecks) => {
  const check = seerChecks.find(c => c.targetId === targetId);
  if (check) {
    // 为金水辩护 = 正向
    if (!check.isWolf) return TRUST_WEIGHTS.DEFEND_VERIFIED_GOOD;
    // 为狼辩护 = 负向
    return TRUST_WEIGHTS.DEFEND_VERIFIED_WOLF;
  }
  return 0;
};

// ============================================================
// 投票行为分析
// ============================================================

/**
 * 分析投票行为的信任影响
 * @param {Object} vote - 投票记录 { from, to, reasoning }
 * @param {Object} lastSpeech - 该玩家最后一次发言
 * @param {Object} gameState - 游戏状态
 * @returns {Object[]} 信任证据
 */
export const analyzeVoteBehavior = (vote, lastSpeech, gameState) => {
  const evidence = [];
  const { from, to } = vote;
  const { seerChecks = [], voteHistory = [] } = gameState;

  // 1. 检查投票一致性
  if (lastSpeech && lastSpeech.voteIntention !== undefined) {
    const isConsistent = lastSpeech.voteIntention === to;
    evidence.push({
      type: isConsistent ? 'CONSISTENT_VOTE' : 'INCONSISTENT_VOTE',
      source: from,
      target: from,
      content: isConsistent
        ? `言行一致：说投${lastSpeech.voteIntention}号，实投${to}号`
        : `言行不一：说投${lastSpeech.voteIntention}号，实投${to}号`,
      impact: isConsistent ? TRUST_WEIGHTS.CONSISTENT_VOTE : TRUST_WEIGHTS.INCONSISTENT_VOTE,
      day: gameState.dayCount,
      confidence: 0.9
    });
  }

  // 2. 检查是否投给金水
  const targetCheck = seerChecks.find(c => c.targetId === to);
  if (targetCheck && !targetCheck.isWolf) {
    evidence.push({
      type: 'VOTE_GOLD_WATER',
      source: from,
      target: from,
      content: `投票给金水${to}号`,
      impact: TRUST_WEIGHTS.ACCUSE_VERIFIED_GOOD,
      day: gameState.dayCount,
      confidence: 0.95
    });
  }

  // 3. 检查跟风投票
  if (voteHistory.length > 0) {
    const lastVote = voteHistory[voteHistory.length - 1];
    if (lastVote && lastVote.votes) {
      const voteCount = {};
      lastVote.votes.forEach(v => {
        voteCount[v.to] = (voteCount[v.to] || 0) + 1;
      });
      const mostVoted = Object.entries(voteCount).sort((a, b) => b[1] - a[1])[0];
      if (mostVoted && to === parseInt(mostVoted[0]) && voteCount[to] >= 3) {
        evidence.push({
          type: 'BANDWAGON',
          source: from,
          target: from,
          content: `跟风投票给多数目标${to}号`,
          impact: TRUST_WEIGHTS.BANDWAGON_VOTE,
          day: gameState.dayCount,
          confidence: 0.5
        });
      }
    }
  }

  return evidence;
};

// ============================================================
// 信任分数更新
// ============================================================

/**
 * 更新玩家信任分数
 * @param {Object} profile - 玩家信任档案
 * @param {Object[]} newEvidence - 新证据列表
 * @returns {Object} 更新后的档案
 */
export const updateTrustScore = (profile, newEvidence) => {
  const updatedProfile = { ...profile };

  newEvidence.forEach(ev => {
    // 记录证据
    updatedProfile.evidence.push(ev);

    // 根据证据类型更新对应维度
    const dimension = mapEvidenceToDimension(ev.type);
    const currentScore = updatedProfile.scores[dimension];
    const adjustment = ev.impact * ev.confidence;

    // 应用调整，保持在[0,1]范围内
    updatedProfile.scores[dimension] = Math.max(0, Math.min(1, currentScore + adjustment));

    // 记录历史
    updatedProfile.history.push({
      timestamp: Date.now(),
      dimension,
      adjustment,
      reason: ev.content,
      newScore: updatedProfile.scores[dimension]
    });
  });

  // 重新计算综合分数
  updatedProfile.overallTrust = calculateOverallTrust(updatedProfile.scores);
  updatedProfile.lastUpdated = Date.now();

  return updatedProfile;
};

/**
 * 将证据类型映射到信任维度
 */
const mapEvidenceToDimension = (evidenceType) => {
  const mapping = {
    'CLAIM': TRUST_DIMENSIONS.IDENTITY,
    'VERIFY': TRUST_DIMENSIONS.IDENTITY,
    'ACCUSE': TRUST_DIMENSIONS.ALIGNMENT,
    'DEFEND': TRUST_DIMENSIONS.ALIGNMENT,
    'CONSISTENT_VOTE': TRUST_DIMENSIONS.BEHAVIOR,
    'INCONSISTENT_VOTE': TRUST_DIMENSIONS.BEHAVIOR,
    'VOTE_GOLD_WATER': TRUST_DIMENSIONS.ALIGNMENT,
    'BANDWAGON': TRUST_DIMENSIONS.BEHAVIOR,
    'EMOTION': TRUST_DIMENSIONS.EMOTION,
    'LOGIC_ERROR': TRUST_DIMENSIONS.LOGIC,
    // 逻辑严密度相关映射（新增）
    'FLIP_FLOP_VOTE': TRUST_DIMENSIONS.CONSISTENCY,
    'STANCE_FLIP': TRUST_DIMENSIONS.CONSISTENCY,
    'EVALUATION_FLIP': TRUST_DIMENSIONS.CONSISTENCY,
    'RULE_VIOLATION': TRUST_DIMENSIONS.CONSISTENCY,
    'STABLE_STANCE': TRUST_DIMENSIONS.CONSISTENCY
  };
  return mapping[evidenceType] || TRUST_DIMENSIONS.LOGIC;
};

/**
 * 计算综合信任分数（加权平均）
 */
const calculateOverallTrust = (scores) => {
  const weights = {
    [TRUST_DIMENSIONS.IDENTITY]: 0.25,
    [TRUST_DIMENSIONS.LOGIC]: 0.2,
    [TRUST_DIMENSIONS.BEHAVIOR]: 0.15,
    [TRUST_DIMENSIONS.EMOTION]: 0.1,
    [TRUST_DIMENSIONS.ALIGNMENT]: 0.1,
    [TRUST_DIMENSIONS.CONSISTENCY]: 0.2  // 逻辑严密度权重较高
  };

  let total = 0;
  let weightSum = 0;

  Object.entries(scores).forEach(([dim, score]) => {
    const w = weights[dim] || 0.1;
    total += score * w;
    weightSum += w;
  });

  return weightSum > 0 ? total / weightSum : INITIAL_TRUST_SCORE;
};

// ============================================================
// 信任图谱查询
// ============================================================

/**
 * 获取玩家信任排名
 * @param {Object} profiles - 所有玩家信任档案
 * @param {Object[]} alivePlayers - 存活玩家列表
 * @returns {Object[]} 按信任度排序的玩家列表
 */
export const getTrustRanking = (profiles, alivePlayers) => {
  return alivePlayers
    .map(p => ({
      playerId: p.id,
      trust: profiles[p.id]?.overallTrust || INITIAL_TRUST_SCORE,
      scores: profiles[p.id]?.scores || {}
    }))
    .sort((a, b) => b.trust - a.trust);
};

/**
 * 获取最可疑玩家
 * @param {Object} profiles - 信任档案
 * @param {Object[]} alivePlayers - 存活玩家
 * @param {number} selfId - 自己的ID（排除）
 * @param {number} count - 返回数量
 * @returns {Object[]} 最可疑玩家列表
 */
export const getMostSuspicious = (profiles, alivePlayers, selfId, count = 3) => {
  return getTrustRanking(profiles, alivePlayers.filter(p => p.id !== selfId))
    .slice(-count)
    .reverse();
};

/**
 * 获取最可信玩家
 * @param {Object} profiles - 信任档案
 * @param {Object[]} alivePlayers - 存活玩家
 * @param {number} selfId - 自己的ID
 * @param {number} count - 返回数量
 * @returns {Object[]} 最可信玩家列表
 */
export const getMostTrusted = (profiles, alivePlayers, selfId, count = 3) => {
  return getTrustRanking(profiles, alivePlayers.filter(p => p.id !== selfId))
    .slice(0, count);
};

/**
 * 检测信任异常（多维度不一致）
 * @param {Object} profile - 玩家信任档案
 * @returns {Object|null} 异常信息
 */
export const detectTrustAnomaly = (profile) => {
  const scores = profile.scores;
  const values = Object.values(scores);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;

  // 如果方差过大，说明各维度评分不一致
  if (variance > 0.04) { // 阈值可调整
    const anomalies = [];
    Object.entries(scores).forEach(([dim, score]) => {
      if (Math.abs(score - avg) > 0.2) {
        anomalies.push({
          dimension: dim,
          score,
          deviation: score - avg
        });
      }
    });

    if (anomalies.length > 0) {
      return {
        playerId: profile.playerId,
        overallTrust: profile.overallTrust,
        variance,
        anomalies,
        interpretation: generateAnomalyInterpretation(anomalies)
      };
    }
  }

  return null;
};

/**
 * 生成异常解读
 */
const generateAnomalyInterpretation = (anomalies) => {
  const interpretations = [];

  anomalies.forEach(a => {
    if (a.dimension === TRUST_DIMENSIONS.BEHAVIOR && a.deviation < 0) {
      interpretations.push('言行不一致，可能在隐藏真实意图');
    }
    if (a.dimension === TRUST_DIMENSIONS.IDENTITY && a.deviation < 0) {
      interpretations.push('身份声称存疑，可能是悍跳');
    }
    if (a.dimension === TRUST_DIMENSIONS.ALIGNMENT && a.deviation < 0) {
      interpretations.push('阵营倾向可疑，多次站边错误');
    }
    if (a.dimension === TRUST_DIMENSIONS.LOGIC && a.deviation < 0) {
      interpretations.push('逻辑链断裂，发言存在矛盾');
    }
    if (a.dimension === TRUST_DIMENSIONS.CONSISTENCY && a.deviation < 0) {
      interpretations.push('逻辑混乱，立场反复摇摆，大概率狼人');
    }
  });

  return interpretations.join('；');
};

// ============================================================
// 信任上下文生成（用于Prompt）
// ============================================================

/**
 * 生成信任分析上下文（供AI使用）
 * @param {Object} profiles - 信任档案
 * @param {Object[]} alivePlayers - 存活玩家
 * @param {number} selfId - 当前玩家ID
 * @returns {string} 信任分析文本
 */
export const generateTrustContext = (profiles, alivePlayers, selfId) => {
  const parts = [];

  // 1. 可疑玩家
  const suspicious = getMostSuspicious(profiles, alivePlayers, selfId, 3);
  if (suspicious.length > 0) {
    const suspList = suspicious.map(s =>
      `${s.playerId}号(信任度:${(s.trust * 100).toFixed(0)}%)`
    ).join(', ');
    parts.push(`【低信任玩家】${suspList}`);
  }

  // 2. 可信玩家
  const trusted = getMostTrusted(profiles, alivePlayers, selfId, 2);
  if (trusted.length > 0) {
    const trustList = trusted.map(t =>
      `${t.playerId}号(${(t.trust * 100).toFixed(0)}%)`
    ).join(', ');
    parts.push(`【高信任玩家】${trustList}`);
  }

  // 3. 异常检测
  const anomalies = [];
  alivePlayers.forEach(p => {
    if (p.id === selfId) return;
    const profile = profiles[p.id];
    if (profile) {
      const anomaly = detectTrustAnomaly(profile);
      if (anomaly) {
        anomalies.push(`${p.id}号: ${anomaly.interpretation}`);
      }
    }
  });
  if (anomalies.length > 0) {
    parts.push(`【异常警报】${anomalies.join('; ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : '';
};

// ============================================================
// 逻辑严密度分析（新增）
// ============================================================

/**
 * 分析玩家发言的逻辑严密度
 * @param {Object} profile - 玩家信任档案
 * @param {Object[]} speeches - 该玩家的所有发言
 * @returns {Object} 分析结果 {score, issues, evidence}
 */
export const analyzeLogicConsistency = (profile, speeches) => {
  if (!speeches || speeches.length === 0) {
    return { score: 0.5, issues: [], evidence: [] };
  }

  const issues = [];
  const evidence = [];
  let score = 1.0;

  const tracker = profile?.consistencyTracker || {
    voteIntentions: [],
    stances: [],
    evaluations: {}
  };

  // 1. 分析投票意向变化
  const voteIntentions = speeches
    .filter(s => s.voteIntention !== undefined && s.voteIntention !== -1)
    .map(s => ({ day: s.day, target: s.voteIntention, content: s.content }));

  // 同一天内多次改变投票意向
  const groupedByDay = {};
  voteIntentions.forEach(v => {
    if (!groupedByDay[v.day]) groupedByDay[v.day] = [];
    groupedByDay[v.day].push(v.target);
  });

  Object.entries(groupedByDay).forEach(([day, targets]) => {
    const uniqueTargets = [...new Set(targets)];
    if (uniqueTargets.length >= 3) {
      issues.push({
        type: 'FLIP_FLOP_VOTE',
        description: `第${day}天投票意向反复(${targets.join('→')})`,
        severity: 'high'
      });
      evidence.push({
        type: 'FLIP_FLOP_VOTE',
        source: profile.playerId,
        target: profile.playerId,
        content: `投票意向反复：${targets.join('→')}`,
        impact: TRUST_WEIGHTS.FLIP_FLOP_VOTE,
        day: parseInt(day),
        confidence: 0.9
      });
      score -= 0.15;
    } else if (uniqueTargets.length === 2) {
      issues.push({
        type: 'VOTE_CHANGE',
        description: `第${day}天改变了投票意向(${targets[0]}→${targets[targets.length - 1]})`,
        severity: 'medium'
      });
      score -= 0.05;
    }
  });

  // 2. 分析立场变化（站边）
  const stances = speeches.map(s => ({
    day: s.day,
    stance: extractStanceFromContent(s.content)
  })).filter(s => s.stance);

  for (let i = 1; i < stances.length; i++) {
    const prev = stances[i - 1];
    const curr = stances[i];
    if (prev.stance.supports !== curr.stance.supports && prev.stance.supports && curr.stance.supports) {
      issues.push({
        type: 'STANCE_FLIP',
        description: `立场反水：从站边${prev.stance.supports}号变为站边${curr.stance.supports}号`,
        severity: 'high'
      });
      evidence.push({
        type: 'STANCE_FLIP',
        source: profile.playerId,
        target: profile.playerId,
        content: `立场反水：${prev.stance.supports}号→${curr.stance.supports}号`,
        impact: TRUST_WEIGHTS.STANCE_FLIP,
        day: curr.day,
        confidence: 0.85
      });
      score -= 0.2;
    }
  }

  // 3. 分析对同一玩家评价的变化
  const evaluations = {};
  speeches.forEach(s => {
    const evals = extractEvaluationsFromContent(s.content);
    evals.forEach(e => {
      if (!evaluations[e.target]) evaluations[e.target] = [];
      evaluations[e.target].push({ day: s.day, sentiment: e.sentiment });
    });
  });

  Object.entries(evaluations).forEach(([target, evals]) => {
    if (evals.length >= 2) {
      const sentiments = evals.map(e => e.sentiment);
      const hasPositive = sentiments.includes('positive');
      const hasNegative = sentiments.includes('negative');

      if (hasPositive && hasNegative) {
        issues.push({
          type: 'EVALUATION_FLIP',
          description: `对${target}号的评价前后矛盾`,
          severity: 'medium'
        });
        evidence.push({
          type: 'EVALUATION_FLIP',
          source: profile.playerId,
          target: parseInt(target),
          content: `评价反复：对${target}号先${sentiments[0]}后${sentiments[sentiments.length - 1]}`,
          impact: TRUST_WEIGHTS.EVALUATION_FLIP,
          day: evals[evals.length - 1].day,
          confidence: 0.7
        });
        score -= 0.1;
      }
    }
  });

  return {
    score: Math.max(0, Math.min(1, score)),
    issues,
    evidence,
    summary: generateConsistencySummary(score, issues)
  };
};

/**
 * 从发言内容中提取立场
 */
const extractStanceFromContent = (content) => {
  if (!content) return null;

  const supportPatterns = [
    /站边(\d+)号/,
    /相信(\d+)号.*预言家/,
    /支持(\d+)号/,
    /(\d+)号是真预/
  ];

  for (const pattern of supportPatterns) {
    const match = content.match(pattern);
    if (match) {
      return { supports: parseInt(match[1]) };
    }
  }

  return null;
};

/**
 * 从发言内容中提取对其他玩家的评价
 */
const extractEvaluationsFromContent = (content) => {
  if (!content) return [];

  const evaluations = [];

  const positivePatterns = [
    /(\d+)号.*好人/,
    /(\d+)号.*可信/,
    /(\d+)号.*没问题/,
    /相信(\d+)号/,
    /(\d+)号.*清白/
  ];

  const negativePatterns = [
    /(\d+)号.*狼/,
    /(\d+)号.*可疑/,
    /怀疑(\d+)号/,
    /踩(\d+)号/,
    /投(\d+)号/,
    /(\d+)号.*有问题/
  ];

  positivePatterns.forEach(pattern => {
    const matches = content.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      evaluations.push({ target: match[1], sentiment: 'positive' });
    }
  });

  negativePatterns.forEach(pattern => {
    const matches = content.matchAll(new RegExp(pattern, 'g'));
    for (const match of matches) {
      evaluations.push({ target: match[1], sentiment: 'negative' });
    }
  });

  return evaluations;
};

/**
 * 生成逻辑严密度摘要
 */
const generateConsistencySummary = (score, issues) => {
  if (score >= 0.8) {
    return '逻辑严密，表现稳定';
  } else if (score >= 0.6) {
    return `逻辑基本清晰，有${issues.length}处小问题`;
  } else if (score >= 0.4) {
    return `逻辑混乱，发现${issues.length}处明显问题，需警惕`;
  } else {
    return `逻辑严重混乱(${issues.length}处问题)，大概率狼人`;
  }
};

/**
 * 更新玩家的逻辑严密度分数
 * @param {Object} profile - 玩家信任档案
 * @param {Object[]} speeches - 该玩家的所有发言
 * @returns {Object} 更新后的档案
 */
export const updateConsistencyScore = (profile, speeches) => {
  const analysis = analyzeLogicConsistency(profile, speeches);

  // 更新 consistency 维度分数
  const updatedProfile = { ...profile };
  updatedProfile.scores[TRUST_DIMENSIONS.CONSISTENCY] = analysis.score;

  // 添加新证据
  if (analysis.evidence.length > 0) {
    updatedProfile.evidence = [...updatedProfile.evidence, ...analysis.evidence];
  }

  // 重新计算综合分数
  updatedProfile.overallTrust = calculateOverallTrust(updatedProfile.scores);
  updatedProfile.lastUpdated = Date.now();

  return updatedProfile;
};

/**
 * 获取逻辑混乱的玩家列表（用于AI判断）
 * @param {Object} profiles - 所有玩家信任档案
 * @param {Object[]} alivePlayers - 存活玩家列表
 * @param {number} threshold - 阈值（低于此值视为逻辑混乱）
 * @returns {Object[]} 逻辑混乱的玩家列表
 */
export const getLogicallyConfusedPlayers = (profiles, alivePlayers, threshold = 0.5) => {
  return alivePlayers
    .filter(p => {
      const profile = profiles[p.id];
      return profile && profile.scores[TRUST_DIMENSIONS.CONSISTENCY] < threshold;
    })
    .map(p => ({
      playerId: p.id,
      consistencyScore: profiles[p.id].scores[TRUST_DIMENSIONS.CONSISTENCY],
      issues: profiles[p.id].consistencyTracker?.ruleViolations || []
    }))
    .sort((a, b) => a.consistencyScore - b.consistencyScore);
};

/**
 * 记录规则违反（来自logicValidator）
 * @param {Object} profile - 玩家信任档案
 * @param {Object} violation - 违规信息
 * @returns {Object} 更新后的档案
 */
export const recordRuleViolation = (profile, violation) => {
  const updatedProfile = { ...profile };

  // 添加到规则违反记录
  if (!updatedProfile.consistencyTracker) {
    updatedProfile.consistencyTracker = {
      voteIntentions: [],
      stances: [],
      evaluations: {},
      ruleViolations: []
    };
  }

  updatedProfile.consistencyTracker.ruleViolations.push({
    ...violation,
    timestamp: Date.now()
  });

  // 创建证据
  const evidence = {
    type: 'RULE_VIOLATION',
    source: profile.playerId,
    target: profile.playerId,
    content: violation.description,
    impact: TRUST_WEIGHTS.RULE_VIOLATION,
    day: violation.day || 0,
    confidence: 0.95
  };

  // 更新分数
  updatedProfile.scores[TRUST_DIMENSIONS.CONSISTENCY] = Math.max(
    0,
    updatedProfile.scores[TRUST_DIMENSIONS.CONSISTENCY] + TRUST_WEIGHTS.RULE_VIOLATION
  );

  updatedProfile.evidence.push(evidence);
  updatedProfile.overallTrust = calculateOverallTrust(updatedProfile.scores);
  updatedProfile.lastUpdated = Date.now();

  return updatedProfile;
};
