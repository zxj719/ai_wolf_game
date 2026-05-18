/**
 * 狼人角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext, isLargeGame, isMiniGame } from './baseRules';

// 狼人角色人格
export const WEREWOLF_PERSONA = {
  archetype: '伪装大师',
  speechStyle: '灵活多变，适应场上局势，表演自然',
  coreGoal: '生存至最后，同时抗推好人出局',
  taboos: ['暴露狼队信息', '逻辑自相矛盾', '过度划水被怀疑'],
  signalGameTips: '你可以通过给好人发"摸头金"来拉票，或给好人发"查杀"做低其身份'
};

/**
 * 获取狼人思维维度 - 根据存在的角色动态调整
 * @param {Object} existingRoles - 存在的角色标志
 * @param {Object} gameSetup - 游戏配置
 */
export const getWerewolfThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '悍跳逻辑：是否需要跳预言家？给谁发金水/查杀最有利？',
    '深水策略：如何在平民中潜伏，发言中庸不引人注意？',
    '倒钩战术：是否需要出卖队友换取信任？'
  ];

  // 根据存在的角色构建刀法优先级
  const priorities = [];
  if (existingRoles.hasWitch) priorities.push('女巫');
  if (existingRoles.hasSeer) priorities.push('预言家');
  if (existingRoles.hasGuard) priorities.push('守卫');
  if (existingRoles.hasHunter) priorities.push('猎人');
  priorities.push('村民');

  dimensions.push(`刀法规划：根据发言抿神职身份，优先级：${priorities.join('>')}`);

  // 12人局添加警徽流相关思考
  if (isLargeGame(gameSetup)) {
    dimensions.push('警徽流干扰：如何打断真预言家的警徽流传递？');
  }

  return dimensions;
};

/**
 * 获取狼人优先级 - 根据游戏配置调整
 */
export const getWerewolfPriorities = (existingRoles, gameSetup) => {
  const priorities = ['生存', '制造混乱', '保护狼队', '抗推好人'];

  // 12人局添加警徽流相关优先级
  if (isLargeGame(gameSetup)) {
    priorities.splice(2, 0, '干扰警徽流');
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
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${WEREWOLF_PERSONA.taboos.join(', ')}
【博弈提示】${WEREWOLF_PERSONA.signalGameTips}`;
};

/**
 * 狼人夜间行动提示词
 * 渐进式披露：只提及存在的神职
 */
export const getWerewolfNightActionPrompt = (params) => {
  const { validTargets, existingRoles, teammates, gameSetup, nightContext } = params;

  // 根据存在的角色构建刀法优先级
  const priorityParts = [];
  if (existingRoles.hasWitch) priorityParts.push('女巫(有毒药威胁)');
  if (existingRoles.hasSeer) priorityParts.push('预言家(信息源)');
  if (existingRoles.hasGuard) priorityParts.push('守卫(可能挡刀)');
  if (existingRoles.hasHunter) priorityParts.push('猎人(死亡带人，但值得换)');
  priorityParts.push('村民');

  // 构建策略提示 - 根据存在的角色动态生成
  const strategyHints = [];
  if (existingRoles.hasGuard) {
    strategyHints.push('守卫可能守护关键目标，考虑骗刀或集火');
  }
  if (existingRoles.hasWitch) {
    strategyHints.push('女巫首夜可能救人，但解药只有一瓶');
  }

  return `狼人袭击决策。
【重要规则】狼人每晚必须袭击一名玩家，不能空刀！你必须从下方目标中选择一个。
【可袭击目标】${validTargets.join(',')}号
【狼队友】${teammates?.length > 0 ? teammates.join(',') + '号' : '仅你一狼'}
${nightContext || ''}

【刀法优先级】${priorityParts.join(' > ')}
${strategyHints.length > 0 ? '【策略提示】\n- ' + strategyHints.join('\n- ') : ''}

【思维链】
1. 场上谁最像神职？根据发言判断
2. 今晚刀谁收益最大？
3. 狼队需要保护谁？

输出JSON:{"targetId":必须是数字(从可袭击目标中选择),"reasoning":"选择理由","thought":"刀法思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 狼人白天发言提示词
 */
export const getWerewolfDaySpeechPrompt = (ctx, params) => {
  return `${getBaseContext(ctx)}
【狼人专属任务】白天发言 - 你是一名伪装中的狼人

██ 铁律：thought 和 speech 是两个世界 ██
- thought = 内心独白（只有你能看到），自由分析策略。
- speech = 公开发言（所有人听到），必须100%像好人。
- speech 中绝对禁止出现：狼人、队友、刀、狼队、保狼、抗推 等狼人视角词汇。

【伪装原则】
- 好狼人 = 发言积极的好人。划水/沉默/被动防守最容易暴露。
- 主动分析、有观点、敢站边——和聪明村民的表现一模一样。

【策略（在thought中分析后选一个执行）】
A. 主动踩人：找好人发言破绽，引导怀疑他
B. 站边混入：站边可信玩家，悄悄把票引向无害方向
C. 悍跳预言家：风险高收益大，需要完整查验故事
D. 制造对立：在两个好人之间制造矛盾

【被怀疑/查杀时】反攻对方动机 + 转移话题到第三方 + 表现好人被冤枉的愤怒

输出JSON:{"thought":"狼人策略分析","speech":"完全伪装为好人的发言(40-100字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 狼人投票提示词
 */
export const getWerewolfVotePrompt = (params) => {
  const { aliveTargets, teammates, voteContext } = params;

  return `狼人投票决策。
【可投票目标】${aliveTargets.join(',')}号
【狼队友】${teammates?.length > 0 ? teammates.join(',') + '号(不要投他们！)' : '仅你一狼'}
${voteContext || ''}

【投票策略】
1. 绝不投狼队友
2. 优先投真预言家或神职
3. 跟票多数派掩护身份
4. 必要时归票换人保护狼队

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const WEREWOLF_PROMPTS = {
  persona: WEREWOLF_PERSONA,
  getThinkingDimensions: getWerewolfThinkingDimensions,
  getPriorities: getWerewolfPriorities,
  buildPersonaPrompt: buildWerewolfPersonaPrompt,
  nightAction: getWerewolfNightActionPrompt,
  daySpeech: getWerewolfDaySpeechPrompt,
  vote: getWerewolfVotePrompt
};
