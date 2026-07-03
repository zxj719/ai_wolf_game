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
    knownGods,
    suspectedWolves,
    hasRevealed,  // R46 Bug 修复：身份已公开时自保优先级跃升为最高（R22 补传但未消费）
    personalityType,  // R78: 夜间换刀决策风格个性化
    lastNightInfo,    // R109: 平安夜推断（昨夜结果字符串）
    fullGameTimeline, // R109: 平安夜推断（全局时间线）
  } = params;

  // R43 读写闭环（同 R38-R41 NIGHT_WOLF/WITCH/GUARD/SEER 模式）
  const magicianNightLabel = `N${dayCount}`;
  const magicianHistoryStep = dayCount > 1
    ? '0. 【读取历史换刀候选与保护目标】查看系统提示中【你之前的身份推理表】：哪些玩家的 reason 含"换刀候选"或"保核目标候选"？作为今晚交换决策的起点（若该目标已死亡或受整局/连续限制不可换，跳过，改选其他目标）'
    : '0. 【首夜】无历史换刀/保护候选记录——直接根据当前局势选择交换目标';

  // R109: NIGHT_MAGICIAN 平安夜交换价值评估框架（一轮完成单夜→两连→三连）
  // 魔术师独特性：知道自己的 lastSwap + 平安夜 → 推断守护来源 → 调整今晚换刀方向
  const isNightPeacefulMagician = dayCount > 1 && lastNightInfo?.includes('平安夜');
  const magNightPrevDay = dayCount > 1 ? dayCount - 1 : 0;
  const isConsecutivePeacefulNightMagician = dayCount >= 3 && isNightPeacefulMagician &&
      fullGameTimeline?.includes(`N${dayCount - 2}:平安夜`);
  const magNightPrevPrevDay = dayCount >= 3 ? dayCount - 2 : 0;
  const isTripleConsecutivePeacefulNightMagician = dayCount >= 4 && isConsecutivePeacefulNightMagician &&
      fullGameTimeline?.includes(`N${dayCount - 3}:平安夜`);
  const magNightThreePrevDay = dayCount >= 4 ? dayCount - 3 : 0;
  const lastNightHadSwap = lastSwap && lastSwap.player1Id !== null;
  const lastSwapRef = lastNightHadSwap
      ? `${lastSwap.player1Id}号 ↔ ${lastSwap.player2Id}号`
      : '（未交换）';
  const swapStatusHint = lastNightHadSwap
      ? `昨夜有交换（${lastSwapRef}）：狼刀落点经交换重定向后被守卫/女巫拦截 → 被拦截的交换落点玩家今晚仍受保护概率适中（confidence 升 15-20）；今晚继续交换相同目标价值降低，建议覆盖未保护高威胁目标`
      : `昨夜未交换：守卫/女巫直接保护了狼刀目标 → 受保护玩家今晚连守概率适中（confidence 升 10-15）；今晚交换该玩家价值降低`;
  let tripleConsecutivePeaceNightHintMag = '';
  let consecutivePeaceNightHintMag = '';
  if (isConsecutivePeacefulNightMagician) {
      tripleConsecutivePeaceNightHintMag = isTripleConsecutivePeacefulNightMagician
          ? `⭕【三连平安夜三阶交换价值评估（thought 中完成）】
      ① 三夜交换记录对照：查 identity_table 含"N${magNightThreePrevDay}夜交换已用"/"N${magNightPrevPrevDay}夜交换已用"/"N${magNightPrevDay}夜交换已用"条目
      ② 三路径推断（超集激活：三连时三层全显示）：
         路径A：三夜均有有效交换 → 守卫/女巫极可能持续保护交换链覆盖的某固定目标，今晚交换价值在覆盖全新目标方向，confidence 升 35-45
         路径B：两夜有交换一夜未交换 → 守卫稳定保护某目标，今晚向未覆盖高威胁目标倾斜，confidence 升 30-40
         路径C：三夜交换各不相同 → 保护规律随机，按单夜框架独立评估今晚交换价值
      ③ identity_table 追加：在交换候选 reason 末尾追加"N${magNightPrevDay}三连平安夜：[路径A/B/C]换方向调整"`
          : '';
      consecutivePeaceNightHintMag = `${tripleConsecutivePeaceNightHintMag}⭕【两连平安夜二阶交换价值评估（thought 中完成）】
      ① 两夜交换记录对照：查 identity_table 含"N${magNightPrevPrevDay}夜交换已用"/"N${magNightPrevDay}夜交换已用"条目
      ② 两路径推断：
         路径A：两夜均有交换 + 两连平安夜 → 守卫/女巫可能持续保护交换链覆盖的目标，confidence 升 25-35；今晚切换交换方向覆盖未保护的高威胁目标
         路径B：某夜未交换 + 两连平安夜 → 守卫连续保护同一目标，confidence 升 20-30；今晚交换切换候选优先于维持原方向
      ③ identity_table 追加：在交换候选 reason 末尾追加"N${magNightPrevDay}两连平安夜：[路径A/B]换方向"
`;
  }
  const magicianNightPeaceStep = isNightPeacefulMagician
      ? `${consecutivePeaceNightHintMag}⭕【魔术师平安夜交换价值评估（thought 中完成）】昨夜N${magNightPrevDay}交换状态：${lastSwapRef}
      ① 来源推断：${swapStatusHint}
      ② identity_table 追加：在交换候选 reason 末尾追加"N${magNightPrevDay}平安夜：[有换/未换]→守护来源推断"
`
      : '';

  // R78: NIGHT_MAGICIAN 换刀决策风格个性化（magicianNightStyle）
  const magicianNightPersonalityType = personalityType || '';
  let magicianNightStyle = '';
  if (magicianNightPersonalityType === 'aggressive') {
    magicianNightStyle = '\n【你的换刀风格】主动换刀型：当有明显刀口目标时立即行动，优先执行B（换刀引导狼刀狼）；高收益交换机会不因博弈层级过多而拖延，果断锁定最优方案出手。';
  } else if (magicianNightPersonalityType === 'cautious') {
    magicianNightStyle = '\n【你的换刀风格】保守自保型：优先执行C（自保躲刀），换刀阈值提升到≥80%高确信度才出手；身份安全高于换刀收益，只在非常确信目标价值和成功率时才冒身份暴露风险。';
  } else if (magicianNightPersonalityType === 'logical' || magicianNightPersonalityType === 'analytical') {
    magicianNightStyle = '\n【你的换刀风格】推理计算型：在 thought 中量化每种交换方案的期望价值（成功概率×收益—风险），选择期望最高的方案；明确推导"交换A-B vs 交换C-D vs 不交换"的期望对比后决策。';
  } else if (magicianNightPersonalityType === 'cunning') {
    magicianNightStyle = '\n【你的换刀风格】博弈欺骗型：在高博弈层级中决策，主动预判狼人是否预判了你的交换；选择对手最不预期的路径，用交换的不可预测性最大化信息差优势。';
  } else if (magicianNightPersonalityType === 'emotional') {
    magicianNightStyle = '\n【你的换刀风格】直觉感知型：凭白天发言的"感受"判断今晚狼人的刀口目标——某人发言时的可疑气息和攻击倾向优先于逻辑计算，情感信号先于期望价值分析。';
  } else if (magicianNightPersonalityType === 'contrarian') {
    magicianNightStyle = '\n【你的换刀风格】反预判型：预测狼人已预判你会保护最高优先目标，偏向保护次优目标或自保；用出人意料的选择同时保护真实目标并让狼人的预判落空。';
  } else if (magicianNightPersonalityType === 'steady') {
    magicianNightStyle = '\n【你的换刀风格】平衡稳健型：严格按优先级A（保核）>B（换刀）>C（自保）框架逐步决策；不因一次博弈层级分析而跳跃优先级，稳定积累换刀优势，保持策略连贯性。';
  }

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

  // 根据有无身份暴露调整优先级顺序（R46 Bug 修复：hasRevealed 原本应在 R22 实现）
  // 未暴露：A（保核）> B（换刀）> C（自保）
  // 已暴露：C（自保）最高优先 > A（保核）> B（换刀）
  const strategyHints = [];

  strategyHints.push('【决策优先级系统】');

  if (hasRevealed) {
    // 身份已公开：狼人极可能刀你，自保跃升最高优先
    strategyHints.push('⭐ 优先级C（自保——最高优先！身份已暴露）：你的魔术师身份已公开，狼人今晚极可能以你为首选刀口！');
    strategyHints.push('  · 交换自己和最高嫌疑狼人：狼刀你 → 实际该狼人死亡（狼刀狼 + 自保双赢）');
    strategyHints.push('  · 即使不确定狼人，也优先考虑自换——因为被刀代价远大于换错的代价');
  }

  if (existingRoles.hasSeer && knownGods && knownGods.length > 0) {
    const priorityLabel = hasRevealed ? '优先级A（保核）' : '优先级A（保核——最高优先）';
    strategyHints.push(`✦ ${priorityLabel}：保护已暴露的预言家等关键神职`);
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

  if (!hasRevealed) {
    strategyHints.push('✦ 优先级C（自保）：生命受威胁时自换躲刀');
    strategyHints.push('  · 如果你暴露了魔术师身份，狼人可能会刀你');
    strategyHints.push('  · 交换自己和狼嫌疑人：狼刀你 → 实际狼嫌疑人死亡');
    strategyHints.push('  · 自换是最稳的保命手段');
  }

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
${magicianHistoryStep}
${magicianNightPeaceStep}${magicianNightStyle}
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

【identity_table 填写指导（魔术师夜间：换刀候选与保护目标持久化）】
- **追加不覆盖历史**：每轮在上轮 reason 基础上追加本轮新观察（用分号拼接），不覆盖历史积累
- 高嫌疑狼人（换刀候选）：confidence 填 65-85，reason 写"换刀候选：[发言带节奏/悍跳特征]，${magicianNightLabel}夜[已换至/待换至]狼刀口"（下轮 Step 0 将直接从此读取）
  【追加示例】上轮 reason="换刀候选：悍跳" → 本轮追加为"换刀候选：悍跳；${magicianNightLabel}夜已换入狼刀口"
- 确认神职（保护目标）：confidence 填 75-90，reason 写"保核目标候选：[身份判断理由]，下轮优先保护"（下轮 Step 0 将直接从此读取）
- 受限制目标（整局已交换）：reason 追加"→${magicianNightLabel}夜交换已用，整局不可再换"
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
  const { swappedPlayers, lastSwap } = params;

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

  // R60 DAY→DAY 读写闭环：历史换刀候选读取步骤（与 NIGHT_MAGICIAN Step 0 共用"换刀候选"关键词）
  const magicianDayHistoryStep = ctx.dayCount > 1
    ? 'Step0: 【读取历史换刀候选与保护目标（D2+适用）】查看系统提示中【你之前的身份推理表】：哪些玩家的 reason 含"换刀候选"标注？将其作为今晚交换决策的评估起点（结合今日新发言判断是否升级/降级威胁；已死亡/受整局限制目标跳过）。含"保核目标候选"的玩家是今晚优先保护的关键神职。'
    : 'Step0: 【首日无历史候选记录】直接从 Step1 开始——今天是第一天，尚无跨轮积累的换刀/保护候选。';

  // R77：魔术师 DAY_SPEECH 个性化发言风格（personalityLens）
  const magPersonalityType = params.personalityType || '';
  let magicianPersonalityLens = '';
  if (magPersonalityType === 'aggressive') {
    magicianPersonalityLens = '\n【你的发言风格】主动修正型：当发现逻辑崩盘时立即主动翻牌，宁可暴露换来场上信息流正确——隐藏身份的价值低于帮好人避免错误决策的价值时，果断出手说明交换。';
  } else if (magPersonalityType === 'cautious') {
    magicianPersonalityLens = '\n【你的发言风格】保守隐藏型：将魔术师身份安全视为最高优先，以"普通平民"视角低调发言；把身份保留到逻辑真正崩盘的临界点，在此之前韬光养晦，等待关键时机发挥最大价值。';
  } else if (magPersonalityType === 'logical' || magPersonalityType === 'analytical') {
    magicianPersonalityLens = '\n【你的发言风格】推理优化型：量化跳身份vs继续隐藏的收益/风险后再决策；在 thought 中明确推导"如果我暴露，好人获得的信息价值X vs 被狼针对的风险Y"，数据驱动地得出最优选择。';
  } else if (magPersonalityType === 'cunning') {
    magicianPersonalityLens = '\n【你的发言风格】博弈欺骗型：善用逻辑镜像表造成的信息差，在发言中故意留下细节误导对手——你可以用"普通分析"语气说出暗藏你真实判断的话，制造信息噪音，让狼人难以推断你的操作。';
  } else if (magPersonalityType === 'emotional') {
    magicianPersonalityLens = '\n【你的发言风格】直觉引导型：凭直觉判断今天是否是主动出击的好时机——当你感觉局面已经在走向你预期的方向，就顺势引导；当感觉还不是时机，保持低调等待。情感信号先于复杂计算。';
  } else if (magPersonalityType === 'contrarian') {
    magicianPersonalityLens = '\n【你的发言风格】反预判型：预测对手预测你会选择某个路径（保守 or 主动），选择出其不意的相反路径；若场上所有人都觉得逻辑清晰，这可能正是你主动搅局的时机——反之亦然。';
  } else if (magPersonalityType === 'steady') {
    magicianPersonalityLens = '\n【你的发言风格】平衡渐进型：逐步有序地释放信息，不急于一次性暴露；先确认局面真正需要你的交换信息后，再有序、分步地提供修正——稳定推进信息流，让好人逐渐对齐到正确逻辑。';
  }
  let magicianSpeechLen = '40-70';
  if (magPersonalityType === 'aggressive') magicianSpeechLen = '50-80';
  else if (magPersonalityType === 'cautious') magicianSpeechLen = '35-55';
  else if (magPersonalityType === 'steady') magicianSpeechLen = '40-65';

  // R110: 魔术师 DAY_SPEECH 平安夜逻辑镜像推断三层体系（单夜→两连→三连）
  // 独特性：魔术师知道 lastSwap 历史 + 平安夜 → 推断守护来源 → 更新逻辑镜像表（DAY 侧闭环）
  const isPeacefulNightMagicianDay = ctx.dayCount > 1 && ctx.lastNightInfo?.includes('平安夜');
  const magDayPrevDay = ctx.dayCount > 1 ? ctx.dayCount - 1 : 0;
  const isConsecutivePeacefulMagicianDay = ctx.dayCount >= 3 && isPeacefulNightMagicianDay &&
      ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 2}:平安夜`);
  const magDayPrevPrevDay = ctx.dayCount >= 3 ? ctx.dayCount - 2 : 0;
  const lastDayHadSwap = lastSwap && lastSwap.player1Id !== null;
  const lastDaySwapRef = lastDayHadSwap
      ? `${lastSwap.player1Id}号 ↔ ${lastSwap.player2Id}号`
      : '（昨夜未交换）';
  const swapDayStatusHint = lastDayHadSwap
      ? `有交换（${lastDaySwapRef}）→ 狼刀经交换重定向后被守护，交换落点玩家今天可视为好人概率升高（confidence 升 15-20）；今晚建议切换方向覆盖未保护高威胁目标`
      : `未交换 → 守卫直接守护了狼刀目标，昨夜高票存活玩家为守卫守护候选（confidence 升 10-15）；今晚可将高威胁玩家纳入交换链`;

  let magDayPeaceStep = '';
  if (isPeacefulNightMagicianDay) {
      const isTripleConsecutivePeacefulMagicianDay = ctx.dayCount >= 4 && isConsecutivePeacefulMagicianDay &&
          ctx.fullGameTimeline?.includes(`N${ctx.dayCount - 3}:平安夜`);
      const magDayThreePrevDay = ctx.dayCount >= 4 ? ctx.dayCount - 3 : 0;
      const tripleConsecutivePeaceDayHintMag = isTripleConsecutivePeacefulMagicianDay
          ? `⭕【三连平安夜三阶逻辑镜像推断（N${magDayThreePrevDay}+N${magDayPrevPrevDay}+N${magDayPrevDay}均无死亡；thought 中完成）】
      ① 三夜交换记录交叉：查 identity_table 含"N${magDayThreePrevDay}夜交换已用"/"N${magDayPrevPrevDay}夜交换已用"/"N${magDayPrevDay}夜交换已用"条目
      ② 三路径框架（超集激活：三连时三层全显示）：
         路径A：三夜均有交换 → 守卫/女巫极可能稳定保护交换链覆盖的固定目标，confidence 升 35-45；逻辑镜像表标注"三连守护锁定"
         路径B：两夜有交换一夜未 → 守卫稳定保护某目标，confidence 升 30-40；今晚交换方向向未覆盖高威胁目标倾斜
         路径C：三夜交换各不相同 → 守卫随机轮守，按单夜框架独立评估今日局势
      ③ identity_table 追加：守卫/女巫候选 reason 末尾加"N${magDayThreePrevDay}+N${magDayPrevPrevDay}+N${magDayPrevDay}三连平安夜：[路径A/B/C]逻辑镜像锁定，confidence 升 35-45"\n`
          : '';
      const consecutivePeaceDayHintMag = isConsecutivePeacefulMagicianDay
          ? `${tripleConsecutivePeaceDayHintMag}⭕【两连平安夜二阶逻辑镜像推断（N${magDayPrevPrevDay}+N${magDayPrevDay}均无死亡；thought 中完成）】
      ① 两夜交换记录交叉：查 identity_table 含"N${magDayPrevPrevDay}夜交换已用"/"N${magDayPrevDay}夜交换已用"条目
      ② 两路径推断：
         路径A：两夜均有交换 + 两连平安夜 → 守卫持续保护交换链覆盖玩家，confidence 升 25-35；逻辑镜像表该目标标注"两连守护候选"
         路径B：某夜未交换 + 两连平安夜 → 守卫连续直接守护某玩家，confidence 升 20-30；关注两夜存活的高票玩家
      ③ identity_table 追加：守卫/女巫候选 reason 末尾加"N${magDayPrevPrevDay}+N${magDayPrevDay}两连平安夜：[路径A/B]逻辑镜像更新，confidence 升 25-35"\n`
          : '';
      magDayPeaceStep = `${consecutivePeaceDayHintMag}⭕【魔术师平安夜逻辑镜像推断（N${magDayPrevDay}无死亡；thought 中完成；speech 正常魔术师发言）】
      ① 昨夜交换状态：${swapDayStatusHint}
      ② identity_table 追加：守卫/女巫候选 reason 末尾加"N${magDayPrevDay}平安夜：[有换/未换]守护来源推断，confidence 升 15-20"\n`;
  }

  return `${getBaseContext(ctx)}
