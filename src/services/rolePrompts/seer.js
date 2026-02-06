/**
 * 预言家角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext, isLargeGame } from './baseRules';

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

/**
 * 预言家夜间行动提示词
 */
export const getSeerNightActionPrompt = (params) => {
  const { validTargets, seerChecks, gameSetup, nightContext } = params;

  // 构建已查验信息
  const checkedInfo = seerChecks?.length > 0
    ? seerChecks.map(c => `N${c.night}:${c.targetId}号${c.isWolf ? '狼' : '好'}`).join(', ')
    : '无';

  return `预言家查验选择。
【可查验目标】${validTargets.join(',')}号
【已查验记录】${checkedInfo}
${nightContext || ''}

【查验策略】
1. 优先查焦点位（被多人质疑或站边的玩家）
2. 查定点位（发言中庸难以判断的玩家）
3. 不要重复查验已确认的目标

【思维链】
1. 谁的身份最需要确认？
2. 查验结果如何帮助好人阵营？
3. 准备好"心路历程"解释为什么查这个人

输出JSON:{"targetId":数字,"reasoning":"查验理由","thought":"查验思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 预言家白天发言提示词
 */
export const getSeerDaySpeechPrompt = (ctx, params) => {
  const { seerChecks, playerId, gameSetup } = params;

  const myChecks = seerChecks?.filter(c => c.seerId === playerId) || [];
  const checksInfo = myChecks.length > 0
    ? myChecks.map(c => `N${c.night}:${c.targetId}号是${c.isWolf ? '【狼人】' : '【好人】'}`).join(', ')
    : '无查验记录';
  const goldWaters = myChecks.filter(c => !c.isWolf).map(c => c.targetId);
  const wolves = myChecks.filter(c => c.isWolf).map(c => c.targetId);

  // 只有12人局才有警徽流
  const hasPoliceFlow = isLargeGame(gameSetup);
  const policeFlowPoint = hasPoliceFlow ? '\n4. 安排警徽流（如果你可能被刀）' : '';
  const lastPointNumber = hasPoliceFlow ? '5' : '4';

  return `${getBaseContext(ctx)}
【预言家专属任务】白天发言 - 报验人/带节奏

【你的查验记录】${checksInfo}
${goldWaters.length > 0 ? `【金水(好人)】${goldWaters.join(',')}号 - 绝不能投他们！` : ''}
${wolves.length > 0 ? `【查杀(狼人)】${wolves.join(',')}号 - 必须推出！` : ''}

【预言家发言要点】
1. 第一时间报出所有查验结果
2. 分析"心路历程"：为什么查这个人
3. 如果有人对跳，分析其逻辑漏洞${policeFlowPoint}
${lastPointNumber}. 带领好人投票，集中火力

【思维链】
Step1: 我今天需要报什么验人？
Step2: 场上谁在质疑我？如何反驳？
Step3: 如何用查验结果建立我的公信力？
Step4: 投票应该投谁？（查杀 > 可疑者，绝不投金水！）

输出JSON:{"thought":"预言家视角分析...","speech":"报验人+分析(40-80字)","voteIntention":数字(不能是金水号码),"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 预言家投票提示词
 */
export const getSeerVotePrompt = (params) => {
  const { aliveTargets, seerChecks, playerId, voteContext } = params;

  const myChecks = seerChecks?.filter(c => c.seerId === playerId) || [];
  const wolves = myChecks.filter(c => c.isWolf && aliveTargets.includes(c.targetId)).map(c => c.targetId);
  const goldWaters = myChecks.filter(c => !c.isWolf).map(c => c.targetId);

  return `预言家投票决策。
【可投票目标】${aliveTargets.join(',')}号
${wolves.length > 0 ? `【必投】${wolves.join(',')}号(你查出的狼人!)` : ''}
${goldWaters.length > 0 ? `【禁投】${goldWaters.join(',')}号(你的金水!)` : ''}
${voteContext || ''}

【投票优先级】
1. 必投你查杀的狼人
2. 次投悍跳预言家
3. 绝不投你的金水

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const SEER_PROMPTS = {
  persona: SEER_PERSONA,
  getThinkingDimensions: getSeerThinkingDimensions,
  getPriorities: getSeerPriorities,
  buildPersonaPrompt: buildSeerPersonaPrompt,
  nightAction: getSeerNightActionPrompt,
  daySpeech: getSeerDaySpeechPrompt,
  vote: getSeerVotePrompt
};
