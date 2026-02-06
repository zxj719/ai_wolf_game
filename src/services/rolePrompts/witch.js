/**
 * 女巫角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext, isLargeGame } from './baseRules';

// 女巫角色人格
export const WITCH_PERSONA = {
  archetype: '资源管控者',
  speechStyle: '审慎稳重，关键时刻果断出手',
  coreGoal: '合理使用双药，最大化阵营收益',
  taboos: ['首夜不救人', '盲毒好人', '过早暴露身份', '浪费解药救狼'],
  signalGameTips: '女巫救起的人是银水，可作为身份证明；报出毒亡信息证明身份'
};

/**
 * 获取女巫思维维度 - 根据存在的角色动态调整
 */
export const getWitchThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '解药逻辑：救人的期望收益是否大于保留解药的防御价值？',
    '毒药逻辑：只有当某人逻辑完全崩坏时才考虑开毒',
    '轮次平衡：当前轮次用药是否划算？后续还有几轮？',
    '身份隐藏：在解药使用前，如何伪装成普通平民？'
  ];

  // 只有在有守卫时才添加同守同救相关考虑
  if (existingRoles.hasGuard) {
    dimensions.splice(1, 0, '同救风险：守卫可能也在守护，首夜救人需谨慎');
  }

  return dimensions;
};

/**
 * 获取女巫优先级
 */
export const getWitchPriorities = (existingRoles, gameSetup) => {
  return ['保护关键神职', '精准使用毒药', '隐藏身份', '关键时刻跳身份'];
};

/**
 * 构建女巫人格提示词
 */
export const buildWitchPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getWitchThinkingDimensions(existingRoles, gameSetup);
  const priorities = getWitchPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${WITCH_PERSONA.archetype}
【核心目标】${WITCH_PERSONA.coreGoal}
【话风】${WITCH_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 4).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${WITCH_PERSONA.taboos.join(', ')}
【博弈提示】${WITCH_PERSONA.signalGameTips}`;
};

/**
 * 女巫夜间行动提示词
 * 渐进式披露：根据有无守卫调整策略提示
 */
export const getWitchNightActionPrompt = (params) => {
  const { dyingPlayerId, hasPotion, hasPoison, aliveTargets, existingRoles, dayCount, nightContext } = params;

  // 首夜策略提示 - 根据有无守卫调整
  let firstNightHint = '';
  if (dayCount === 1) {
    if (existingRoles.hasGuard) {
      firstNightHint = '【首夜警告】守卫可能也在守护同一目标，同守同救会导致目标死亡！除非目标是关键神职，否则首夜建议不救。';
    } else {
      firstNightHint = '【首夜提示】没有守卫，救人不会有同守同救风险，可以放心救关键目标。';
    }
  }

  // 构建死亡信息
  const dyingInfo = dyingPlayerId !== null
    ? `【狼刀目标】${dyingPlayerId}号正在死亡，你可以使用解药救他`
    : '【狼刀结果】今晚无人被刀（守卫成功守护了目标）';

  return `女巫用药决策。
${dyingInfo}
【解药状态】${hasPotion ? '可用' : '已用完'}
【毒药状态】${hasPoison ? '可用' : '已用完'}
【存活玩家】${aliveTargets.join(',')}号
${firstNightHint}
${nightContext || ''}

【用药策略】
1. 解药：优先救预言家等关键神职
2. 毒药：只毒逻辑完全崩坏、高度确认的狼人
3. 不要同一晚又救又毒

【思维链】
1. 死亡目标是谁？值得救吗？
2. 如果不救，解药留着有什么价值？
3. 今晚需要开毒吗？毒谁？

输出JSON:{"useSave":true/false/null,"usePoison":数字或null,"poisonTarget":数字或null,"reasoning":"决策理由","thought":"用药思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 女巫白天发言提示词
 */
export const getWitchDaySpeechPrompt = (ctx, params) => {
  const { witchHistory, hasWitchSave, hasWitchPoison } = params;
  const savedInfo = witchHistory?.savedIds?.length > 0
    ? `救过:${witchHistory.savedIds.join(',')}号(银水)`
    : '';
  const poisonedInfo = witchHistory?.poisonedIds?.length > 0
    ? `毒过:${witchHistory.poisonedIds.join(',')}号`
    : '';

  return `${getBaseContext(ctx)}
【女巫专属任务】白天发言 - 隐藏身份/关键时刻跳

【你的药水状态】解药:${hasWitchSave ? '有' : '无'} | 毒药:${hasWitchPoison ? '有' : '无'}
${savedInfo} ${poisonedInfo}

【女巫发言策略】
1. 未跳身份前：像普通平民一样发言，不要暴露
2. 跳身份时机：当你的银水信息能帮助好人判断时
3. 跳身份内容：报出银水（你救过的人），证明你是真女巫
4. 配合预言家：银水+金水可以锁定好人

【思维链】
Step1: 我需要跳身份吗？跳身份的收益是什么？
Step2: 如果不跳，我应该像平民一样说什么？
Step3: 我的投票应该投谁？

输出JSON:{"thought":"女巫视角分析...","speech":"发言内容(40-80字)","voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 女巫投票提示词
 */
export const getWitchVotePrompt = (params) => {
  const { aliveTargets, witchHistory, voteContext } = params;

  const savedIds = witchHistory?.savedIds || [];

  return `女巫投票决策。
【可投票目标】${aliveTargets.join(',')}号
${savedIds.length > 0 ? `【银水】${savedIds.join(',')}号(你救过的人，通常是好人)` : ''}
${voteContext || ''}

【投票策略】
1. 优先投确认的狼人
2. 不要投你的银水（除非有强证据证明是狼）
3. 配合预言家的查杀

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const WITCH_PROMPTS = {
  persona: WITCH_PERSONA,
  getThinkingDimensions: getWitchThinkingDimensions,
  getPriorities: getWitchPriorities,
  buildPersonaPrompt: buildWitchPersonaPrompt,
  nightAction: getWitchNightActionPrompt,
  daySpeech: getWitchDaySpeechPrompt,
  vote: getWitchVotePrompt
};
