/**
 * 基础规则模块 - 适用于所有角色的通用规则
 * 渐进式披露：只包含不依赖特定角色的基础规则
 */

// 术语表（所有玩家通用）
export const TERMINOLOGY = `【术语】划水(无内容),踩(怀疑),站边(信某预),金水/查杀(预验好/坏),悍跳(狼称预),银水(女巫救),倒钩(狼站边好人),抗推(好人被投).`;

// 胜利模式配置
export const VICTORY_MODE_PROMPTS = {
  'edge': {
    name: '屠边模式',
    wolfGoal: '杀光所有村民或所有神职即可胜利',
    goodGoal: '杀光所有狼人才能胜利',
    wolfStrategy: '优先集中攻击一个阵营（村民或神职），速战速决',
    goodStrategy: '保护弱势阵营，避免被屠边'
  },
  'town': {
    name: '屠城模式',
    wolfGoal: '必须杀光所有好人（村民+神职）才能胜利',
    goodGoal: '杀光所有狼人才能胜利',
    wolfStrategy: '需要更长时间，要更加谨慎伪装，逐个击破',
    goodStrategy: '有更多容错空间，即使损失部分神职或村民也能继续'
  }
};

// 身份推理表说明
export const IDENTITY_TABLE_PROMPT = `
【身份推理表说明】
你需要维护一个身份推理表，记录你对每个玩家身份的判断。
格式: {"玩家号码": {"suspect": "角色猜测", "confidence": 0-100, "reason": "推理依据"}}

推理方法：
1. 排除法：根据已确认的身份排除可能性
2. 行为分析：发言风格、投票倾向、夜间结果
3. 逻辑推断：谁的发言有矛盾？谁在引导错误方向？
4. 阵营判断：先判断好人/狼人，再细分角色

置信度参考：
- 90-100: 基本确定（如自己验过、明确跳身份）
- 70-89: 高度怀疑（多个证据指向）
- 50-69: 中度怀疑（有一定依据）
- 30-49: 轻度怀疑（信息不足）
- 0-29: 基本排除（可能是好人）
`;

// 对抗性自检提示
export const ADVERSARIAL_REFLECTION = `
【对抗性自检】输出前请快速验证：
1. 反向验证：如果我的推论错了，狼人最可能的布局是？
2. 信息盲区：我是否遗漏了某些关键发言或投票？
3. 被利用风险：我的行动是否可能被狼人利用来带节奏？
4. 一致性检查：我的发言是否与之前立场矛盾？`;

// ============================================================
// 局数配置辅助函数
// ============================================================

/**
 * 判断是否是小型局（6人局）
 */
export const isMiniGame = (gameSetup) => {
  if (!gameSetup) return false;
  return gameSetup.id === 'mini_6' || gameSetup.TOTAL_PLAYERS === 6;
};

/**
 * 判断是否是标准局（8人局）
 */
export const isStandardGame = (gameSetup) => {
  if (!gameSetup) return true;
  return gameSetup.id === 'standard_8' || gameSetup.TOTAL_PLAYERS === 8;
};

/**
 * 判断是否是大型局（12人局）
 */
export const isLargeGame = (gameSetup) => {
  if (!gameSetup) return false;
  return gameSetup.TOTAL_PLAYERS >= 12;
};

/**
 * 检测游戏中存在的角色
 * @param {Array} players - 玩家列表
 * @returns {Object} 各角色存在标志
 */
export const detectExistingRoles = (players) => {
  if (!players || !Array.isArray(players)) {
    return { hasGuard: true, hasWitch: true, hasHunter: true, hasSeer: true, wolfCount: 2 };
  }
  const roles = new Set(players.map(p => p.role));
  return {
    hasGuard: roles.has('守卫'),
    hasWitch: roles.has('女巫'),
    hasHunter: roles.has('猎人'),
    hasSeer: roles.has('预言家'),
    wolfCount: players.filter(p => p.role === '狼人').length,
  };
};

/**
 * 构建条件化规则 - 只包含与当前游戏配置相关的规则
 * 渐进式披露的核心：没有的角色不提
 * @param {Object} existingRoles - 存在的角色标志
 * @param {Object} gameSetup - 游戏配置
 * @returns {string} 条件化规则字符串
 */
export const buildConditionalRules = (existingRoles, gameSetup) => {
  const rules = [];

  // 女巫相关规则 - 只在有女巫时添加
  if (existingRoles.hasWitch) {
    rules.push('女巫可报银水(救过的人)证明身份');
    rules.push('被女巫毒死的玩家无法使用技能');
  }

  // 守卫相关规则 - 只在有守卫时添加
  if (existingRoles.hasGuard) {
    rules.push('守卫不能连续两晚守同一人');
    // 同守同救规则 - 只在同时有女巫和守卫时添加
    if (existingRoles.hasWitch) {
      rules.push('【同守同救】守卫和女巫同时保护同一人会导致该玩家死亡');
    }
  }

  // 猎人相关规则 - 只在有猎人时添加
  if (existingRoles.hasHunter) {
    rules.push('猎人死亡时可开枪带走一人（被毒死除外）');
  }

  // 12人局警徽流规则
  if (isLargeGame(gameSetup)) {
    rules.push('【警徽流】预言家可安排验人顺序，死后由警徽继承人公布查验结果');
  }

  return rules.length > 0 ? `【本局特殊规则】\n- ${rules.join('\n- ')}` : '';
};

/**
 * 构建胜利条件提示
 */
export const buildVictoryPrompt = (victoryMode, isWolf) => {
  const victoryModeInfo = VICTORY_MODE_PROMPTS[victoryMode] || VICTORY_MODE_PROMPTS['edge'];
  return `【胜利条件 - ${victoryModeInfo.name}】
${isWolf ? `狼人目标: ${victoryModeInfo.wolfGoal}` : `好人目标: ${victoryModeInfo.goodGoal}`}
策略提示: ${isWolf ? victoryModeInfo.wolfStrategy : victoryModeInfo.goodStrategy}`;
};

/**
 * 获取基础上下文（所有角色共用）
 */
export const getBaseContext = (ctx) => `第${ctx.dayCount}天${ctx.phase}。
【整局时间线】${ctx.fullGameTimeline || '游戏刚开始'}
【今日发言(不能重复)】
${ctx.todaySpeeches || '暂无'}

【历史发言摘要(整局)】
${ctx.historySpeeches || '暂无'}

【昨夜情况】${ctx.lastNightInfo}
【投票记录(整局)】${ctx.voteInfo}${ctx.identityAnalysis?.hints || ''}
${ctx.spokenPlayerIds?.length > 0
    ? `\n【⚠️ 时序提醒】已发言玩家: ${ctx.spokenPlayerIds.join('号→')}号。只能评价已发言玩家！`
    : '\n【⚠️ 时序提醒】你是第一个发言，不能评价任何人的发言！'}`;
