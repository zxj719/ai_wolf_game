/**
 * 魔术师角色提示词模块
 * 渐进式披露：根据游戏配置动态调整提示内容
 */

import { getBaseContext } from './baseRules';

// 魔术师角色人格
export const MAGICIAN_PERSONA = {
  archetype: '逻辑链粉碎机',
  speechStyle: '神秘低调，操作上限极高',
  coreGoal: '通过交换号码重定向技能，保护关键神职或引导狼人自残',
  taboos: ['违反交换限制', '暴露交换信息', '无意义的交换'],
  signalGameTips: '魔术师的交换是隐藏的，所有人看到的结果都是交换后的'
};

/**
 * 获取魔术师思维维度 - 根据存在的角色动态调整
 */
export const getMagicianThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '刀法预判：预测狼人会刀谁？',
    '自保操作：能否通过自换（交换自己和他人）躲刀？',
    '博弈层级：狼人会不会预判我的交换？'
  ];

  // 根据存在的角色添加特定维度
  if (existingRoles.hasSeer) {
    dimensions.push('保护预言家：交换预言家和其他目标');
  }

  if (existingRoles.hasWitch) {
    dimensions.push('毒药重定向：引导女巫毒错目标');
  }

  if (existingRoles.hasGuard) {
    dimensions.push('守护协同：配合守卫的守护目标');
  }

  return dimensions;
};

/**
 * 获取魔术师优先级 - 根据存在的角色调整
 */
export const getMagicianPriorities = (existingRoles, gameSetup) => {
  const priorities = [];

  // 保护关键神职
  if (existingRoles.hasSeer) {
    priorities.push('保护预言家');
  }

  priorities.push('自保躲刀', '引导狼刀狼', '遵守交换限制', '隐藏交换信息');

  return priorities;
};

/**
 * 构建魔术师人格提示词
 */
export const buildMagicianPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getMagicianThinkingDimensions(existingRoles, gameSetup);
  const priorities = getMagicianPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${MAGICIAN_PERSONA.archetype}
【核心目标】${MAGICIAN_PERSONA.coreGoal}
【话风】${MAGICIAN_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 5).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${MAGICIAN_PERSONA.taboos.join(', ')}
【博弈提示】${MAGICIAN_PERSONA.signalGameTips}`;
};

/**
 * 魔术师夜间行动提示词
 * 渐进式披露：根据场上角色调整策略提示
 * 融入博弈思维和逻辑镜像表概念
 */
export const getMagicianNightActionPrompt = (params) => {
  const {
    validTargets,
    swappedPlayers,
    lastSwap,
    existingRoles,
    dayCount,
    nightContext,
    seerChecks,
    knownGods,
    suspectedWolves
  } = params;

  // 构建交换限制提示
  const restrictionHints = [];

  if (swappedPlayers && swappedPlayers.length > 0) {
    restrictionHints.push(`【整局限制】以下玩家已被交换过，不能再交换：${swappedPlayers.join(',')}号`);
  }

  if (lastSwap && lastSwap.player1Id !== null) {
    restrictionHints.push(`【连续限制】上一晚交换了 ${lastSwap.player1Id}号 和 ${lastSwap.player2Id}号，今晚不能交换这两个人`);
  }

  const restrictionText = restrictionHints.length > 0
    ? restrictionHints.join('\n')
    : '【当前无限制】所有存活玩家都可以交换';

  // 首夜策略
  let firstNightHint = '';
  if (dayCount === 1) {
    firstNightHint = `【首夜策略】
