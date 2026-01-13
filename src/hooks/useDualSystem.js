/**
 * P2-4: 双系统集成Hook
 *
 * 整合Listener感知层、Thinker推理层和欺骗检测模块
 * 提供统一的接口供游戏状态管理使用
 */

import { useCallback, useRef } from 'react';
import {
  buildFeatureMatrix,
  listenerExtract,
  thinkerDecide,
  generateThinkerContext,
  generateListenerContext
} from '../services/dualSystem';
import {
  initializeDeceptionProfiles,
  analyzeDeceptionSignals,
  analyzeVoteDeception,
  updateDeceptionProfile,
  generateDeceptionContext
} from '../services/deceptionDetection';

/**
 * 双系统管理Hook
 * @param {Object} params - 参数对象
 */
export function useDualSystem({
  players,
  speechHistory,
  voteHistory,
  seerChecks,
  deathHistory,
  dayCount,
  gameSetup
}) {
  // 使用ref持久化存储
  const featureMatrixRef = useRef(null);
  const deceptionProfilesRef = useRef(null);
  const lastProcessedSpeechRef = useRef(0);
  const lastProcessedVoteRef = useRef(0);

  // 初始化或获取特征矩阵
  const getFeatureMatrix = useCallback(() => {
    if (!featureMatrixRef.current && players.length > 0) {
      featureMatrixRef.current = buildFeatureMatrix([], players);
    }
    return featureMatrixRef.current || {};
  }, [players]);

  // 初始化或获取欺骗档案
  const getDeceptionProfiles = useCallback(() => {
    if (!deceptionProfilesRef.current && players.length > 0) {
      deceptionProfilesRef.current = initializeDeceptionProfiles(players);
    }
    return deceptionProfilesRef.current || {};
  }, [players]);

  // 处理新发言
  const processSpeech = useCallback((speech) => {
    const profiles = getDeceptionProfiles();
    const profile = profiles[speech.playerId];
    if (!profile) return;

    // 分析欺骗信号
    const signals = analyzeDeceptionSignals(speech, profile, {
      speechHistory,
      voteHistory
    });

    // 更新欺骗档案
    deceptionProfilesRef.current[speech.playerId] = updateDeceptionProfile(
      profile,
      signals,
      speech
    );
  }, [getDeceptionProfiles, speechHistory, voteHistory]);

  // 处理投票
  const processVote = useCallback((vote, lastSpeech) => {
    const profiles = getDeceptionProfiles();
    const profile = profiles[vote.from];
    if (!profile) return;

    // 分析投票欺骗
    const signals = analyzeVoteDeception(vote, lastSpeech, profile);

    if (signals.length > 0) {
      deceptionProfilesRef.current[vote.from] = {
        ...profile,
        signals: [...profile.signals, ...signals],
        lastUpdated: Date.now()
      };
    }
  }, [getDeceptionProfiles]);

  // 批量处理新数据
  const processNewData = useCallback(() => {
    // 更新特征矩阵
    featureMatrixRef.current = buildFeatureMatrix(speechHistory, players);

    // 处理新发言的欺骗检测
    const newSpeeches = speechHistory.slice(lastProcessedSpeechRef.current);
    newSpeeches.forEach(speech => {
      processSpeech(speech);
    });
    lastProcessedSpeechRef.current = speechHistory.length;

    // 处理新投票的欺骗检测
    const newVotes = voteHistory.slice(lastProcessedVoteRef.current);
    newVotes.forEach(voteRound => {
      voteRound.votes.forEach(vote => {
        const lastSpeech = speechHistory
          .filter(s => s.playerId === vote.from && s.day === voteRound.day)
          .pop();
        processVote(vote, lastSpeech);
      });
    });
    lastProcessedVoteRef.current = voteHistory.length;
  }, [speechHistory, voteHistory, players, processSpeech, processVote]);

  // 获取综合P2上下文（用于AI提示词）
  const getDualSystemContext = useCallback((player) => {
    // 先处理最新数据
    processNewData();

    const featureMatrix = getFeatureMatrix();
    const deceptionProfiles = getDeceptionProfiles();
    const alivePlayers = players.filter(p => p.isAlive);

    const parts = [];

    // 1. Listener摘要（今日发言）
    const todaySpeeches = speechHistory.filter(s => s.day === dayCount);
    const listenerContext = generateListenerContext(todaySpeeches);
    if (listenerContext) {
      parts.push(listenerContext);
    }

    // 2. Thinker策略建议
    const gameState = {
      players,
      seerChecks,
      deathHistory,
      dayCount
    };
    const thinkerContext = generateThinkerContext({
      player,
      featureMatrix,
      gameState,
      trustProfiles: null,
      identityDistributions: null
    });
    if (thinkerContext) {
      parts.push(thinkerContext);
    }

    // 3. 欺骗检测结果
    const deceptionContext = generateDeceptionContext(deceptionProfiles, alivePlayers, player.id);
    if (deceptionContext) {
      parts.push(deceptionContext);
    }

    return parts.length > 0 ? '\n【P2分析】\n' + parts.join('\n') : '';
  }, [processNewData, getFeatureMatrix, getDeceptionProfiles, players, speechHistory, dayCount, seerChecks, deathHistory]);

  // 获取策略建议
  const getStrategyAdvice = useCallback((player) => {
    processNewData();

    const featureMatrix = getFeatureMatrix();
    const gameState = {
      players,
      seerChecks,
      deathHistory,
      dayCount
    };

    return thinkerDecide({
      player,
      featureMatrix,
      gameState,
      trustProfiles: null,
      identityDistributions: null
    });
  }, [processNewData, getFeatureMatrix, players, seerChecks, deathHistory, dayCount]);

  // 获取玩家欺骗评分
  const getDeceptionScore = useCallback((playerId) => {
    const profiles = getDeceptionProfiles();
    return profiles[playerId]?.deceptionScore || 0;
  }, [getDeceptionProfiles]);

  // 获取最可疑的欺骗者
  const getMostDeceptive = useCallback((selfId, count = 3) => {
    processNewData();
    const profiles = getDeceptionProfiles();
    const alivePlayers = players.filter(p => p.isAlive && p.id !== selfId);

    return alivePlayers
      .map(p => ({
        playerId: p.id,
        score: profiles[p.id]?.deceptionScore || 0,
        patterns: profiles[p.id]?.patterns || []
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }, [processNewData, getDeceptionProfiles, players]);

  // 重置状态
  const reset = useCallback(() => {
    featureMatrixRef.current = null;
    deceptionProfilesRef.current = null;
    lastProcessedSpeechRef.current = 0;
    lastProcessedVoteRef.current = 0;
  }, []);

  return {
    // 数据处理
    processSpeech,
    processVote,
    processNewData,

    // 上下文获取
    getDualSystemContext,
    getStrategyAdvice,

    // 欺骗分析
    getDeceptionScore,
    getMostDeceptive,

    // 直接访问
    getFeatureMatrix,
    getDeceptionProfiles,

    // 状态管理
    reset
  };
}