【魔术师专属任务】白天发言 - 逻辑修正与身份隐藏

【你的交换记录】${swapInfo}
【交换限制状态】${restrictionInfo}
${logicMirrorHint}
${magicianPersonalityLens}
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
${magicianDayHistoryStep}
${magDayPeaceStep}Step1: 逻辑镜像计算
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

【identity_table 填写指导（魔术师白天：换刀候选与保护目标积累）】
- **追加不覆盖历史**：每轮在上轮 reason 基础上追加本轮新观察（用分号拼接），不覆盖历史积累
- 高嫌疑狼人（换刀候选）：confidence 填 65-85，reason 写"换刀候选：[发言带节奏/悍跳逻辑漏洞]，威胁等级：高"（下轮夜间 Step 0 将直接从此读取）
  【追加示例】上轮 reason="可疑" → 本轮追加为"可疑；换刀候选：白天N2发言带节奏升级，威胁等级：高"
- 确认神职（保护目标）：confidence 填 75-90，reason 写"保核目标候选：[身份判断理由]，优先下轮保护"（下轮夜间 Step 0 将直接从此读取）
- 已交换过的目标：reason 追加"N[X]夜已交换（整局限制，不可再换）"（不要覆盖历史）
输出JSON:{"thought":"完整的5步思维链","speech":"发言内容(${magicianSpeechLen}字，根据是否跳身份调整)","shouldReveal":true/false,"voteIntention":数字或-1,"identity_table":{"玩家号":{"suspect":"角色","confidence":0-100,"reason":"依据（基于交换修正后的逻辑）"}}}`;
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