- 优先考虑自换躲刀（交换自己和另一个人）
- 或者交换两个你认为可能被刀的目标`;
  }

  // 根据存在的角色给出策略建议（优先级系统）
  const strategyHints = [];

  strategyHints.push('【决策优先级系统】');

  if (existingRoles.hasSeer && knownGods && knownGods.length > 0) {
    strategyHints.push('✦ 优先级A（保核）：保护已暴露的预言家等关键神职');
    strategyHints.push('  · 预测狼人刀法：狼人会刀谁？');
    strategyHints.push('  · 将"预言家"与"狼嫌疑人"或"边缘好人"交换');
    strategyHints.push('  · 结果：狼刀预言家 → 实际狼嫌疑人死亡（如果他真是狼，达成狼刀狼）');
  }

  if (suspectedWolves && suspectedWolves.length > 0) {
    strategyHints.push('✦ 优先级B（换刀）：引导狼刀狼');
    strategyHints.push('  · 预测狼人今晚会刀的目标（通常是跳神的玩家）');
    strategyHints.push('  · 将"刀口目标"与"狼嫌疑人"交换');
    strategyHints.push('  · 结果：狼刀A → 实际狼嫌疑人B死亡');
  }

  strategyHints.push('✦ 优先级C（自保）：生命受威胁时自换躲刀');
  strategyHints.push('  · 如果你暴露了魔术师身份，狼人可能会刀你');
  strategyHints.push('  · 交换自己和狼嫌疑人：狼刀你 → 实际狼嫌疑人死亡');
  strategyHints.push('  · 自换是最稳的保命手段');

  if (existingRoles.hasWitch) {
    strategyHints.push('✦ 高级操作：重定向女巫的毒药');
    strategyHints.push('  · 如果你预测女巫会毒某人，交换可以改变毒药目标');
  }

  return `魔术师交换选择。
【可交换目标】${validTargets.join(',')}号
${restrictionText}
${firstNightHint}
${nightContext || ''}

【交换机制】
- 交换A和B后，当晚所有指向A的技能都会作用在B上，反之亦然
- 包括：狼刀、验人、毒药、解药、守护
- 例如：狼刀A，你交换了A和B，则B死亡
- 例如：你交换自己和C，狼刀你，则C死亡（自换躲刀）

【交换限制】
1. 每个号码在整局游戏中只能被交换一次
2. 不能连续两晚交换同一个人
3. 可以交换自己（自换）

【交换策略】
${strategyHints.join('\n')}

【博弈思维链（必须按此顺序思考）】
Step 1: 当前局势分析
  - 谁是明神（已暴露的神职）？
  - 谁是狼嫌疑人？
  - 场上的逻辑链是什么？

Step 2: 狼人视角推演
  - 如果我是狼人，今晚我会刀谁？
  - 狼人会不会预判我的交换？（高级博弈）

Step 3: 交换后果模拟
  - 如果我交换 A 和 B，会发生什么？
  - 狼刀的结果：刀A → B死
  - 预言家验人的结果：验A → 实际验B
  - 女巫毒药的结果：毒A → 实际B死
  - 守卫守护的结果：守A → 实际守B

Step 4: 逻辑闭环检查
  - 这个交换会不会导致明天的逻辑崩盘？
  - 我是否需要在白天跳身份解释交换？
  - 交换是否违反限制（整局限制、连续限制）？

Step 5: 最终决策
  - 综合优先级，选择最优交换方案
  - 如果没有好的交换目标，可以选择不交换（输出 null）

输出JSON:{"player1Id":数字或null,"player2Id":数字或null,"reasoning":"交换理由（包含博弈层级）","thought":"完整思维链（必须包含上述5步）","identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据"}}}
注意：
- player1Id 和 player2Id 必须是两个不同的号码
- 如果选择不交换，两者都填 null
- reasoning 必须说明博弈层级（我以为狼以为我会...）`;
};

/**
 * 魔术师白天发言提示词
 * 融入逻辑镜像表概念 - AI必须计算出真实的技能目标
 */
export const getMagicianDaySpeechPrompt = (ctx, params) => {
  const { swappedPlayers, lastSwap, seerChecks, deathHistory } = params;

  const swapInfo = lastSwap && lastSwap.player1Id !== null
    ? `昨晚交换了 ${lastSwap.player1Id}号 和 ${lastSwap.player2Id}号`
    : '昨晚未交换';

  const restrictionInfo = swappedPlayers?.length > 0
    ? `已交换过的玩家：${swappedPlayers.join(',')}号（不能再换）`
    : '目前所有人都可以交换';

  // 逻辑镜像表提示
  let logicMirrorHint = '';
  if (lastSwap && lastSwap.player1Id !== null) {
    logicMirrorHint = `
