/**
 * 村民角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext } from './baseRules';

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

/**
 * 村民白天发言提示词
 * 渐进式披露：根据有无预言家调整策略
 */
export const getVillagerDaySpeechPrompt = (ctx, params) => {
  const { existingRoles } = params;

  // 根据有无预言家调整策略点
  const strategyPoints = [];
  if (existingRoles.hasSeer) {
    strategyPoints.push('敢于站边：在两个预言家中选择一个相信');
  }
  strategyPoints.push('逻辑分析：分析发言中的破绽和动机');
  if (existingRoles.hasSeer) {
    strategyPoints.push('投票正确：跟着你相信的预言家投票');
  } else {
    strategyPoints.push('投票正确：根据逻辑分析投票');
  }
  strategyPoints.push('不被带节奏：狼人可能会利用你');

  // 根据有无预言家调整思维链
  const thinkingSteps = [];
  if (existingRoles.hasSeer) {
    thinkingSteps.push('有几个人跳预言家？谁更可信？');
  }
  thinkingSteps.push('场上谁的发言最可疑？理由是什么？');
  if (existingRoles.hasSeer) {
    thinkingSteps.push('我应该站边谁？为什么？');
  }
  thinkingSteps.push('我的投票应该投谁？');

  return `${getBaseContext(ctx)}
【村民专属任务】白天发言 - 站边/找狼

【村民发言策略】
${strategyPoints.map((s, i) => `${i + 1}. ${s}`).join('\n')}

【思维链】
${thinkingSteps.map((s, i) => `Step${i + 1}: ${s}`).join('\n')}

输出JSON:{"thought":"平民视角分析...","speech":"发言内容(40-80字)","voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 村民投票提示词
 */
export const getVillagerVotePrompt = (params) => {
  const { aliveTargets, voteContext, existingRoles } = params;

  // 根据有无预言家调整策略
  const strategies = [];
  if (existingRoles.hasSeer) {
    strategies.push('跟着你相信的预言家投票');
    strategies.push('优先投被查杀的玩家');
  }
  strategies.push('投票给最可疑的玩家');
  strategies.push('不要被狼人带节奏');

  return `村民投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}

【投票策略】
${strategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const VILLAGER_PROMPTS = {
  persona: VILLAGER_PERSONA,
  getThinkingDimensions: getVillagerThinkingDimensions,
  getPriorities: getVillagerPriorities,
  buildPersonaPrompt: buildVillagerPersonaPrompt,
  daySpeech: getVillagerDaySpeechPrompt,
  vote: getVillagerVotePrompt
};
