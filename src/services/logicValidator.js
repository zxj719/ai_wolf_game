/**
 * 逻辑剪枝验证模块 (Logic Pruning Validator)
 *
 * 用于验证AI生成的发言是否违反狼人杀基础规则
 * 如果检测到违规内容，打回重生成
 */

// ============================================================
// 违规规则定义
// ============================================================

/**
 * 基础规则违规模式
 * 每个规则包含：
 * - pattern: 匹配模式（字符串或正则）
 * - description: 规则描述
 * - severity: 严重程度 (critical/warning)
 * - fix: 修复建议（用于提示AI）
 */
export const RULE_VIOLATIONS = [
  // 女巫相关规则
  {
    id: 'WITCH_PEACEFUL_NIGHT',
    patterns: [
      /平安夜.*女巫.*不能救/,
      /平安夜.*没有人被刀.*不用救/,
      /平安夜.*女巫.*无法使用解药/,
      /平安夜说明.*女巫没救/,
      /平安夜.*证明.*女巫.*没有开药/
    ],
    description: '平安夜是女巫开药的直接证据之一，而非"女巫不能救人"',
    severity: 'critical',
    fix: '平安夜是因为女巫使用了解药救人，或守卫成功守护，并非女巫无法救人',
    category: 'WITCH_RULE'
  },
  {
    id: 'WITCH_BOTH_POTIONS',
    patterns: [
      /女巫.*同时.*解药.*毒药/,
      /女巫.*一晚.*救.*毒/,
      /女巫.*既救.*又毒/
    ],
    description: '女巫一晚只能使用一瓶药',
    severity: 'critical',
    fix: '女巫每晚只能选择使用解药或毒药中的一种，不能同时使用',
    category: 'WITCH_RULE'
  },
  {
    id: 'WITCH_SELF_SAVE_FIRST_NIGHT',
    patterns: [
      /第一晚.*女巫.*不能自救/,
      /首夜.*女巫.*无法救自己/
    ],
    description: '首夜女巫可以自救（部分规则变体）',
    severity: 'warning',
    fix: '在标准规则中，首夜女巫可以自救',
    category: 'WITCH_RULE'
  },

  // 预言家相关规则
  {
    id: 'SEER_SELF_CHECK',
    patterns: [
      /预言家.*查验自己/,
      /预言家.*验自己/
    ],
    description: '预言家不能查验自己',
    severity: 'critical',
    fix: '预言家只能查验其他玩家，不能查验自己',
    category: 'SEER_RULE'
  },
  {
    id: 'SEER_CHECK_WOLF_TEAM',
    patterns: [
      /预言家.*查验狼人.*显示好人/
    ],
    description: '预言家查验狼人应该显示"狼人"',
    severity: 'critical',
    fix: '预言家的查验结果是准确的，查狼人显示狼人，查好人显示好人',
    category: 'SEER_RULE'
  },

  // 守卫相关规则
  {
    id: 'GUARD_CONSECUTIVE',
    patterns: [
      /守卫.*连续.*守.*同一个人/,
      /守卫.*连守/
    ],
    // 这个不是违规，是正常的策略讨论，移除
    description: '守卫不能连续两晚守护同一目标',
    severity: 'info', // 降级为info，只做记录
    fix: null,
    category: 'GUARD_RULE'
  },
  {
    id: 'GUARD_WITCH_DOUBLE_SAVE',
    patterns: [
      /守卫.*女巫.*同时救.*死亡/,
      /同守同救.*会死/
    ],
    description: '同守同救会导致目标死亡（规则变体）',
    severity: 'warning',
    fix: '在某些规则中，守卫和女巫同时保护同一目标会导致该玩家死亡',
    category: 'GUARD_RULE'
  },

  // 猎人相关规则
  {
    id: 'HUNTER_POISONED',
    patterns: [
      /猎人.*被毒.*可以开枪/,
      /毒死.*猎人.*开枪/
    ],
    description: '猎人被毒死不能开枪',
    severity: 'critical',
    fix: '猎人被女巫毒死时无法开枪，只有被狼人刀死或被投票出局时才能开枪',
    category: 'HUNTER_RULE'
  },

  // 投票相关规则
  {
    id: 'SELF_VOTE',
    patterns: [
      /我.*投.*自己/,
      /投票给自己/
    ],
    description: '不能投票给自己',
    severity: 'critical',
    fix: '玩家不能投票给自己，只能投票给其他存活玩家',
    category: 'VOTE_RULE'
  },

  // 时序相关规则
  {
    id: 'TEMPORAL_FUTURE_SPEECH',
    patterns: [
      /刚才(\d+号)?说.*但是.*还没.*发言/
    ],
    description: '不能评论尚未发言的玩家',
    severity: 'critical',
    fix: '只能评价已经发言的玩家，不能预判未发言玩家的观点',
    category: 'TEMPORAL_RULE'
  },

  // 逻辑矛盾
  {
    id: 'LOGIC_SELF_CONTRADICTION',
    patterns: [
      /我是好人.*我是狼人/,
      /我是狼人.*我是好人/,
      /如果.*他是真预.*我就是狼/ // 好人不应该说这种话
    ],
    description: '发言中存在自相矛盾',
    severity: 'warning',
    fix: '发言应保持逻辑一致性，避免自相矛盾',
    category: 'LOGIC_RULE'
  }
];