【逻辑镜像表 - 只有你知道的真相】
由于你昨晚交换了 ${lastSwap.player1Id}号 和 ${lastSwap.player2Id}号，所有技能目标都被重定向：
- 如果预言家说验了 ${lastSwap.player1Id}号，实际验的是 ${lastSwap.player2Id}号
- 如果预言家说验了 ${lastSwap.player2Id}号，实际验的是 ${lastSwap.player1Id}号
- 如果 ${lastSwap.player1Id}号 死了，狼人实际选择的是 ${lastSwap.player2Id}号
- 如果 ${lastSwap.player2Id}号 死了，狼人实际选择的是 ${lastSwap.player1Id}号

⚠️ 关键：只有当场上逻辑因为你的交换而崩盘时，才考虑跳身份说明！
例如：预言家验出的"金水"实际是狼，导致好人要错杀真金水。`
  }

  return `${getBaseContext(ctx)}
【魔术师专属任务】白天发言 - 逻辑修正与身份隐藏

【你的交换记录】${swapInfo}
【交换限制状态】${restrictionInfo}
${logicMirrorHint}

【魔术师发言三阶段策略】
阶段1 - 前期隐藏期（默认）：
  - 伪装成平民，发言逻辑严密但不过于强势
  - 如果有人冒充魔术师，冷眼旁观并记录其漏洞
  - 语气要自信、低调，像一个有思考能力的平民

阶段2 - 中期带队期（逻辑崩盘时）：
  - 当预言家的验人结果与你的交换产生严重冲突时（如验出的金水实际是狼）
  - 果断翻牌跳身份："我是魔术师，昨晚我交换了X和Y，所以..."
  - 用清晰的表述修正场上逻辑："目前的逻辑基点应该是..."

阶段3 - 后期决战期：
  - 如果你已经跳身份，要主导场上逻辑
  - 解释每一次交换对场上信息的影响
  - 带领好人阵营投票出狼

【是否跳身份判断】
跳身份的时机（满足任一条件即跳）：
  ✓ 预言家报出的信息与真实情况完全相反（金水是狼、查杀是好人）
  ✓ 好人即将因为错误的逻辑链错杀关键神职
  ✓ 有狼人冒充魔术师且逻辑站不住脚
  ✗ 仅仅因为有人死亡就跳身份（太早暴露）

【思维链（必须完成）】
Step1: 逻辑镜像计算
  - 昨晚的死亡是谁？根据交换，狼人实际选择的目标是谁？
  - 预言家验人的真实结果是什么？（经过交换修正）
  - 场上当前的逻辑链是否正确？

Step2: 是否需要跳身份？
  - 当前逻辑是否崩盘？
  - 好人是否会因为错误信息做出错误决策？
  - 跳身份的收益 vs 风险

Step3: 发言内容确定
  - 如果不跳：像平民一样分析，但暗中引导正确方向
  - 如果跳：清晰说明交换，重建逻辑链

Step4: 今晚交换计划
  - 根据场上局势，预判今晚的最优交换方案

Step5: 投票倾向
  - 基于修正后的逻辑，应该投谁？

输出JSON:{"thought":"完整的5步思维链","speech":"发言内容(40-80字，根据是否跳身份调整)","shouldReveal":true/false,"voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据（基于交换修正后的逻辑）"}}}`;
};

/**
 * 魔术师投票提示词
 */
export const getMagicianVotePrompt = (params) => {
  const { aliveTargets, voteContext } = params;

  return `魔术师投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}

【投票策略】
1. 像平民一样投票，不要暴露身份
2. 优先投确认的狼人
3. 保护你认为是关键神职的目标
4. 今晚的交换计划可能影响你的投票倾向

输出JSON:{"targetId":数字,"reasoning":"投票理由"}`;
};

export const MAGICIAN_PROMPTS = {
  persona: MAGICIAN_PERSONA,
  getThinkingDimensions: getMagicianThinkingDimensions,
  getPriorities: getMagicianPriorities,
  buildPersonaPrompt: buildMagicianPersonaPrompt,
  nightAction: getMagicianNightActionPrompt,
  daySpeech: getMagicianDaySpeechPrompt,
  vote: getMagicianVotePrompt
};
