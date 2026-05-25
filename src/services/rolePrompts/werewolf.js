/**
 * 狼人角色提示词模块
 *
 * 设计哲学：不告诉狼人"该做什么"，而是给予：
 *   1. 信息不对称的认知（你比好人多知道什么）
 *   2. 游戏机制的理解（哪些行动是可能的）
 *   3. 博弈论的推理框架（如何评估行动的收益/风险）
 * 让策略（如悍跳预言家）作为推理的自然产物涌现，而非被指令。
 */

import { getBaseContext, isLargeGame, isMiniGame } from './baseRules';

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

/**
 * 狼人夜间行动提示词
 */
export const getWerewolfNightActionPrompt = (params) => {
  const { validTargets, existingRoles, teammates, gameSetup, nightContext } = params;

  const threatAnalysis = [];
  if (existingRoles.hasSeer) threatAnalysis.push('预言家每晚获得一条确定性信息——存活越久，狼队暴露概率越高');
  if (existingRoles.hasWitch) threatAnalysis.push('女巫有救人和毒杀能力——首夜可能救人');
  if (existingRoles.hasGuard) threatAnalysis.push('守卫可能保护关键目标——需要考虑博弈');
  if (existingRoles.hasHunter) threatAnalysis.push('猎人死亡时可带走一人——需要权衡交换价值');

  return `狼人袭击决策。
【重要规则】狼人每晚必须袭击一名玩家，不能空刀！
【可袭击目标】${validTargets.join(',')}号
【狼队友】${teammates?.length > 0 ? teammates.join(',') + '号' : '仅你一狼'}
${nightContext || ''}

【威胁分析】
${threatAnalysis.length > 0 ? threatAnalysis.map(t => `- ${t}`).join('\n') : '- 分析场上谁对狼队威胁最大'}

【思维链】
1. 根据白天发言，谁最可能是什么角色？
2. 消灭谁对狼队的期望收益最大？（考虑信息链、投票权、技能威胁）
3. 对方可能被保护吗？是否需要声东击西？

输出JSON:{"targetId":必须是数字(从可袭击目标中选择),"reasoning":"选择理由","thought":"完整刀法推演过程","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}`;
};

/**
 * 狼人白天发言提示词
 * 不提供策略菜单——让AI通过博弈推理自行发现最优策略
 */
export const getWerewolfDaySpeechPrompt = (ctx, params) => {
  return `${getBaseContext(ctx)}
【狼人专属任务】白天发言 — 最大化狼队胜率

██ 铁律：thought 和 speech 是两个世界 ██
- thought = 完整策略推演（只有你能看到），自由分析、推理、规划
- speech = 公开发言（所有人听到），必须100%像好人
- speech 中绝对禁止出现：狼人、队友、刀、狼队、保狼、抗推 等任何狼人视角词汇
- 也不要跳出游戏评论游戏本身

【你的信息优势】
你知道谁是狼谁是好人。好人不知道。
好人正在通过发言、投票和角色声明来推断每个人的身份——你可以在这些信息流中制造对狼队有利的干扰。

【游戏机制认知】
- 任何玩家都可以在发言中声明自己是任何角色（这是游戏允许的行为）
- 当多人声明同一角色时，好人必须花时间分辨真假——这个争论过程对狼队有利
- 投票是好人白天唯一的消灭手段——分散票型就是保护狼队
- 查验结果是好人最核心的信息源——控制或干扰这条信息链的杠杆效应极高

【思维框架（在 thought 中完成，不要写进 speech）】
Step1 局势评估：存活狼人/好人比？距离胜利条件多远？紧迫程度？
Step2 威胁识别：谁对狼队威胁最大？谁掌握了危险的信息？谁在建立公信力？
Step3 行动空间分析：我这次发言可以做什么？（分析、站边、质疑、声明身份、报告信息……）每种行动的预期收益和暴露风险各是多少？
Step4 最优行动选择：选择 收益/风险 比最高的行动执行
Step5 投票规划：场上票型分布？我的投票如何既推进狼队目标又不暴露身份？

【被怀疑时】不要慌乱——分析对方质疑的逻辑漏洞，用事实反驳，必要时引导话题到第三方

输出JSON:{"thought":"完整的博弈推理过程（这里可以自由分析狼人策略）","speech":"完全像好人的公开发言(40-100字)","voteIntention":数字或-1,"voteDecided":true或false,"identity_table":{"玩家号":{"suspect":"角色猜测","confidence":0-100,"reason":"推理依据"}}}
voteDecided=true=已决定；false=投票阶段再思考`;
};

/**
 * 狼人投票提示词
 */
export const getWerewolfVotePrompt = (params) => {
  const { aliveTargets, teammates, voteContext } = params;

  return `狼人投票决策。
【可投票目标】${aliveTargets.join(',')}号
【狼队友】${teammates?.length > 0 ? teammates.join(',') + '号' : '仅你一狼'}
${voteContext || ''}

【投票博弈】
- 你的投票既是消灭手段也是身份信号——好人会分析你的投票行为
- 考虑：投谁对狼队最有利？这个投票会暴露你的身份吗？
- 考虑票型：你的票能否影响最终结果？跟随多数还是制造意外？

输出JSON:{"targetId":数字,"reasoning":"投票理由","thought":"投票博弈分析"}`;
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
