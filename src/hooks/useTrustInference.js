/**
 * P1-3: 信任与推断集成Hook
 *
 * 整合GRATR信任评分系统和贝叶斯身份推断模块
 * 提供统一的接口供游戏状态管理使用
 */

import { useCallback, useMemo, useRef } from 'react';
import {
  initializeTrustProfiles,
  extractTrustEvidence,
  analyzeVoteBehavior,
  updateTrustScore,
  generateTrustContext,
  getMostSuspicious,
  getMostTrusted
} from '../services/trustScoring';
import {
  initializeIdentityDistributions,
  bayesianUpdate,
  detectActionsFromSpeech,
  detectActionsFromVote,
  detectActionsFromDeath,
  generateBayesianContext,
  rankByWerewolfProbability,
  updateDistributionsOnDeath
} from '../services/bayesianInference';

/**
 * 信任与推断管理Hook
 * @param {Object} params - 参数对象
 */
export function useTrustInference({
  players,
  speechHistory,
  voteHistory,
  deathHistory,
  seerChecks,
  dayCount,
  gameSetup
}) {
  // 使用ref持久化存储，避免每次渲染重新计算
  const trustProfilesRef = useRef(null);
  const identityDistributionsRef = useRef(null);
  const lastProcessedSpeechRef = useRef(0);
  const lastProcessedVoteRef = useRef(0);
  const lastProcessedDeathRef = useRef(0);

  // 初始化或获取信任档案
  const getTrustProfiles = useCallback(() => {
    if (!trustProfilesRef.current && players.length > 0) {
      trustProfilesRef.current = initializeTrustProfiles(players);
    }
    return trustProfilesRef.current || {};
  }, [players]);

  // 初始化或获取身份分布
  const getIdentityDistributions = useCallback(() => {
    if (!identityDistributionsRef.current && players.length > 0 && gameSetup) {
      identityDistributionsRef.current = initializeIdentityDistributions(players, gameSetup);
    }
    return identityDistributionsRef.current || {};
  }, [players, gameSetup]);

  // 处理新发言 - 更新信任和概率
  const processSpeech = useCallback((speech) => {
    const profiles = getTrustProfiles();
    const distributions = getIdentityDistributions();

    if (!profiles[speech.playerId] || !distributions[speech.playerId]) return;

    // 1. 提取信任证据
    const trustEvidence = extractTrustEvidence(speech, { seerChecks, dayCount });
    if (trustEvidence.length > 0) {
      trustProfilesRef.current[speech.playerId] = updateTrustScore(
        profiles[speech.playerId],
        trustEvidence
      );
    }

    // 2. 检测行为并更新贝叶斯概率
    const actions = detectActionsFromSpeech(speech);
    actions.forEach(action => {
      identityDistributionsRef.current[speech.playerId] = bayesianUpdate(
        distributions[speech.playerId],
        action.type,
        action.context
      );
    });
  }, [getTrustProfiles, getIdentityDistributions, seerChecks, dayCount]);

  // 处理投票 - 更新信任和概率
  const processVote = useCallback((vote, lastSpeech) => {
    const profiles = getTrustProfiles();
    const distributions = getIdentityDistributions();

    if (!profiles[vote.from]) return;

    // 1. 分析投票行为的信任影响
    const voteEvidence = analyzeVoteBehavior(vote, lastSpeech, { seerChecks, voteHistory, dayCount });
    if (voteEvidence.length > 0) {
      trustProfilesRef.current[vote.from] = updateTrustScore(
        profiles[vote.from],
        voteEvidence
      );
    }

    // 2. 更新贝叶斯概率
    const actions = detectActionsFromVote(vote, { seerChecks });
    actions.forEach(action => {
      if (distributions[vote.from]) {
        identityDistributionsRef.current[vote.from] = bayesianUpdate(
          distributions[vote.from],
          action.type,
          action.context
        );
      }
    });
  }, [getTrustProfiles, getIdentityDistributions, seerChecks, voteHistory, dayCount]);

  // 处理死亡事件
  const processDeath = useCallback((death, actualRole) => {
    const distributions = getIdentityDistributions();

    // 更新死亡行为（如被刀可能说明是神职）
    const actions = detectActionsFromDeath(death, dayCount);
    actions.forEach(action => {
      if (distributions[death.playerId]) {
        identityDistributionsRef.current[death.playerId] = bayesianUpdate(
          distributions[death.playerId],
          action.type
        );
      }
    });

    // 根据死亡信息调整其他玩家的概率
    if (actualRole) {
      identityDistributionsRef.current = updateDistributionsOnDeath(
        distributions,
        death,
        actualRole
      );
    }
  }, [getIdentityDistributions, dayCount]);

  // 批量处理新数据
  const processNewData = useCallback(() => {
    // 处理新发言
    const newSpeeches = speechHistory.slice(lastProcessedSpeechRef.current);
    newSpeeches.forEach(speech => {
      processSpeech(speech);
    });
    lastProcessedSpeechRef.current = speechHistory.length;

    // 处理新投票
    const newVotes = voteHistory.slice(lastProcessedVoteRef.current);
    newVotes.forEach(voteRound => {
      voteRound.votes.forEach(vote => {
        // 找到该玩家最后一次发言
        const lastSpeech = speechHistory
          .filter(s => s.playerId === vote.from && s.day === voteRound.day)
          .pop();
        processVote(vote, lastSpeech);
      });
    });
    lastProcessedVoteRef.current = voteHistory.length;

    // 处理新死亡
    const newDeaths = deathHistory.slice(lastProcessedDeathRef.current);
    newDeaths.forEach(death => {
      const player = players.find(p => p.id === death.playerId);
      processDeath(death, player?.role);
    });
    lastProcessedDeathRef.current = deathHistory.length;
  }, [speechHistory, voteHistory, deathHistory, players, processSpeech, processVote, processDeath]);

  // 获取综合分析上下文（用于AI提示词）
  const getInferenceContext = useCallback((selfId) => {
    // 先处理最新数据
    processNewData();

    const profiles = getTrustProfiles();
    const distributions = getIdentityDistributions();
    const alivePlayers = players.filter(p => p.isAlive);

    const parts = [];

    // 1. 信任分析
    const trustContext = generateTrustContext(profiles, alivePlayers, selfId);
    if (trustContext) {
      parts.push(trustContext);
    }

    // 2. 贝叶斯推断
    const bayesianContext = generateBayesianContext(distributions, alivePlayers, selfId);
    if (bayesianContext) {
      parts.push(bayesianContext);
    }

    return parts.length > 0 ? '\n【P1分析】\n' + parts.join('\n') : '';
  }, [processNewData, getTrustProfiles, getIdentityDistributions, players]);

  // 获取投票建议
  const getVoteSuggestion = useCallback((selfId) => {
    processNewData();

    const profiles = getTrustProfiles();
    const distributions = getIdentityDistributions();
    const alivePlayers = players.filter(p => p.isAlive && p.id !== selfId);

    // 综合信任分数和狼人概率
    const candidates = alivePlayers.map(p => {
      const trust = profiles[p.id]?.overallTrust || 0.5;
      const wolfProb = distributions[p.id]?.posteriors?.['狼人'] || 0.25;

      // 综合评分：低信任 + 高狼概率 = 高优先投票
      const voteScore = (1 - trust) * 0.5 + wolfProb * 0.5;

      return {
        playerId: p.id,
        trust,
        wolfProb,
        voteScore
      };
    });

    // 按投票优先级排序
    candidates.sort((a, b) => b.voteScore - a.voteScore);

    return candidates.slice(0, 3);
  }, [processNewData, getTrustProfiles, getIdentityDistributions, players]);

  // 获取守护建议（守卫用）
  const getGuardSuggestion = useCallback((selfId) => {
    processNewData();

    const distributions = getIdentityDistributions();
    const alivePlayers = players.filter(p => p.isAlive && p.id !== selfId);

    // 守卫应该保护低狼概率的神职
    const candidates = alivePlayers.map(p => {
      const dist = distributions[p.id]?.posteriors || {};

      // 计算神职概率
      const seerProb = dist['预言家'] || 0;
      const witchProb = dist['女巫'] || 0;
      const hunterProb = dist['猎人'] || 0;

      // 守护优先级：预言家 > 女巫 > 猎人
      const guardScore = seerProb * 3 + witchProb * 2 + hunterProb * 1;

      return {
        playerId: p.id,
        seerProb,
        witchProb,
        guardScore
      };
    });

    candidates.sort((a, b) => b.guardScore - a.guardScore);

    return candidates.slice(0, 2);
  }, [processNewData, getIdentityDistributions, players]);

  // 获取袭击建议（狼人用）
  const getAttackSuggestion = useCallback((wolfIds) => {
    processNewData();

    const distributions = getIdentityDistributions();
    const alivePlayers = players.filter(p => p.isAlive && !wolfIds.includes(p.id));

    // 狼人应该优先刀神职
    const candidates = alivePlayers.map(p => {
      const dist = distributions[p.id]?.posteriors || {};

      // 刀人优先级：女巫 > 预言家 > 守卫 > 猎人 > 村民
      const witchProb = dist['女巫'] || 0;
      const seerProb = dist['预言家'] || 0;
      const guardProb = dist['守卫'] || 0;
      const hunterProb = dist['猎人'] || 0;

      const attackScore = witchProb * 4 + seerProb * 3 + guardProb * 2 + hunterProb * 1;

      return {
        playerId: p.id,
        witchProb,
        seerProb,
        attackScore
      };
    });

    candidates.sort((a, b) => b.attackScore - a.attackScore);

    return candidates.slice(0, 2);
  }, [processNewData, getIdentityDistributions, players]);

  // 重置状态（新游戏时调用）
  const reset = useCallback(() => {
    trustProfilesRef.current = null;
    identityDistributionsRef.current = null;
    lastProcessedSpeechRef.current = 0;
    lastProcessedVoteRef.current = 0;
    lastProcessedDeathRef.current = 0;
  }, []);

  // 当前状态快照
  const snapshot = useMemo(() => ({
    trustProfiles: getTrustProfiles(),
    identityDistributions: getIdentityDistributions()
  }), [getTrustProfiles, getIdentityDistributions]);

  return {
    // 数据处理
    processSpeech,
    processVote,
    processDeath,
    processNewData,

    // 分析获取
    getInferenceContext,
    getVoteSuggestion,
    getGuardSuggestion,
    getAttackSuggestion,

    // 状态管理
    reset,
    snapshot,

    // 直接访问
    getMostSuspicious: (selfId, count = 3) => {
      const profiles = getTrustProfiles();
      const alivePlayers = players.filter(p => p.isAlive);
      return getMostSuspicious(profiles, alivePlayers, selfId, count);
    },
    getMostTrusted: (selfId, count = 2) => {
      const profiles = getTrustProfiles();
      const alivePlayers = players.filter(p => p.isAlive);
      return getMostTrusted(profiles, alivePlayers, selfId, count);
    },
    getWolfRanking: () => {
      const distributions = getIdentityDistributions();
      const alivePlayers = players.filter(p => p.isAlive);
      return rankByWerewolfProbability(distributions, alivePlayers);
    }
  };
}
