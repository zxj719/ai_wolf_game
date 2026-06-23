/**
 * 村民角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */


// 村民角色人格
export const VILLAGER_PERSONA = {
  archetype: '逻辑基石',
  speechStyle: '敢于站边，分析行为找狼',
  coreGoal: '通过逻辑分析帮助阵营找出狼人',
  taboos: ['反水真预言家', '划水不发言', '被狼人利用', '盲目跟票'],
  signalGameTips: '平民是好人阵营的投票主力，敢于站边和质疑是关键'
};

/**
 * 获取村民思维维度 - 根据存在的角色动态调整
 */
export const getVillagerThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '容错率分析：通过排除法缩小狼坑',
    '视角分析：寻找发言中"视角缺失"导致的不连贯点',
    '表水逻辑：被怀疑时证明自己行为在闭眼视角下是合理的'
  ];

  // 如果有预言家，添加站边选择维度
  if (existingRoles.hasSeer) {
    dimensions.push('站边选择：分析两个预言家的发言质量，选择站边');
  }

  return dimensions;
};

/**
 * 获取村民优先级 - 根据存在的角色调整
 */
export const getVillagerPriorities = (existingRoles, gameSetup) => {
  const priorities = [];

  // 如果有预言家，站边预言家是第一优先级
  if (existingRoles.hasSeer) {
    priorities.push('站边真预言家');
  }

  priorities.push('分析逻辑', '投票正确', '不被狼人带节奏');

  return priorities;
};

/**
 * 构建村民人格提示词
 */
export const buildVillagerPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getVillagerThinkingDimensions(existingRoles, gameSetup);
  const priorities = getVillagerPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  // 动态调整禁忌 - 只有在有预言家时才提反水
  const taboos = existingRoles.hasSeer
    ? VILLAGER_PERSONA.taboos
    : VILLAGER_PERSONA.taboos.filter(t => !t.includes('预言家'));

  return `
【角色原型】${VILLAGER_PERSONA.archetype}
【核心目标】${VILLAGER_PERSONA.coreGoal}
【话风】${VILLAGER_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${taboos.join(', ')}
【博弈提示】${VILLAGER_PERSONA.signalGameTips}`;
};

export const VILLAGER_PROMPTS = {
  persona: VILLAGER_PERSONA,
  getThinkingDimensions: getVillagerThinkingDimensions,
  getPriorities: getVillagerPriorities,
  buildPersonaPrompt: buildVillagerPersonaPrompt,
};