// ============================================================
// 上下文敏感规则检查
// ============================================================

/**
 * 上下文相关的验证规则
 * 这些规则需要结合游戏状态进行验证
 */
export const CONTEXT_RULES = {
  // 预言家不能投给自己的金水
  SEER_VOTE_GOLD_WATER: (speech, gameState) => {
    const { seerChecks, playerId } = gameState;
    if (!speech.voteIntention || speech.voteIntention === -1) return null;

    // 检查当前玩家是否是预言家
    const currentPlayer = gameState.players?.find(p => p.id === playerId);
    if (currentPlayer?.role !== '预言家') return null;

    // 检查投票目标是否是自己验过的金水
    const myGoldWaters = seerChecks?.filter(c => c.seerId === playerId && !c.isWolf) || [];
    const votingGoldWater = myGoldWaters.find(c => c.targetId === speech.voteIntention);

    if (votingGoldWater) {
      return {
        id: 'SEER_VOTE_GOLD_WATER',
        description: `预言家不能投给自己验过的金水(${speech.voteIntention}号)`,
        severity: 'critical',
        fix: '预言家应该保护自己验过的金水，而不是投票出局他们'
      };
    }
    return null;
  },

  // 投票给已死玩家
  VOTE_DEAD_PLAYER: (speech, gameState) => {
    if (!speech.voteIntention || speech.voteIntention === -1) return null;

    const targetPlayer = gameState.players?.find(p => p.id === speech.voteIntention);
    if (targetPlayer && !targetPlayer.isAlive) {
      return {
        id: 'VOTE_DEAD_PLAYER',
        description: `不能投票给已死亡的玩家(${speech.voteIntention}号)`,
        severity: 'critical',
        fix: '只能投票给存活的玩家'
      };
    }
    return null;
  },

  // 投票给自己
  VOTE_SELF: (speech, gameState) => {
    if (!speech.voteIntention || speech.voteIntention === -1) return null;

    if (speech.voteIntention === gameState.playerId) {
      return {
        id: 'VOTE_SELF',
        description: '不能投票给自己',
        severity: 'critical',
        fix: '玩家不能投票给自己'
      };
    }
    return null;
  }
};

// ============================================================
// 验证函数
// ============================================================

/**
 * 验证AI生成的发言
 * @param {Object} aiResponse - AI的响应 {speech, thought, voteIntention, ...}
 * @param {Object} gameState - 游戏状态（用于上下文验证）
 * @returns {Object} 验证结果 {isValid, violations, suggestions}
 */
export const validateSpeech = (aiResponse, gameState = {}) => {
  const violations = [];
  const suggestions = [];

  // 获取要验证的文本（包括thought和speech）
  const textToCheck = [
    aiResponse?.speech || '',
    aiResponse?.thought || '',
    aiResponse?.reasoning || ''
  ].join(' ');

  if (!textToCheck.trim()) {
    return { isValid: true, violations: [], suggestions: [] };
  }

  // 1. 静态规则检查
  RULE_VIOLATIONS.forEach(rule => {
    if (rule.severity === 'info') return; // 跳过信息级规则

    const isViolated = rule.patterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(textToCheck);
      }
      return textToCheck.includes(pattern);
    });

    if (isViolated) {
      violations.push({
        id: rule.id,
        description: rule.description,
        severity: rule.severity,
        category: rule.category
      });
      if (rule.fix) {
        suggestions.push(rule.fix);
      }
    }
  });

  // 2. 上下文规则检查
  Object.entries(CONTEXT_RULES).forEach(([ruleId, ruleFn]) => {
    const violation = ruleFn(aiResponse, gameState);
    if (violation) {
      violations.push(violation);
      if (violation.fix) {
        suggestions.push(violation.fix);
      }
    }
  });

  // 判断是否有严重违规
  const hasCriticalViolation = violations.some(v => v.severity === 'critical');

  return {
    isValid: !hasCriticalViolation,
    violations,
    suggestions,
    // 汇总信息
    summary: violations.length > 0
      ? `发现${violations.length}处违规: ${violations.map(v => v.id).join(', ')}`
      : '无违规'
  };
};

