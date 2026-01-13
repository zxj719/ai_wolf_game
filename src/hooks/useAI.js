import { useCallback, useMemo } from 'react';
import { fetchLLM } from '../services/aiClient';
import { generateSystemPrompt, generateUserPrompt, PROMPT_ACTIONS } from '../services/aiPrompts';
import { enhanceSpeechHistory } from '../services/ragSchema';
import {
  getVerificationStatus,
  buildSeerConflictInfo,
  getLogicContradictions,
  generateSituationSummary
} from '../services/ragRetrieval';

export function useAI({
  players,
  speechHistory,
  voteHistory,
  deathHistory,
  nightDecisions,
  seerChecks,
  guardHistory,
  witchHistory,
  dayCount,
  phase,
  setIsThinking,
  disabledModelsRef,
  API_URL,
  API_KEY,
  AI_MODELS,
  // P1增强：信任与推断上下文获取函数（可选）
  getInferenceContext = null,
  // P2增强：双系统上下文获取函数（可选）
  getDualSystemContext = null
}) {

  // P0增强：增强版发言历史（添加逻辑断言等结构化信息）
  const enhancedSpeechHistory = useMemo(() => {
    return enhanceSpeechHistory(speechHistory);
  }, [speechHistory]);

  /**
   * P0增强：构建RAG上下文
   * 为AI决策提供结构化的检索信息
   */
  const buildRAGContext = useCallback((player, actionType) => {
    // 只在白天发言和投票时构建详细RAG上下文
    if (actionType !== PROMPT_ACTIONS.DAY_SPEECH && actionType !== PROMPT_ACTIONS.DAY_VOTE) {
      return '';
    }

    const ragParts = [];

    // 1. 预言家对抗情况
    const seerConflict = buildSeerConflictInfo(enhancedSpeechHistory, seerChecks);
    if (seerConflict.hasConflict) {
      ragParts.push(`【预言家对抗】${seerConflict.analysis}`);
      seerConflict.conflicts.forEach(c => {
        ragParts.push(`  - ${c.description}`);
      });
    }

    // 2. 金水/查杀信息汇总
    const alivePlayers = players.filter(p => p.isAlive);
    const verificationInfo = [];
    alivePlayers.forEach(p => {
      const v = getVerificationStatus(enhancedSpeechHistory, p.id);
      if (v.goldWaters.length > 0) {
        verificationInfo.push(`${p.id}号: 金水(来自${v.goldWaters.map(g => g.seerId + '号').join(',')})`);
      }
      if (v.kills.length > 0) {
        verificationInfo.push(`${p.id}号: 被查杀(来自${v.kills.map(k => k.seerId + '号').join(',')})`);
      }
    });
    if (verificationInfo.length > 0) {
      ragParts.push(`【身份验证】${verificationInfo.join('; ')}`);
    }

    // 3. 如果是预言家，提醒不要投金水
    if (player.role === '预言家') {
      const myChecks = seerChecks.filter(c => c.seerId === player.id && !c.isWolf);
      if (myChecks.length > 0) {
        const goldWaterIds = myChecks.map(c => c.targetId).join(',');
        ragParts.push(`【预言家提醒】你验过的金水: ${goldWaterIds}号，投票时绝不能投他们！`);
      }
    }

    // 4. 检测可疑玩家（有矛盾的）
    const suspiciousPlayers = [];
    alivePlayers.forEach(p => {
      if (p.id === player.id) return;
      const contradictions = getLogicContradictions(enhancedSpeechHistory, p.id);
      if (contradictions.length > 0) {
        suspiciousPlayers.push(`${p.id}号(${contradictions.length}处矛盾)`);
      }
    });
    if (suspiciousPlayers.length > 0) {
      ragParts.push(`【矛盾检测】发言有矛盾的玩家: ${suspiciousPlayers.join(', ')}`);
    }

    return ragParts.length > 0 ? '\n' + ragParts.join('\n') : '';
  }, [players, enhancedSpeechHistory, voteHistory, deathHistory, seerChecks, dayCount]);

  const askAI = useCallback(async (player, actionType, params = {}) => {
    setIsThinking(true);

    // Construct GameState object with enhanced speech history
    const gameState = {
      players,
      speechHistory: enhancedSpeechHistory,
      voteHistory,
      deathHistory,
      nightDecisions,
      seerChecks,
      guardHistory,
      witchHistory,
      dayCount,
      phase
    };

    // P0增强：添加RAG上下文到params
    const ragContext = buildRAGContext(player, actionType);

    // P1增强：获取信任与推断上下文
    const inferenceContext = getInferenceContext ? getInferenceContext(player.id) : '';

    // P2增强：获取双系统上下文（Listener摘要 + Thinker策略 + 欺骗检测）
    const dualSystemContext = getDualSystemContext ? getDualSystemContext(player) : '';

    const enhancedParams = {
      ...params,
      ragContext,
      inferenceContext,
      dualSystemContext,
      // 传递当前玩家信息，用于角色路由
      currentPlayer: player,
      playerId: player.id
    };

    const systemPrompt = generateSystemPrompt(player, gameState);
    // 将所有增强上下文附加到用户提示词
    // generateUserPrompt 现在会根据玩家角色路由到不同的提示词模板
    let userPrompt = generateUserPrompt(actionType, gameState, enhancedParams);
    const allContexts = [ragContext, inferenceContext, dualSystemContext].filter(Boolean);
    if (allContexts.length > 0) {
      userPrompt = allContexts.join('\n') + '\n' + userPrompt;
    }

    // ============================================
    // 详细日志输出 - 方便调试
    // ============================================
    console.group(`🤖 [AI请求] ${player.id}号 ${player.name} (${player.role}) - ${actionType}`);
    console.log('%c📋 System Prompt:', 'color: #60a5fa; font-weight: bold;');
    console.log(systemPrompt);
    console.log('%c📝 User Prompt:', 'color: #34d399; font-weight: bold;');
    console.log(userPrompt);
    if (ragContext) {
      console.log('%c🔍 RAG Context:', 'color: #a78bfa; font-weight: bold;');
      console.log(ragContext);
    }
    if (inferenceContext) {
      console.log('%c🧠 Inference Context:', 'color: #f472b6; font-weight: bold;');
      console.log(inferenceContext);
    }
    if (dualSystemContext) {
      console.log('%c⚙️ Dual System Context:', 'color: #fbbf24; font-weight: bold;');
      console.log(dualSystemContext);
    }
    console.groupEnd();

    let result = await fetchLLM(
      { player, prompt: userPrompt, systemInstruction: systemPrompt },
      { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
    );

    // ============================================
    // 无效响应时自动切换模型重试
    // ============================================
    if (!result) {
      console.warn(`⚠️ [重试] ${player.id}号 ${player.name} 首次请求无效，尝试切换模型重试...`);

      // 清空黑名单，从下一个模型开始重新尝试
      const currentBlacklisted = Array.from(disabledModelsRef.current);
      disabledModelsRef.current.clear();

      // 计算一个不同的起始模型索引
      const defaultModelIndex = player ? player.id % AI_MODELS.length : 0;
      const alternateModelIndex = (defaultModelIndex + Math.floor(AI_MODELS.length / 2)) % AI_MODELS.length;

      console.log(`🔄 [切换] 从模型索引 ${alternateModelIndex} (${AI_MODELS[alternateModelIndex]?.name}) 开始重试`);

      result = await fetchLLM(
        { player, prompt: userPrompt, systemInstruction: systemPrompt, forcedModelIndex: alternateModelIndex },
        { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
      );

      // 如果仍然失败，记录并恢复部分黑名单
      if (!result) {
        console.error(`❌ [彻底失败] ${player.id}号 ${player.name} 所有重试均失败`);
        // 恢复原黑名单的一部分，避免反复尝试已知失败的模型
        currentBlacklisted.slice(0, Math.floor(currentBlacklisted.length / 2)).forEach(idx => {
          disabledModelsRef.current.add(idx);
        });
      }
    }

    // ============================================
    // 输出AI响应结果 - 包含思考过程
    // ============================================
    if (result) {
      console.group(`✅ [AI响应] ${player.id}号 ${player.name} (${player.role}) - ${actionType}`);
      if (result.thought || result.reasoning) {
        console.log('%c💭 AI思考过程:', 'color: #c084fc; font-weight: bold;');
        console.log(result.thought || result.reasoning);
      }
      if (result.speech) {
        console.log('%c💬 发言内容:', 'color: #4ade80; font-weight: bold;');
        console.log(result.speech);
      }
      if (result.voteIntention !== undefined) {
        console.log('%c🗳️ 投票意向:', 'color: #fb923c; font-weight: bold;', result.voteIntention + '号');
      }
      if (result.targetId !== undefined) {
        console.log('%c🎯 目标选择:', 'color: #f87171; font-weight: bold;', result.targetId !== null ? result.targetId + '号' : '空过');
      }
      if (result.useSave !== undefined) {
        console.log('%c💊 解药使用:', 'color: #2dd4bf; font-weight: bold;', result.useSave ? '是' : '否');
      }
      if (result.usePoison !== undefined && result.usePoison !== null) {
        console.log('%c☠️ 毒药目标:', 'color: #ef4444; font-weight: bold;', result.usePoison + '号');
      }
      console.log('%c📦 完整响应:', 'color: #94a3b8;', result);
      console.groupEnd();
    } else {
      console.warn(`❌ [AI响应] ${player.id}号 ${player.name} - 无有效响应`);
    }

    setIsThinking(false);
    return result;
  }, [players, enhancedSpeechHistory, voteHistory, deathHistory, nightDecisions, seerChecks, guardHistory, witchHistory, dayCount, phase, API_KEY, AI_MODELS, API_URL, setIsThinking, disabledModelsRef, buildRAGContext, getInferenceContext, getDualSystemContext]);

  /**
   * P0增强：获取局势摘要
   * 可用于显示或日志
   */
  const getSituationSummary = useCallback(() => {
    const gameState = {
      players,
      speechHistory: enhancedSpeechHistory,
      voteHistory,
      deathHistory,
      seerChecks,
      dayCount
    };
    return generateSituationSummary(gameState);
  }, [players, enhancedSpeechHistory, voteHistory, deathHistory, seerChecks, dayCount]);

  return { askAI, getSituationSummary, enhancedSpeechHistory };
}
