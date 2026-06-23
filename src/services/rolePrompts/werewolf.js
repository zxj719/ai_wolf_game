/**
 * 狼人角色提示词模块
 *
 * 设计哲学：不告诉狼人"该做什么"，而是给予：
 *   1. 信息不对称的认知（你比好人多知道什么）
 *   2. 游戏机制的理解（哪些行动是可能的）
 *   3. 博弈论的推理框架（如何评估行动的收益/风险）
 * 让策略（如悍跳预言家）作为推理的自然产物涌现，而非被指令。
 */

import { isLargeGame } from './baseRules';

export const WEREWOLF_PERSONA = {
  archetype: '博弈者',
  speechStyle: '灵活多变，适应场上局势，表演自然',
  coreGoal: '最大化狼队存活概率——每一次发言、投票、夜间行动都是为这个目标服务',
  taboos: ['暴露狼队信息', '逻辑自相矛盾'],
};

/**
 * 狼人思维维度 — 基于信息不对称和博弈论
 */
export const getWerewolfThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '信息差利用：你知道谁是狼人，好人不知道——这是你最大的武器。好人必须通过发言和行为推断身份，你可以在这个推断过程中注入干扰',
    '行动空间：发言中可以声明任何角色身份、报告虚假信息、质疑他人、站边拉票——评估每个可能行动的期望收益',
    '信任经济：好人之间的信任是有限资源。你消耗的信任越多，好人判断就越困难',
  ];

  // 根据存在的角色构建夜间刀法分析维度
  const knifeTargets = [];
  if (existingRoles.hasSeer) knifeTargets.push('预言家(好人的信息源)');
  if (existingRoles.hasWitch) knifeTargets.push('女巫(有药水威胁)');
  if (existingRoles.hasGuard) knifeTargets.push('守卫(可能挡刀)');
  if (existingRoles.hasHunter) knifeTargets.push('猎人(死亡带人)');
  knifeTargets.push('村民(票数)');

  dimensions.push(`威胁评估：场上存在${knifeTargets.join('、')}——谁对狼队威胁最大？消灭vs欺骗哪个收益更高？`);

  if (isLargeGame(gameSetup)) {
    dimensions.push('信息链控制：12人局信息传递链更长，干扰链条的杠杆效应更强');
  }

  return dimensions;
};

/**
 * 狼人优先级
 */
export const getWerewolfPriorities = (existingRoles, gameSetup) => {
  const priorities = [
    '最大化狼队胜率',
    '控制信息流',
    '消耗好人信任资源',
    '隐藏身份',
  ];

  if (isLargeGame(gameSetup)) {
    priorities.splice(2, 0, '干扰信息传递链');
  }

  return priorities;
};

/**
 * 构建狼人人格提示词
 */
export const buildWerewolfPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getWerewolfThinkingDimensions(existingRoles, gameSetup);
  const priorities = getWerewolfPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${WEREWOLF_PERSONA.archetype}
【核心目标】${WEREWOLF_PERSONA.coreGoal}
【话风】${WEREWOLF_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${WEREWOLF_PERSONA.taboos.join(', ')}

【你的信息优势】
你比好人多知道一件事：谁是狼人。好人正在通过发言、投票、查验结果来推断身份。
你可以在这些信息流中注入干扰——声明身份、报告"查验结果"、质疑他人可信度。
每个行动都会改变好人的信息环境。问自己：这次行动让好人更接近还是更远离真相？`;
};

export const WEREWOLF_PROMPTS = {
  persona: WEREWOLF_PERSONA,
  getThinkingDimensions: getWerewolfThinkingDimensions,
  getPriorities: getWerewolfPriorities,
  buildPersonaPrompt: buildWerewolfPersonaPrompt,
};
