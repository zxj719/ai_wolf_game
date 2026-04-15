/**
 * 狼人原子动作节点
 *
 * 投票动作 → setDecision(targetId, reasoning)
 * 发言策略 → setDecision({ strategy, suspectTarget, voteTarget, facts }, reasoning)
 */

import { action } from '../core/nodes.js';

// ────────────────────────────────────────────────
// 投票动作（绝不投队友）
// ────────────────────────────────────────────────

const safeTargets = (bb) => {
  const { wolfTeammates, validTargets } = bb.state;
  return validTargets.filter(id => !wolfTeammates.includes(id));
};

/** 投唯一跳预言家（消灭信息源） */
export const voteRealSeer = action('投跳预言家', bb => {
  const { seerClaims } = bb.state;
  const safe = safeTargets(bb);
  if (seerClaims.length !== 1) return false;
  const seerId = seerClaims[0].playerId;
  if (!safe.includes(seerId)) return false;
  bb.setDecision(seerId, `投唯一预言家${seerId}号，消灭信息源`);
  return true;
});

/** 投公开金水玩家（消灭验证好人） */
export const voteGoldWater = action('投金水好人', bb => {
  const { seerClaims } = bb.state;
  const safe = safeTargets(bb);
  const candidates = [];
  seerClaims.forEach(c => c.goldWaters.forEach(id => {
    if (safe.includes(id)) candidates.push(id);
  }));
  if (candidates.length === 0) return false;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  bb.setDecision(target, `投金水好人${target}号，消灭已验证目标`);
  return true;
});

