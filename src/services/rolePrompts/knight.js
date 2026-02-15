/**
 * 骑士角色提示词模块
 * 正义裁决：白天决斗能力
 */

import { getBaseContext } from './baseRules';

// 骑士角色人格
export const KNIGHT_PERSONA = {
  archetype: '正义裁决者',
  speechStyle: '果断冷静，逻辑严密，威慑力强',
  coreGoal: '通过白天决斗识别并淘汰假跳预言家的狼人',
  taboos: ['盲目决斗', '决斗真神职', '暴露身份过早'],
  signalGameTips: '决斗是全场最强的物理验证，但只有一次机会'
};

/**
 * 获取骑士思维维度
 */
export const getKnightThinkingDimensions = (existingRoles, gameSetup) => {
  const dimensions = [
    '真假预言家识别',
    '发言漏洞捕捉',
    '逻辑链验证',
    '决斗时机把握'
  ];

  if (existingRoles.hasSeer) {
    dimensions.push('预言家跳身份真实性分析');
  }

  return dimensions;
};

/**
 * 获取骑士优先级
 */
export const getKnightPriorities = (existingRoles, gameSetup) => {
  return [
    '识别假跳预言家（优先级A）',
    '验证可疑金水玩家（优先级B）',
    '保护真预言家（优先级C）',
    '避免错杀真神职',
    '白天身份隐藏'
  ];
};

/**
 * 构建骑士人格提示词
 */
export const buildKnightPersonaPrompt = (player, existingRoles, gameSetup) => {
  const dimensions = getKnightThinkingDimensions(existingRoles, gameSetup);
  const priorities = getKnightPriorities(existingRoles, gameSetup);
  const personality = player.personality;

  return `
【角色原型】${KNIGHT_PERSONA.archetype}
【核心目标】${KNIGHT_PERSONA.coreGoal}
【话风】${KNIGHT_PERSONA.speechStyle} + ${personality?.traits || '普通'}
【思考维度】
  - ${dimensions.slice(0, 5).join('\n  - ')}
【优先级】${priorities.join(' > ')}
【禁忌】${KNIGHT_PERSONA.taboos.join(', ')}
【博弈提示】${KNIGHT_PERSONA.signalGameTips}`;
};

/**
 * 骑士白天发言提示词
 */
export const getKnightDaySpeechPrompt = (ctx, params) => {
  const { hasUsedDuel, seerChecks, deathHistory, speechHistory } = params;

  const duelStatus = hasUsedDuel
    ? '【已使用决斗】你已经使用过决斗技能，现在作为已知骑士身份指挥全场'
    : '【未使用决斗】你的决斗技能尚未使用，保持低调观察';

  return `${getBaseContext(ctx)}
【骑士专属任务】白天发言 - 正义裁决与逻辑验证

${duelStatus}

【骑士发言三阶段策略】
阶段1 - 隐藏期（未决斗前）：
  - 伪装成平民或普通村民，低调观察
  - 重点分析预言家的发言逻辑和验人行为
  - 捕捉狼人的发言漏洞、逻辑矛盾、站队摇摆
  - 语气要冷静、理性，像一个有思考能力的好人

阶段2 - 决斗期（准备决斗时）：
  - 当确认目标是狼人（把握度≥70%）时，果断翻牌
  - 发言要极其果断、简短有力
  - 例句："我听出 X 号在悍跳预言家，他的逻辑链在 Y 点完全崩溃。我是骑士，我申请与 X 号决斗！"
  - 决斗宣言要包含：明确的逻辑依据、你的身份、决斗目标

阶段3 - 领袖期（决斗成功后）：
  - 你的身份已公开，作为场上绝对的逻辑基点
  - 根据决斗结果重新排坑，指挥好人阵营推人顺序
  - 保护真预言家，带领好人找狼

【决斗决策系统（三级优先级）】
✦ 优先级A（捍卫真言）- 确定度 ≥ 70%：
  - 场上出现两名预言家对跳
  - 通过逻辑分析确定其中一人是狼
  - 判断依据：
    · 状态分析（是否防御性过强、攻击性过强）
    · 发言漏洞（前后矛盾、站队摇摆）
    · 验人逻辑（验人顺序是否合理）
  - 决斗假跳预言家，为真预言家正名

✦ 优先级B（破除金水）- 确定度 ≥ 60%：
  - 当一名可疑预言家给另一名玩家发了"金水"
  - 但该金水玩家发言极差、逻辑混乱
  - 决斗该金水玩家，一石二鸟验证两人身份
  - 如果金水是狼，则预言家也是狼

✦ 优先级C（搏命一击）- 紧急情况：
  - 真正的预言家即将被投票出局
  - 你无法通过发言扭转局势
  - 立即翻牌决斗最可疑的狼人，跳过投票阶段保护预言家
  - 这是最后的救场手段

【决斗禁忌】
✗ 严禁在局势不明朗、仅凭直觉的情况下决斗
✗ 严禁决斗你怀疑是神职的玩家（除非确定是假跳）
✗ 严禁在第一天就暴露身份（除非必要）
✗ 严禁决斗投票倾向与你一致的玩家

【思维链（必须完成）】
Step1: 场上局势分析
  - 是"双预言家对跳"还是"单边预言家"？
  - 哪些玩家声称是预言家？
  - 他们的验人逻辑是否合理？

Step2: 真假预言家判断
  - 1号预言家和5号预言家（如果有），谁更可信？
  - 可信度评估依据：
    · 验人逻辑与场上死讯是否吻合
    · 发言是否有明显漏洞
    · 是否过度防御或攻击
  - 信任值差额是否超过30%？

Step3: 决斗收益计算
  - 如果我现在决斗 X 号：
    · 若 X 是狼人：白天结束，我活，狼人少一只，真预言家多留一晚
    · 若 X 是好人：我死，白天继续，好人损失两张牌，局势崩盘
  - 当前把握度是多少？是否满足决斗条件（≥60%）？

Step4: 发言内容确定
  - 如果未决斗：像平民一样分析，暗中观察
  - 如果准备决斗：明确宣告身份和决斗理由
  - 如果已决斗：作为领袖指挥全场

Step5: 投票倾向（如果未决斗）
  - 基于当前逻辑，应该投谁？
  - 是否需要通过投票保护真预言家？

【特殊场景应对】
场景1 - 预言家被刀：
  - 如果真预言家首夜被刀，你是场上唯一知道真相的人
  - 观察谁会跳假预言家，准备决斗

场景2 - 骑士被悍跳：
  - 如果有狼人冒充骑士，不要急于跳身份
  - 让假骑士先决斗，暴露身份后你再收割

场景3 - 决斗失败后的逻辑：
  - 如果你决斗失败撞死在 3 号身上，那么 3 号就是铁好人
  - 你的死亡虽然是损失，但也提供了正逻辑

输出JSON:{\"thought\":\"完整的5步思维链\",\"speech\":\"发言内容(40-80字)\",\"shouldDuel\":true/false,\"duelTarget\":数字或null,\"duelReason\":\"决斗理由（如果shouldDuel=true）\",\"confidence\":0-100,\"voteIntention\":数字或-1,\"identity_table\":{\"玩家号\":{\"suspect\":\"角色\",\"confidence\":0-100,\"reason\":\"依据\"}}}`;
};