/**
 * 验证夜间行动
 * @param {Object} aiResponse - AI的响应
 * @param {string} actionType - 行动类型 (NIGHT_WITCH, NIGHT_WOLF, etc.)
 * @param {Object} gameState - 游戏状态
 * @returns {Object} 验证结果
 */
export const validateNightAction = (aiResponse, actionType, gameState = {}) => {
  const violations = [];

  switch (actionType) {
    case 'NIGHT_WITCH':
      // 女巫不能同时使用两药
      if (aiResponse?.useSave && aiResponse?.usePoison !== null) {
        violations.push({
          id: 'WITCH_BOTH_POTIONS',
          description: '女巫不能同时使用解药和毒药',
          severity: 'critical'
        });
      }

      // 女巫不能毒自己
      if (aiResponse?.usePoison === gameState.playerId) {
        violations.push({
          id: 'WITCH_POISON_SELF',
          description: '女巫不能毒死自己',
          severity: 'critical'
        });
      }

      // 女巫不能毒已死玩家
      if (aiResponse?.usePoison !== null) {
        const targetPlayer = gameState.players?.find(p => p.id === aiResponse.usePoison);
        if (targetPlayer && !targetPlayer.isAlive) {
          violations.push({
            id: 'WITCH_POISON_DEAD',
            description: '女巫不能毒已死亡的玩家',
            severity: 'critical'
          });
        }
      }
      break;

    case 'NIGHT_WOLF':
      // 狼人不能刀自己队友
      if (aiResponse?.targetId !== null) {
        const targetPlayer = gameState.players?.find(p => p.id === aiResponse.targetId);
        if (targetPlayer?.role === '狼人') {
          violations.push({
            id: 'WOLF_ATTACK_TEAMMATE',
            description: '狼人不能袭击自己的队友',
            severity: 'critical'
          });
        }
      }
      break;

    case 'NIGHT_GUARD':
      // 守卫不能连续守护同一目标
      if (aiResponse?.targetId !== null && aiResponse.targetId === gameState.lastGuardTarget) {
        violations.push({
          id: 'GUARD_CONSECUTIVE',
          description: '守卫不能连续两晚守护同一目标',
          severity: 'critical'
        });
      }
      break;

    case 'NIGHT_SEER':
      // 预言家不能查验自己
      if (aiResponse?.targetId === gameState.playerId) {
        violations.push({
          id: 'SEER_SELF_CHECK',
          description: '预言家不能查验自己',
          severity: 'critical'
        });
      }

      // 预言家不能查验已死玩家
      if (aiResponse?.targetId !== null) {
        const targetPlayer = gameState.players?.find(p => p.id === aiResponse.targetId);
        if (targetPlayer && !targetPlayer.isAlive) {
          violations.push({
            id: 'SEER_CHECK_DEAD',
            description: '预言家不能查验已死亡的玩家',
            severity: 'critical'
          });
        }
      }
      break;
  }

  const hasCriticalViolation = violations.some(v => v.severity === 'critical');

  return {
    isValid: !hasCriticalViolation,
    violations,
    summary: violations.length > 0
      ? `发现${violations.length}处违规: ${violations.map(v => v.id).join(', ')}`
      : '无违规'
  };
};

/**
 * 生成修正提示（用于重新请求AI）
 * @param {Object[]} violations - 违规列表
 * @param {string[]} suggestions - 修复建议
 * @returns {string} 修正提示词
 */
export const generateCorrectionPrompt = (violations, suggestions) => {
  const parts = ['【重要修正】你的上一次回答违反了以下规则：'];

  violations.forEach((v, i) => {
    parts.push(`${i + 1}. ${v.description}`);
  });

  if (suggestions.length > 0) {
    parts.push('\n【正确理解】');
    suggestions.forEach((s, i) => {
      parts.push(`- ${s}`);
    });
  }

  parts.push('\n请重新生成符合规则的回答。');

  return parts.join('\n');
};

