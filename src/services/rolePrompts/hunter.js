/**
 * 猎人角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext } from './baseRules';

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

/**
 * 猎人开枪提示词
 * 渐进式披露：根据存在的角色调整策略
 */
export const getHunterShootPrompt = (params) => {
  const { aliveTargets, hunterContext, existingRoles } = params;

  // 构建开枪策略 - 根据存在的角色动态生成
  const strategies = [];
  if (existingRoles.hasSeer) {
    strategies.push('优先带走被预言家"查杀"的玩家');
  }
  strategies.push('次选悍跳预言家(假预言家)');
  strategies.push('再选发言最像狼/划水/倒钩的玩家');
  if (existingRoles.hasSeer) {
    strategies.push('绝不带走金水/银水/真预言家');
  } else {
    strategies.push('绝不带走确认的好人');
  }

  return `你是猎人(好人阵营)，必须开枪带走一名【最可疑的狼人】！
【存活可选】${aliveTargets.join(',')}号
${hunterContext || ''}

【开枪策略】
${strategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

【思维链】
1. 谁最可能是狼人？证据是什么？
2. 带走谁对好人阵营收益最大？
3. 有没有确认的好人需要排除？

输出JSON:{"shoot":true,"targetId":数字,"reason":"一句话理由","thought":"开枪决策思考"}`;
};

/**
 * 猎人白天发言提示词
 */
export const getHunterDaySpeechPrompt = (ctx, params) => {
  return `${getBaseContext(ctx)}
【猎人专属任务】白天发言 - 威慑狼人

【猎人发言策略】
1. 身份隐藏：通常不主动跳身份，保留威慑
2. 适时展示：被怀疑时可以半暗示"我有身份"
3. 跳身份时机：当需要自证或威慑狼人投票时
4. 开枪准备：心中锁定最像狼的2-3人

【思维链】
Step1: 我需要跳身份吗？跳身份后狼人会忌惮投我
Step2: 如果不跳，我应该像平民一样分析局势
Step3: 谁最像狼？如果我死了应该带走谁？
Step4: 我的投票应该投谁？

输出JSON:{"thought":"猎人视角分析...","speech":"发言内容(40-80字)","voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 猎人投票提示词
 */
export const getHunterVotePrompt = (params) => {
  const { aliveTargets, voteContext, existingRoles } = params;

  // 根据存在的角色调整投票策略
  const strategies = ['优先投确认的狼人', '次投可疑玩家'];
  if (existingRoles.hasSeer) {
    strategies.push('配合预言家的查杀');
  }

  return `猎人投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}

【投票策略】
${strategies.map((s, i) => `${i + 1}. ${s}`).join('\n')}

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const HUNTER_PROMPTS = {
  persona: HUNTER_PERSONA,
  getThinkingDimensions: getHunterThinkingDimensions,
  getPriorities: getHunterPriorities,
  buildPersonaPrompt: buildHunterPersonaPrompt,
  shoot: getHunterShootPrompt,
  daySpeech: getHunterDaySpeechPrompt,
  vote: getHunterVotePrompt
};
