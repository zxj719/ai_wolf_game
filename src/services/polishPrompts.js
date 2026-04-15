/**
 * LLM 润色层 Prompt 模板
 *
 * 设计原则：
 *   - 极度精简（~150-200 token），只告诉 LLM "说什么" 而非 "想什么"
 *   - 不包含任何决策规则——决策已由行为树完成
 *   - 保留角色人格（话风/traits），保证发言自然
 *
 * 覆盖场景（按 strategy 字段路由）：
 *   quiet_villager      — 装平民
 *   shadow_teammate     — 跟队友立场
 *   aggressive_lead_vote — 激进推票
 *   fake_seer           — 悍跳预言家
 *   counter_seer        — 对抗跳
 */

// ────────────────────────────────────────────────
// 策略描述映射（中文，供 prompt 使用）
// ────────────────────────────────────────────────
const STRATEGY_DESCRIPTIONS = {
  quiet_villager:       '装作普通平民，分析局势，对可疑目标表达轻微怀疑',
  shadow_teammate:      '跟随一个玩家的分析，补充支持论据，显得立场坚定',
  aggressive_lead_vote: '主动引导全场投票，措辞强硬但有逻辑支撑',
  fake_seer:            '声称自己是预言家，公布昨晚查验结果（注意：这是伪装）',
  counter_seer:         '声称自己才是真预言家，质疑对方是假预言家',
};

/**
 * 构建润色层的系统提示词
 * @param {Object} player
 * @param {number} dayCount
 */
export function buildPolishSystemPrompt(player, dayCount) {
  const traits = player.personality?.traits ?? '普通';
  return `你是${player.name}，一名狼人玩家，正在伪装成普通玩家参与投票讨论。
你的话风：${traits}，发言自然流畅、符合当前局势氛围。
现在是第${dayCount}天白天讨论阶段。你只需要写出你的发言内容——不要解释你的策略，不要暴露你是狼人。`;
}

/**
 * 构建润色层的用户提示词
 * @param {Object} strategyDecision - BT 决策结果 { strategy, facts[], suspectTarget, voteTarget }
 * @param {Array} players           - 全部玩家列表（用于上下文）
 */
export function buildPolishUserPrompt(strategyDecision, players) {
  const { strategy, facts, voteTarget, suspectTarget } = strategyDecision;
  const desc = STRATEGY_DESCRIPTIONS[strategy] ?? '发言分析局势';

  const factsText = (facts ?? []).map((f, i) => `${i + 1}. ${f}`).join('\n');

  const voteText = voteTarget != null && voteTarget !== -1
    ? `你的投票意向是 ${voteTarget} 号。`
    : '你还没确定投票目标。';

  return `【你的发言策略】${desc}

【关键信息/论点】
${factsText || '（场上目前无明显线索）'}

【投票意向】${voteText}

请将上述内容表达为一段自然、口语化的白天发言（30-70字）。发言必须符合你伪装的身份，不要暴露任何"我在执行某策略"的痕迹。

返回严格的 JSON（不要添加 markdown 代码块）:
{"speech":"发言内容","voteIntention":${voteTarget ?? -1},"thought":"${STRATEGY_DESCRIPTIONS[strategy] ?? '分析'}","identity_table":{}}`;
}
