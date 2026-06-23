/**
 * 守卫角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */


// 守卫角色人格
export const GUARD_PERSONA = {
  archetype: '暗夜守护者',
  speechStyle: '低调谨慎，隐藏身份防止被刀',
  coreGoal: '保护关键神职，打乱狼人刀法',
  taboos: ['连守同一目标', '首夜守人导致同救', '过早暴露身份'],
  signalGameTips: '守卫不宜过早跳身份，成功守护后可作为身份证明'
};

/**
 * 获取守卫思维维度 - 根据存在的角色动态调整
 */
export const getGuardThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '博弈思考：狼人会刀谁？我以为狼以为我会守谁？',
    '自守价值：守卫在场即是威慑，是否需要自守保命？',
    '刀法预判：根据场上局势预判狼人目标'
  ];

  // 只有在有女巫时才添加同守同救相关考虑
  if (existingRoles.hasWitch) {
    dimensions.unshift('守护次序：首晚空守配合女巫，避免同守同救');
  } else {
    dimensions.unshift('守护选择：优先守护关键神职或焦点位');
  }

  return dimensions;
};

/**
 * 获取守卫优先级 - 根据存在的角色调整
 */
export const getGuardPriorities = (existingRoles, gameSetup) => {
  const priorities = [];

  // 如果有预言家，守护预言家是第一优先级
  if (existingRoles.hasSeer) {
    priorities.push('守护预言家');
  }

  // 如果有女巫，添加避免同救的优先级
  if (existingRoles.hasWitch) {
    priorities.push('避免同守同救');
  }

  priorities.push('隐藏身份', '打乱刀法');

  return priorities;
};

/**
 * 构建守卫人格提示词
 */
export const buildGuardPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getGuardThinkingDimensions(existingRoles, gameSetup);
  const priorities = getGuardPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  // 动态调整禁忌 - 只有在有女巫时才提同救
  const taboos = existingRoles.hasWitch
    ? GUARD_PERSONA.taboos
    : GUARD_PERSONA.taboos.filter(t => !t.includes('同救'));

  return `
【角色原型】${GUARD_PERSONA.archetype}
【核心目标】${GUARD_PERSONA.coreGoal}
【话风】${GUARD_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${taboos.join(', ')}
【博弈提示】${GUARD_PERSONA.signalGameTips}`;
};

export const GUARD_PROMPTS = {
  persona: GUARD_PERSONA,
  getThinkingDimensions: getGuardThinkingDimensions,
  getPriorities: getGuardPriorities,
  buildPersonaPrompt: buildGuardPersonaPrompt,
};