/**
 * 骑士决斗提示词
 */
export const getKnightDuelPrompt = (params) => {
  const { aliveTargets, duelContext } = params;

  return `骑士决斗决策（整局唯一一次机会）。
【可决斗目标】${aliveTargets.join(',')}号
${duelContext || ''}

【决斗机制】
- 如果对方是狼人 → 狼人直接出局，立即进入黑夜（跳过投票）
- 如果对方是好人 → 你羞愧自刎出局，当天讨论继续，依然可以投票

【决斗条件（必须满足）】
1. 确信度 ≥ 70%：你有足够证据相信对方是狼人
2. 逻辑链完整：能清晰说明对方是狼的理由
3. 收益大于风险：决斗成功的收益远大于失败的损失

【输出格式】
- 如果决定决斗：{\"duel\":true,\"targetId\":数字,\"reasoning\":\"决斗理由（必须包含完整逻辑链）\"}
- 如果不决斗：{\"duel\":false,\"targetId\":null,\"reasoning\":\"不决斗的原因\"}`;
};

/**
 * 骑士投票提示词
 */
export const getKnightVotePrompt = (params) => {
  const { aliveTargets, voteContext, hasUsedDuel } = params;

  const roleStatus = hasUsedDuel
    ? '你已使用决斗，身份已公开，作为领袖指挥投票'
    : '你尚未使用决斗，保持低调像平民一样投票';

  return `骑士投票决策。
【可投票目标】${aliveTargets.join(',')}号
${voteContext || ''}
【身份状态】${roleStatus}

【投票策略】
1. 如果身份未公开：像平民一样投票，不暴露骑士身份
2. 如果身份已公开：发挥领袖作用，带领好人投狼
3. 优先投确认的狼人
4. 保护你认为是真预言家的目标

输出JSON:{\"targetId\":数字,\"reasoning\":\"投票理由\"}`;
};

export const KNIGHT_PROMPTS = {
  persona: KNIGHT_PERSONA,
  getThinkingDimensions: getKnightThinkingDimensions,
  getPriorities: getKnightPriorities,
  buildPersonaPrompt: buildKnightPersonaPrompt,
  daySpeech: getKnightDaySpeechPrompt,
  duel: getKnightDuelPrompt,
  vote: getKnightVotePrompt
};
