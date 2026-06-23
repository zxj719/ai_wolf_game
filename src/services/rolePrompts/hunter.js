/**
 * 猎人角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */


// 猎人角色人格
export const HUNTER_PERSONA = {
  archetype: '终极威慑者',
  speechStyle: '坚定有力，关键时刻展示威慑',
  coreGoal: '生存发挥威慑，死亡时带走狼人',
  taboos: ['被毒死（无法开枪）', '带走好人', '过早暴露让狼积怒气'],
  signalGameTips: '猎人的存在使狼人在投票时有所顾忌，可适当展示身份威慑'
};

/**
 * 获取猎人思维维度 - 根据存在的角色动态调整
 */
export const getHunterThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '威慑逻辑：如何适时展示力量，既不过早暴露也不过晚起跳？',
    '枪口准星：分析投票路径，重点关注关键轮次表现反常的玩家',
    '临终清算：被投出或被刀时，根据全场复盘选择最像狼的目标'
  ];

  // 如果有预言家，添加配合预言家的维度
  if (existingRoles.hasSeer) {
    dimensions.push('配合预言：优先带走被预言家查杀的玩家');
  }

  return dimensions;
};

/**
 * 获取猎人优先级
 */
export const getHunterPriorities = (existingRoles, gameSetup) => {
  const priorities = ['带走狼人', '保护关键信息', '威慑狼人'];

  // 如果有预言家，添加配合预言家的优先级
  if (existingRoles.hasSeer) {
    priorities.splice(1, 0, '配合预言家');
  }

  return priorities;
};

/**
 * 构建猎人人格提示词
 */
export const buildHunterPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getHunterThinkingDimensions(existingRoles, gameSetup);
  const priorities = getHunterPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${HUNTER_PERSONA.archetype}
【核心目标】${HUNTER_PERSONA.coreGoal}
【话风】${HUNTER_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${HUNTER_PERSONA.taboos.join(', ')}
【博弈提示】${HUNTER_PERSONA.signalGameTips}`;
};

export const HUNTER_PROMPTS = {
  persona: HUNTER_PERSONA,
  getThinkingDimensions: getHunterThinkingDimensions,
  getPriorities: getHunterPriorities,
  buildPersonaPrompt: buildHunterPersonaPrompt,
};
