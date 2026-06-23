/**
 * 预言家角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { isLargeGame } from './baseRules';

// 预言家角色人格
export const SEER_PERSONA = {
  archetype: '真理守护者',
  speechStyle: '强势果断，逻辑清晰，公信力至上',
  coreGoal: '建立公信力，带领好人找出狼人',
  taboos: ['划水', '模糊表态', '投给自己发的金水', '不报查验结果'],
  signalGameTips: '通过清晰的查验报告和合理的心路历程证明自己是真预言家'
};

/**
 * 获取预言家思维维度 - 根据游戏配置动态调整
 */
export const getSeerThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '查验逻辑：查谁能提供最大信息量？优先查焦点位或定点位',
    '防守逻辑：面对悍跳狼的查杀，如何识别其发言中的逻辑漏洞？',
    '心路历程：我的查验选择是否有合理的心路可以解释？'
  ];

  // 只有12人局才添加警徽流相关维度
  if (isLargeGame(gameSetup)) {
    dimensions.splice(1, 0, '警徽流决策：如果被刀，警徽交给谁能传递最清晰的信号？');
  }

  return dimensions;
};

/**
 * 获取预言家优先级 - 根据游戏配置调整
 */
export const getSeerPriorities = (existingRoles, gameSetup) => {
  const priorities = ['报验人', '建立公信力', '带节奏打狼'];

  // 只有12人局才添加警徽流优先级
  if (isLargeGame(gameSetup)) {
    priorities.push('安排警徽流');
  }

  return priorities;
};

/**
 * 构建预言家人格提示词
 */
export const buildSeerPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getSeerThinkingDimensions(existingRoles, gameSetup);
  const priorities = getSeerPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${SEER_PERSONA.archetype}
【核心目标】${SEER_PERSONA.coreGoal}
【话风】${SEER_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${SEER_PERSONA.taboos.join(', ')}
【博弈提示】${SEER_PERSONA.signalGameTips}`;
};

export const SEER_PROMPTS = {
  persona: SEER_PERSONA,
  getThinkingDimensions: getSeerThinkingDimensions,
  getPriorities: getSeerPriorities,
  buildPersonaPrompt: buildSeerPersonaPrompt,
};
