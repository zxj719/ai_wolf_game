/**
 * 摄梦人角色提示词模块
 * 兼具保护与进攻双重属性，俗称"睡杀"
 *
 * 核心机制：
 * 1. 每晚必须选择一名玩家"入梦"（不能是自己）
 * 2. 被入梦者当晚免疫狼刀和毒药
 * 3. 连续两晚入梦同一人 → 该人直接死亡（无法被救）
 * 4. 摄梦人死亡 → 被入梦者也一同死亡（同生共死）
 */

import { getBaseContext } from './baseRules';

// 摄梦人角色人格
export const DREAMWEAVER_PERSONA = {
  archetype: '无声守护者与致命连接者',
  speechStyle: '谨慎低调，逻辑缜密，善于隐藏身份',
  coreGoal: '利用入梦机制保护核心好人，并通过连梦清除狼人',
  taboos: ['过早暴露身份', '随意连梦好人', '忽视同生共死风险'],
  signalGameTips: '你的技能是双刃剑，每次入梦都可能成为你的陪葬品'
};

/**
 * 获取摄梦人思维维度
 */
export const getDreamweaverThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '核心目标识别（预言家/关键好人）',
    '狼人嫌疑排查',
    '入梦历史分析',
    '死亡风险评估',
    '连梦时机把握'
  ];

  if (existingRoles.hasWitch) {
    dimensions.push('女巫药品状态推测');
  }

  if (existingRoles.hasGuard) {
    dimensions.push('守卫保护目标预判');
  }

  return dimensions;
};

/**
 * 获取摄梦人优先级
 */
export const getDreamweaverPriorities = (existingRoles, gameSetup) => {
  return [
    '保护真预言家（防守模式优先级A）',
    '连梦击杀悍跳狼（进攻模式优先级B）',
    '临死拉垫背大狼（殉情模式优先级C）',
    '避免入梦女巫/猎人（减少连带损失）',
    '绝不连续入梦同一好人（防止误杀）',
    '前期隐藏身份（避免被狼精准刀）'
  ];
};

/**
 * 构建摄梦人人格提示词
 */
export const buildDreamweaverPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getDreamweaverThinkingDimensions(existingRoles, gameSetup);
  const priorities = getDreamweaverPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${DREAMWEAVER_PERSONA.archetype}
【核心矛盾】你保护的人可能因你而死（连梦或随你而去），你的选择也可能成为你的陪葬品
【核心目标】${DREAMWEAVER_PERSONA.coreGoal}
【话风】${DREAMWEAVER_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 6).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${DREAMWEAVER_PERSONA.taboos.join(', ')}
【博弈提示】${DREAMWEAVER_PERSONA.signalGameTips}`;
};

/**
 * 摄梦人白天发言提示词
 */
export const getDreamweaverDaySpeechPrompt = (ctx, params) => {
  const { dreamHistory, lastDreamTarget } = params;

  const lastNightInfo = lastDreamTarget !== null
    ? `你昨晚入梦了 ${lastDreamTarget}号`
    : '你昨晚未入梦（异常情况）';

  // R60 DAY→DAY 读写闭环：历史连梦候选读取步骤（与 NIGHT_DREAMWEAVER Step 0 共用"连梦候选"关键词）
  const dreamweaverDayHistoryStep = ctx.dayCount > 1
    ? 'Step0: 【读取历史连梦候选与防御目标（D2+适用）】查看系统提示中【你之前的身份推理表】：哪些玩家的 reason 含"连梦候选"标注？将其作为今晚进攻策略的评估起点（结合今日新发言判断是否升级/降级威胁；已死亡目标跳过）。含"防御入梦候选"的玩家是今晚优先入梦的保护对象。'
    : 'Step0: 【首日无历史候选记录】直接从 Step1 开始——今天是第一天，尚无跨轮积累的连梦/防御候选。';

  // R77：摄梦人 DAY_SPEECH 个性化发言风格（personalityLens）
  const dwPersonalityType = params.personalityType || '';
  let dreamweaverPersonalityLens = '';
  if (dwPersonalityType === 'aggressive') {
    dreamweaverPersonalityLens = '\n【你的发言风格】主动引导型：以积极主张建立场上影响力，勇于推动话题和投票方向；当需要你站出来发声时不退缩——即使在身份未暴露时，也能用有力的逻辑帮好人指明方向。';
  } else if (dwPersonalityType === 'cautious') {
    dreamweaverPersonalityLens = '\n【你的发言风格】低调观察型：语气审慎，多倾听少表态，优先在安全边际内发言；避免引起注意，让他人先暴露，你在后排积累判断，到关键时机才精准出手。';
  } else if (dwPersonalityType === 'logical' || dwPersonalityType === 'analytical') {
    dreamweaverPersonalityLens = '\n【你的发言风格】推理分析型：以严密逻辑链说话，将昨晚死亡信息纳入分析框架，给出有据可查的推断；每句话都落地在数据或行为证据上，展示高可信度的分析能力。';
  } else if (dwPersonalityType === 'cunning') {
    dreamweaverPersonalityLens = '\n【你的发言风格】暗示感知型：话里有话，让特定玩家感到你对他们有所了解；用暗示而非明说制造"你知道更多"的氛围，在不暴露身份的前提下传递信息压力。';
  } else if (dwPersonalityType === 'emotional') {
    dreamweaverPersonalityLens = '\n【你的发言风格】直觉感知型：用感受和直觉引导发言（"我感觉X今天有点不对劲"），情感色彩丰富，表达上更感性——让好人感受到你的真诚，同时让狼人难以从逻辑上反驳你。';
  } else if (dwPersonalityType === 'contrarian') {
    dreamweaverPersonalityLens = '\n【你的发言风格】反预判型：主动质疑当天主流的票型和分析方向，立场出人意料；在大多数人认为某人安全时提出不同声音，在大多数人怀疑某人时提供反向视角，制造信息搅动。';
  } else if (dwPersonalityType === 'steady') {
    dreamweaverPersonalityLens = '\n【你的发言风格】平衡渐进型：稳扎稳打，每句话都有依据，不轻易表态；先听完所有人再发声，言出必有证据，逐步积累信任，在关键时刻用已建立的可信度发力。';
  }
  let dreamweaverSpeechLen = '40-70';
  if (dwPersonalityType === 'aggressive') dreamweaverSpeechLen = '45-75';
  else if (dwPersonalityType === 'cautious') dreamweaverSpeechLen = '35-60';
  else if (dwPersonalityType === 'steady') dreamweaverSpeechLen = '40-65';

  return `${getBaseContext(ctx)}