// ============================================================
// 逻辑一致性评分（用于信任系统）
// ============================================================

/**
 * 评估玩家发言的逻辑严密程度
 * @param {Object[]} playerSpeeches - 该玩家的所有发言
 * @returns {Object} 评估结果 {score, issues}
 */
export const evaluateLogicConsistency = (playerSpeeches) => {
  if (!playerSpeeches || playerSpeeches.length === 0) {
    return { score: 0.5, issues: [] };
  }

  const issues = [];
  let score = 1.0; // 从满分开始扣分

  // 提取所有投票意向
  const voteIntentions = playerSpeeches
    .filter(s => s.voteIntention !== undefined && s.voteIntention !== -1)
    .map(s => ({ day: s.day, target: s.voteIntention }));

  // 检查投票意向的一致性
  if (voteIntentions.length >= 2) {
    // 同一天内频繁改变投票意向
    const groupedByDay = {};
    voteIntentions.forEach(v => {
      if (!groupedByDay[v.day]) groupedByDay[v.day] = [];
      groupedByDay[v.day].push(v.target);
    });

    Object.entries(groupedByDay).forEach(([day, targets]) => {
      const uniqueTargets = new Set(targets);
      if (uniqueTargets.size >= 3) {
        issues.push({
          type: 'FLIP_FLOP_VOTE',
          description: `第${day}天多次改变投票意向(${[...uniqueTargets].join('->')})`,
          penalty: 0.15
        });
        score -= 0.15;
      } else if (uniqueTargets.size === 2) {
        issues.push({
          type: 'VOTE_CHANGE',
          description: `第${day}天改变了投票意向`,
          penalty: 0.05
        });
        score -= 0.05;
      }
    });
  }

  // 检查立场的一致性（站边变化）
  const stances = playerSpeeches
    .map(s => extractStance(s.content))
    .filter(Boolean);

  if (stances.length >= 2) {
    // 检查是否有反水行为（先站边A再站边B）
    for (let i = 1; i < stances.length; i++) {
      if (stances[i].supports && stances[i - 1].supports) {
        if (stances[i].supports !== stances[i - 1].supports) {
          issues.push({
            type: 'STANCE_FLIP',
            description: `立场发生变化：从站边${stances[i - 1].supports}号变为站边${stances[i].supports}号`,
            penalty: 0.2
          });
          score -= 0.2;
        }
      }
    }
  }

  // 检查对同一玩家的评价变化（先夸后踩或反之）
  const evaluations = {};
  playerSpeeches.forEach(s => {
    const evals = extractEvaluations(s.content);
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
          description: `对${target}号的评价前后矛盾（先${sentiments[0]}后${sentiments[sentiments.length - 1]}）`,
          penalty: 0.1
        });
        score -= 0.1;
      }
    }
  });

  return {
    score: Math.max(0, Math.min(1, score)),
    issues,
    summary: issues.length > 0
      ? `逻辑严密度: ${(score * 100).toFixed(0)}%, 发现${issues.length}处问题`
      : `逻辑严密度: ${(score * 100).toFixed(0)}%, 表现良好`
  };
};

/**
 * 从发言中提取立场
 */
const extractStance = (content) => {
  if (!content) return null;

  // 匹配站边模式
  const supportPatterns = [
    /站边(\d+)号/,
    /相信(\d+)号/,
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
 * 从发言中提取对其他玩家的评价
 */
const extractEvaluations = (content) => {
  if (!content) return [];

  const evaluations = [];

  // 正面评价模式
  const positivePatterns = [
    /(\d+)号.*好人/,
    /(\d+)号.*可信/,
    /(\d+)号.*没问题/,
    /相信(\d+)号/
  ];

  // 负面评价模式
  const negativePatterns = [
    /(\d+)号.*狼/,
    /(\d+)号.*可疑/,
    /怀疑(\d+)号/,
    /踩(\d+)号/,
    /投(\d+)号/
  ];

  positivePatterns.forEach(pattern => {
    const match = content.match(pattern);
    if (match) {
      evaluations.push({ target: match[1], sentiment: 'positive' });
    }
  });

  negativePatterns.forEach(pattern => {
    const match = content.match(pattern);
    if (match) {
      evaluations.push({ target: match[1], sentiment: 'negative' });
    }
  });

  return evaluations;
};

export default {
  validateSpeech,
  validateNightAction,
  generateCorrectionPrompt,
  evaluateLogicConsistency,
  RULE_VIOLATIONS,
  CONTEXT_RULES
};
