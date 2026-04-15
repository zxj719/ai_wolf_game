/**
 * 狼人发言策略行为树
 *
 * 输出：{ strategy, suspectTarget, voteTarget, facts[] }
 * 注意：不生成自然语言——自然语言交给 LLM 润色层处理。
 *
 * 策略选择优先级：
 *   1. 影随队友（队友已发言，跟队友立场掩护）
 *   2. 激进推票（狼队占优势，主动带节奏）
 *   3. 对抗跳（场上有真预言家，狼队岌岌可危时反制）
 *   4. 悍跳预言家（场上无人跳，随机 25% 触发）
 *   5. 深水默认（安全兜底）
 *
 * 随机扰动（15%）：每个 Selector 有概率跳过最优直接选次优，
 * 防止 AI 行为过于机械可预测。
 */

import { selector, sequence, condition } from '../../core/nodes.js';
import {
  hasSpokenWolfTeammate,
  noSeerClaimYet,
  exactlyOneSeerClaim,
  wolvesInMajority,
} from '../../conditions/wolf.js';
import {
  strategyQuietVillager,
  strategyShadeTeammate,
  strategyAggressiveVote,
  strategyFakeSeer,
  strategyCounterSeer,
} from '../../actions/wolfActions.js';

// 25% 随机激活悍跳（即使没人跳也可能不悍跳，保持不可预测）
const fakeSeerRandom = condition('悍跳随机触发(25%)', bb => {
  const noSeer = bb.state.seerClaims.length === 0;
  return noSeer && Math.random() < 0.25;
});

// 80% 随机触发对抗跳（形势严峻才高概率触发）
const counterSeerRandom = condition('对抗随机触发(80%)', bb => {
  const { seerClaims, wolfTeammates, alivePlayers } = bb.state;
  if (seerClaims.length !== 1) return false;
  const wolves = alivePlayers.filter(p => p.role === '狼人').length;
  const good = alivePlayers.filter(p => p.role !== '狼人').length;
  const inDanger = good > wolves; // 狼队劣势时才高概率跳
  return inDanger ? Math.random() < 0.80 : Math.random() < 0.20;
});

export const werewolfSpeechTree = selector('werewolf_speech', [
  sequence('影随队友',   [hasSpokenWolfTeammate, strategyShadeTeammate]),
  sequence('激进推票',   [wolvesInMajority, strategyAggressiveVote]),
  sequence('对抗跳',     [counterSeerRandom, strategyCounterSeer]),
  sequence('悍跳',       [fakeSeerRandom, strategyFakeSeer]),
  strategyQuietVillager,  // 兜底：深水
]);