【摄梦人专属任务】白天发言 - 隐藏身份与逻辑输出

${lastNightInfo}
${dreamweaverPersonalityLens}
【发言策略三阶段】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

阶段1 - 潜伏期（身份未暴露）：
  - 发言要像一个有逻辑的平民
  - 不要轻易点评死讯是否与梦境有关
  - 防止狼人反推你的身份
  - 语气要自然、不做作

阶段2 - 博弈期（需要跳身份时）：
  - 如果你需要跳身份保人，必须清晰报出每晚的"入梦名单"
  - 话术示例："我是摄梦人。第一晚入梦 3号（保护预言家），第二晚入梦 7号（更换目标防止连梦）。"
  - 入梦名单可以帮助好人还原死讯逻辑

阶段3 - 威慑期（被怀疑时）：
  - 话术示例："狼人最好不要今晚动我，我已经连好了你们其中的一员，我走，他也得走。"
  - 利用"同生共死"机制形成威慑
  - 暗示你已经入梦了狼人，增加狼人的刀人顾虑

【死讯逻辑分析】
你需要根据昨晚的入梦情况，分析今早的死讯：

情况A - 单死，且死者不是你入梦的人：
  → 说明死者被狼刀或毒药击杀
  → 你入梦的人受到了保护（免疫生效）

情况B - 双死，其中一人是你入梦的人：
  → 异常情况！因为入梦者应该免疫
  → 可能是：你自己死了（触发同生共死）
  → 或者是女巫撒毒（但毒药也应该被免疫）

情况C - 你入梦的人存活：
  → 说明你的保护生效
  → 如果预言家报此人为狼且没死，你要意识到这是由于你的保护

情况D - 如果你连梦的目标死了：
  → 说明你成功"睡杀"
  → 白天可以适时透露信息（如果该目标是狼）

【思维链（必须完成）】
${dreamweaverDayHistoryStep}
Step1: 昨晚入梦回顾
  - 我入梦了谁？为什么入梦TA？
  - 今早TA的状态如何？

Step2: 死讯分析
  - 今早谁倒牌了？
  - 这与我的入梦有关吗？
  - 是否暴露了我的身份？

Step3: 狼人排查
  - 场上谁最可能是狼？
  - 是否需要启动连梦击杀计划？

Step4: 发言内容确定
  - 我应该隐藏身份还是跳身份？
  - 如果跳身份，如何报入梦名单？
  - 语气要冷静、理性

Step5: 投票倾向
  - 基于当前逻辑，应该投谁？
  - 是否需要保护真预言家？

【identity_table 填写指导（摄梦人白天：连梦候选与防御目标积累）】
- 高度嫌疑狼人（进攻模式备选）：confidence 填 70-90，reason 写"连梦候选：[发言矛盾/悍跳逻辑漏洞]，威胁等级：高"（下轮夜间 Step 0 将直接从此读取）
  【追加示例】上轮 reason="可疑" → 本轮追加为"可疑；连梦候选：白天N2发言悍跳逻辑升级，威胁等级：高"
- 防御保护核心好人：confidence 填 55-75，reason 写"防御入梦候选：[判断为真预/关键神职]，入梦优先，绝不连梦"
- 殉情备选目标（预感自己被刀时）：confidence 填 70-90，reason 写"殉情目标候选：[判断理由]，准备拉垫背"
- **追加不覆盖历史**：每轮在上轮 reason 基础上追加本轮新观察（用分号拼接），不覆盖历史积累
- 已入梦过的玩家：reason 追加"N[X]夜已入梦→[存活/死亡]"（不要覆盖历史记录）
输出JSON:{\"thought\":\"完整的5步思维链\",\"speech\":\"发言内容(${dreamweaverSpeechLen}字)\",\"confidence\":0-100,\"voteIntention\":数字或-1,\"identity_table\":{\"玩家号\":{\"suspect\":\"角色\",\"confidence\":0-100,\"reason\":\"依据\"}}}`;
};

/**
 * 摄梦人投票提示词
 */
export const getDreamweaverVotePrompt = (params) => {
  const { aliveTargets, voteContext } = params;

  return `摄梦人投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}

【投票策略】
1. 优先投确认的狼人
2. 保护你认为是真预言家的目标
3. 如果你已经跳身份，发挥领袖作用带领好人
4. 如果未跳身份，像平民一样投票

输出JSON:{\"targetId\":数字,\"reasoning\":\"投票理由\"}`;
};

export const DREAMWEAVER_PROMPTS = {
  persona: DREAMWEAVER_PERSONA,
  getThinkingDimensions: getDreamweaverThinkingDimensions,
  getPriorities: getDreamweaverPriorities,
  buildPersonaPrompt: buildDreamweaverPersonaPrompt,
  daySpeech: getDreamweaverDaySpeechPrompt,
  vote: getDreamweaverVotePrompt
};
