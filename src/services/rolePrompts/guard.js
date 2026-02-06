/**
 * 守卫角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext } from './baseRules';

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

/**
 * 守卫夜间行动提示词
 * 渐进式披露：根据有无女巫调整策略提示
 */
export const getGuardNightActionPrompt = (params) => {
  const { validTargets, cannotGuard, existingRoles, dayCount, guardHistory, nightContext } = params;

  // 首夜策略 - 根据有无女巫调整
  let firstNightHint = '';
  if (dayCount === 1) {
    if (existingRoles.hasWitch) {
      firstNightHint = '【首夜策略】建议空守(null)避免同守同救触发规则。女巫首夜可能救人，你守护同一目标会导致目标死亡！';
    } else {
      firstNightHint = '【首夜策略】没有女巫，不存在同守同救风险。可以直接守护你认为最关键的目标。';
    }
  }

  // 构建不能守护的提示
  const cannotGuardHint = cannotGuard !== null && cannotGuard !== undefined
    ? `\n【禁止连守】${cannotGuard}号(昨晚守过，今晚不能连守)`
    : '';

  // 构建守护历史
  const historyInfo = guardHistory?.length > 0
    ? `【守护历史】${guardHistory.map(g => `N${g.night}:守${g.targetId}号`).join(', ')}`
    : '';

  return `守卫守护选择。
【可守护目标】${validTargets.join(',')}号（或输入null空守）${cannotGuardHint}
${historyInfo}
${firstNightHint}
${nightContext || ''}

【守护策略】
1. 预判狼人刀法，守护最可能被刀的玩家
2. 不能连续守同一人
3. 博弈思考：狼人知道我存在，会不会骗刀？

【思维链】
1. 场上谁最像预言家/关键神职？
2. 狼人今晚最可能刀谁？
3. 我应该守护谁或者空守？

输出JSON:{"targetId":数字或null,"reasoning":"守护理由","thought":"守护思考过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 守卫白天发言提示词
 */
export const getGuardDaySpeechPrompt = (ctx, params) => {
  const { guardHistory, lastGuardTarget } = params;
  const guardInfo = guardHistory?.length > 0
    ? guardHistory.map(g => `N${g.night}:守${g.targetId}号`).join(',')
    : '无守护记录';

  return `${getBaseContext(ctx)}
【守卫专属任务】白天发言 - 隐藏身份

【你的守护记录】${guardInfo}
${lastGuardTarget !== null ? `【注意】昨夜守了${lastGuardTarget}号，今晚不能连守` : ''}

【守卫发言策略】
1. 低调潜伏：守卫一般不跳身份，被刀是好事（说明守对了）
2. 像平民：发言内容要像普通村民一样分析
3. 跳身份时机：只有当你的守护信息能关键证明某人身份时
4. 博弈思考：根据发言判断今晚守谁

【思维链】
Step1: 我绝对不能暴露守卫身份
Step2: 场上谁像预言家？我今晚可能需要守他
Step3: 像平民一样分析，我应该说什么？
Step4: 我的投票应该投谁？

输出JSON:{"thought":"守卫视角分析...","speech":"像平民的发言(40-80字)","voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 守卫投票提示词
 */
export const getGuardVotePrompt = (params) => {
  const { aliveTargets, voteContext } = params;

  return `守卫投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}

【投票策略】
1. 像平民一样投票，不要暴露身份
2. 优先投确认的狼人
3. 保护你守护过的目标（如果他们是好人）

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const GUARD_PROMPTS = {
  persona: GUARD_PERSONA,
  getThinkingDimensions: getGuardThinkingDimensions,
  getPriorities: getGuardPriorities,
  buildPersonaPrompt: buildGuardPersonaPrompt,
  nightAction: getGuardNightActionPrompt,
  daySpeech: getGuardDaySpeechPrompt,
  vote: getGuardVotePrompt
};
