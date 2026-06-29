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
  const { hasUsedDuel, aliveCount: aliveNow = 8 } = params;

  // R87：骑士 DAY_SPEECH 个性化发言风格（pre-duel 隐藏期 + post-duel 领袖期双阶段）
  const knightPersonalityType = params.personalityType || '';
  let knightPersonalityLens = '';
  if (knightPersonalityType === 'logical' || knightPersonalityType === 'analytical') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】数据驱动型：决斗验证了物理证据，以"决斗确认A是X类 → 推导Y是Z类"逻辑链带动好人推理；用"因为...所以..."句式构建可追溯的判断体系，让全场跟随你的逻辑落票。'
      : '\n【你的发言风格】推理积累型：用"命题→证据→置信度"框架在 thought 中量化每位玩家的决斗适配性；发言时以纯逻辑村民形象呈现，不透露决斗目标，让推理链本身成为身份掩护。';
  } else if (knightPersonalityType === 'aggressive') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】快速主导型：身份已公开，发言简短有力，直接宣告投票方向——"今天必须出局X号"；不做过多铺垫，用行动可信度压制异议，推动好人快速集票。'
      : '\n【你的发言风格】速攻伺机型：一旦把握度达到决斗下限即刻准备翻牌，不等待额外确认；发言简短有力，直指可疑目标，攻击性好人姿态为后续翻牌建立舆论基础。';
  } else if (knightPersonalityType === 'emotional') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】感染共情型：分享决斗时的心理过程（"当时我知道这是最后机会"），用真实感染好人紧跟判断；情感化叙事让决斗验证更具说服力，凝聚团队信任。'
      : '\n【你的发言风格】直觉信号型：以"我总觉得X号有什么不对"等直觉式表达补充逻辑分析，感性信号感染好人方向；在 thought 中同时维持理性决斗评估，发言情感化掩护骑士视角。';
  } else if (knightPersonalityType === 'contrarian') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】独立判断型：身份已明，不随大流落票；当好人追杀某目标时，补充漏网的次级威胁分析，防止节奏被操控——"除了X，别忘了Y的问题还没解决"。'
      : '\n【你的发言风格】反预判型：当多数指向X时主动质疑"为什么不考虑Y悍跳"，保留独立分析价值；差异化立场减少你被固定针对的风险，同时在 thought 中按三级优先级框架评估真实决斗目标。';
  } else if (knightPersonalityType === 'cunning') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】战略释放型：以领袖身份战略性分配调查方向，保留部分判断制造心理压力——"我已经有目标了，但我需要再确认一件事"；用不确定性威慑狼方，在最高价值时刻落票。'
      : '\n【你的发言风格】伏击谋略型：在发言中埋设"中性引导"让可疑目标自我暴露——多提问少表态，在最高价值时刻翻牌；发言目的是触发对方暴露，而非直接展示决斗意图。';
  } else if (knightPersonalityType === 'cautious') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】严谨指挥型：详细说明决斗逻辑链，让好人完全理解决斗价值后再带票；宁可多解释也要确保全场共识，谨慎选择后续投票目标。'
      : '\n【你的发言风格】充分准备型：严格按三级优先级框架，只在达到优先级A阈值时才考虑翻牌；发言多倾听少指名，积累证据链直到置信度真正成熟，不做草率决斗。';
  } else if (knightPersonalityType === 'steady') {
    knightPersonalityLens = hasUsedDuel
      ? '\n【你的领袖风格】协调渐进型：以稳健协调者而非独裁者形象带领好人——先肯定合理发言再提出方向补充，平衡各角色的配合，带动全场有序落票，防止好人阵营内部分裂。'
      : '\n【你的发言风格】稳健蓄势型：先肯定场上共识再提出对可疑目标的判断，保持高可信度为后续翻牌铺垫；节奏稳，不轻易暴露目标，但有明确信号时果断出手。';
  }
  let knightSpeechLen = '40-80字';
  if (knightPersonalityType === 'aggressive') knightSpeechLen = hasUsedDuel ? '30-55字' : '35-55字';
  else if (knightPersonalityType === 'cautious') knightSpeechLen = '55-90字';

  // R51: endgame dynamic thresholds — aliveNow passed from aiPrompts.js with intent "骑士终局决斗阈值用"
  const isEndgame = aliveNow <= 5;
  const thresholdA = isEndgame ? 50 : 70;
  const thresholdB = isEndgame ? 40 : 60;
  const endgameNote = isEndgame
    ? `\n\n【⚡ 残局模式（存活${aliveNow}人）】决斗窗口收窄——优先级A阈值下调至≥${thresholdA}%，优先级B阈值下调至≥${thresholdB}%。残局每轮信息减少，宁早决断不延误。`
    : '';

  // R44 DAY→DAY 读写闭环：历史决斗候选读取步骤（R86 升级：三路径评估 + 续战搜索框架）
  const knightHistoryStep = ctx.dayCount > 1
    ? `0. 【读取历史决斗候选与续战策略（thought 中完成）】
   ① 查 identity_table 中含"决斗候选"字样的玩家，确认其当前状态，分三路径处理：
      路径A（候选存活）：结合今天新信息（发言漏洞/死亡验证/验人结果）更新候选优先级，正常进入决斗评估流程
      路径B（候选已被投票出局）：好人阵营已消灭该目标，决斗资源节省；identity_table 追加"→已投票出局（好人方向一致）" → 触发续战搜索
      路径C（候选已被狼夜杀）：目标已确认为好人，原决斗线索丢失；identity_table 追加"→已被狼击杀（铁好人确认）" → 触发续战搜索
   ② 续战搜索（路径B/C 触发）：按优先级 A > B > C 在存活玩家中重新扫描：
      决斗优先级A（阈值≥${thresholdA}%）：场上是否有新的预言家对跳局面？
      决斗优先级B（阈值≥${thresholdB}%）：是否有可疑假金水玩家需要破除？
      决斗优先级C（紧急救场）：是否有即将被错误投出的真神职需要搏命救场？
      将首个满足阈值的候选 reason 追加"→重启决斗候选：[优先级A/B/C]，[新依据]"
   ③ 历史候选是决策起点，不是硬约束——若新信息推翻旧候选，更新并在 thought 中说明原因`
    : '0. 【第一天】无历史决斗候选记录——直接根据当前局势推断决斗候选目标';

  const duelStatus = hasUsedDuel
    ? '【已使用决斗】你已经使用过决斗技能，现在作为已知骑士身份指挥全场'
    : '【未使用决斗】你的决斗技能尚未使用，保持低调观察';

  return `${getBaseContext(ctx)}
【骑士专属任务】白天发言 - 正义裁决与逻辑验证

${duelStatus}${endgameNote}

【骑士发言三阶段策略】
阶段1 - 隐藏期（未决斗前）：
  - 伪装成平民或普通村民，低调观察
  - 重点分析预言家的发言逻辑和验人行为
  - 捕捉狼人的发言漏洞、逻辑矛盾、站队摇摆
  - 语气要冷静、理性，像一个有思考能力的好人

阶段2 - 决斗期（准备决斗时）：
  - 当确认目标是狼人（把握度≥${thresholdA}%）时，果断翻牌
  - 发言要极其果断、简短有力
  - 例句："我听出 X 号在悍跳预言家，他的逻辑链在 Y 点完全崩溃。我是骑士，我申请与 X 号决斗！"
  - 决斗宣言要包含：明确的逻辑依据、你的身份、决斗目标

阶段3 - 领袖期（决斗成功后）：
  - 你的身份已公开，作为场上绝对的逻辑基点
  - 根据决斗结果重新排坑，指挥好人阵营推人顺序
  - 保护真预言家，带领好人找狼

【决斗决策系统（三级优先级）】
✦ 优先级A（捍卫真言）- 确定度 ≥ ${thresholdA}%：
  - 场上出现两名预言家对跳
  - 通过逻辑分析确定其中一人是狼
  - 判断依据：
    · 状态分析（是否防御性过强、攻击性过强）
    · 发言漏洞（前后矛盾、站队摇摆）
    · 验人逻辑（验人顺序是否合理）
  - 决斗假跳预言家，为真预言家正名

✦ 优先级B（破除金水）- 确定度 ≥ ${thresholdB}%：
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
${knightPersonalityLens}
【思维链（必须完成）】
${knightHistoryStep}
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
  - 当前把握度是多少？是否满足决斗条件（≥${thresholdB}%）？

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

【identity_table 填写指导（骑士白天：决斗候选积累 DAY→DAY 闭环）】
- 高嫌疑决斗目标：reason 写"决斗候选：[优先级A/B/C]，[逻辑依据摘要]"（下天 Step 0 将直接从此读取）
  【追加示例】上轮 reason="发言可疑" → 本轮追加为"发言可疑；决斗候选：优先级A，预言家对跳逻辑链崩溃"
- 确认好人/真神职：reason 写"铁好人：[依据]；禁止决斗"（防止误伤）
- 行为中立玩家：正常记录推断，不加"决斗候选"标签
- 已决斗出局目标：reason 追加"→已决斗出局"
- 候选已出局更新：追加"→已投票出局（好人方向一致）"（路径B）或"→已被狼击杀（铁好人确认）"（路径C）；新候选找到后追加"→重启决斗候选：[优先级A/B/C]，[新依据]"
- **追加不覆盖历史**：每轮在上轮 reason 基础上追加本轮新观察（用分号拼接），不覆盖历史积累

输出JSON:{\"thought\":\"完整的6步思维链（含Step0读历史）\",\"speech\":\"发言内容(${knightSpeechLen})\",\"shouldDuel\":true/false,\"duelTarget\":数字或null,\"duelReason\":\"决斗理由（如果shouldDuel=true）\",\"confidence\":0-100,\"voteIntention\":数字或-1,\"identity_table\":{\"玩家号\":{\"suspect\":\"角色\",\"confidence\":0-100,\"reason\":\"依据\"}}}`;
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