/** 顺势跟高嫌疑目标（和平民决策一致，掩护身份） */
export const voteHighSuspicionForCover = action('跟高嫌疑掩护', bb => {
  const { suspicion } = bb.state;
  const safe = safeTargets(bb);
  const ranked = safe
    .map(id => ({ id, score: suspicion.get(id) ?? 0 }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) return false;
  const target = ranked[0].id;
  bb.setDecision(target, `跟随场上归票趋势投${target}号，掩护身份`);
  return true;
});

/** 随机投非队友（兜底） */
export const voteRandomNonWolf = action('随机投非队友', bb => {
  const safe = safeTargets(bb);
  if (safe.length === 0) return false;
  const target = safe[Math.floor(Math.random() * safe.length)];
  bb.setDecision(target, `无明显归票对象，随机选择${target}号`);
  return true;
});

// ────────────────────────────────────────────────
// 发言策略动作
// ────────────────────────────────────────────────

/**
 * 选一个"可踩"的非队友、非金水目标
 * 优先选高嫌疑目标（看起来合理），有 20% 随机性
 */
function pickSuspectTarget(bb) {
  const { suspicion, validTargets, wolfTeammates, seerClaims } = bb.state;
  const goldWaters = seerClaims.flatMap(c => c.goldWaters);
  const candidates = validTargets.filter(id =>
    !wolfTeammates.includes(id) && !goldWaters.includes(id)
  );
  if (candidates.length === 0) return validTargets.filter(id => !wolfTeammates.includes(id))[0] ?? null;
  const ranked = candidates
    .map(id => ({ id, score: suspicion.get(id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
  // 20% 随机选次优
  return ranked.length > 1 && Math.random() < 0.2 ? ranked[1].id : ranked[0].id;
}

/** 策略：深水 —— 装作普通平民，对可疑目标表达轻微怀疑 */
export const strategyQuietVillager = action('深水策略', bb => {
  const suspect = pickSuspectTarget(bb);
  const facts = [
    '我昨晚平安无事，认真听了大家发言',
    suspect != null ? `我觉得${suspect}号的表现有些奇怪，值得关注` : '目前局面不明朗，先观望'
  ];
  bb.setDecision({
    strategy: 'quiet_villager',
    suspectTarget: suspect,
    voteTarget: suspect,
    facts,
  }, '深水潜伏，装作平民分析');
  return true;
});

/** 策略：影跟队友 —— 跟随已发言队友的立场 */
export const strategyShadeTeammate = action('影随队友策略', bb => {
  const { spokenWolfTeammates, speechHistory, dayCount } = bb.state;
  if (spokenWolfTeammates.length === 0) return false;
  const ally = spokenWolfTeammates[0];
  const allySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === ally);
  const allyVote = allySpeech?.voteIntention;
  const facts = [
    `${ally}号的分析很到位，我站边他`,
    allyVote != null && allyVote !== -1
      ? `我也认为${allyVote}号值得重点关注`
      : '我支持场上大家比较认可的判断'
  ];
  bb.setDecision({
    strategy: 'shadow_teammate',
    suspectTarget: allyVote ?? null,
    voteTarget: allyVote ?? null,
    facts,
  }, `跟随队友${ally}号立场`);
  return true;
});

/** 策略：激进推票 —— 主动带节奏淘汰关键目标 */
export const strategyAggressiveVote = action('激进推票策略', bb => {
  const { seerClaims } = bb.state;
  const safe = safeTargets(bb);
  // 优先找预言家（如存在），次选金水
  let target = null;
  if (seerClaims.length === 1 && safe.includes(seerClaims[0].playerId)) {
    target = seerClaims[0].playerId;
  } else {
    const gw = seerClaims.flatMap(c => c.goldWaters).find(id => safe.includes(id));
    target = gw ?? safe[0] ?? null;
  }
  if (target === null) return false;
  const facts = [
    `${target}号的发言逻辑前后矛盾，有明显破绽`,
    `我建议大家集中票数，今天必须票出${target}号`
  ];
  bb.setDecision({
    strategy: 'aggressive_lead_vote',
    suspectTarget: target,
    voteTarget: target,
    facts,
  }, `主动推票${target}号`);
  return true;
});

/** 策略：悍跳预言家 —— 场上无人跳时声称预言家 */
export const strategyFakeSeer = action('悍跳预言家策略', bb => {
  const { validTargets, wolfTeammates, alivePlayers } = bb.state;
  // 随机找一个非队友目标称为"查杀"
  const deadPlayers = alivePlayers.filter(p => !p.isAlive);
  // 优先找一个死去的非队友作为"已查"（不影响当前局面）
  const deadNonWolf = deadPlayers.filter(p => p.role !== '狼人');
  const fakeChecked = deadNonWolf.length > 0
    ? deadNonWolf[Math.floor(Math.random() * deadNonWolf.length)].id
    : validTargets.filter(id => !wolfTeammates.includes(id))[0];
  // 指认一个活着的非队友为"狼"
  const fakeKill = validTargets.filter(id => !wolfTeammates.includes(id))[0] ?? null;
  if (fakeKill === null) return false;
  const facts = [
    `我是预言家，昨晚查验了${fakeChecked ?? fakeKill}号，结果是好人`,
    `同时我综合之前信息，我强烈怀疑${fakeKill}号是狼，建议今天出局${fakeKill}号`
  ];
  bb.setDecision({
    strategy: 'fake_seer',
    suspectTarget: fakeKill,
    voteTarget: fakeKill,
    facts,
  }, `悍跳预言家，指认${fakeKill}号`);
  return true;
});

/** 策略：对抗跳 —— 场上有真预言家跳时，声称是自己才是真预言家 */
export const strategyCounterSeer = action('对抗跳策略', bb => {
  const { seerClaims, validTargets, wolfTeammates } = bb.state;
  if (seerClaims.length < 1) return false;
  const realSeer = seerClaims[0];
  const fakeKill = realSeer.playerId; // 反过来说真预言家是假的
  const safeNonSeer = validTargets.filter(id => !wolfTeammates.includes(id) && id !== realSeer.playerId);
  const fakeGold = safeNonSeer[0] ?? null;
  const facts = [
    `我才是真预言家！${realSeer.playerId}号是假预言家，他在撒谎`,
    fakeGold != null
      ? `我昨晚查验了${fakeGold}号，结果是好人，请大家相信我的判断`
      : `请大家今天优先投出${realSeer.playerId}号验明真假`
  ];
  bb.setDecision({
    strategy: 'counter_seer',
    suspectTarget: realSeer.playerId,
    voteTarget: realSeer.playerId,
    facts,
  }, `对抗跳，指认真预言家${realSeer.playerId}号为假预言家`);
  return true;
});
