import { useEffect, useCallback, useRef } from 'react';
import { abortAllRequests, resetAbortController } from '../services/aiClient';
import { saveGameRecord } from '../services/gameService';
import { authService } from '../services/authService';

/**
 * useGameLifecycle - 管理游戏生命周期
 * 包含：endGame、页面可见性、游戏初始化、游戏结束战绩提交
 */
export function useGameLifecycle({
  setGameMode,
  setSelectedSetup,
  defaultSetup,
  setIsThinking,
  setHunterShooting,
  setSelectedTarget,
  setSpeakerIndex,
  setSpeakingOrder,
  setSpokenCount,
  setUserInput,
  setGameResult,
  setGameStartTime,
  gameResult,
  gameStartTime,
  gameMode,
  players,
  user,
  isGuestMode,
  modelUsage,
  initGame,
  setPhase,
  setNightStep,
  setDayCount,
  setNightDecisions,
  setLogs,
  clearCurrentPhaseData,
  processedVoteDayRef,
}) {
  const gameActiveRef = useRef(false);

  // endGame: 重置所有游戏状态
  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    abortAllRequests();
    processedVoteDayRef.current = -1;
    setGameMode(null);
    setSelectedSetup(defaultSetup);
    setIsThinking(false);
    setHunterShooting(null);
    setSelectedTarget(null);
    setSpeakerIndex(-1);
    setSpeakingOrder('left');
    setSpokenCount(0);
    setUserInput('');
    setGameResult(null);
    setGameStartTime(null);
    setPhase('setup');
    setNightStep(0);
    setDayCount(1);
    setNightDecisions({
      wolfTarget: null,
      wolfSkipKill: false,
      witchSave: false,
      witchPoison: null,
      guardTarget: null,
      lastGuardTarget: null,
      seerResult: null
    });
    setLogs([]);
    clearCurrentPhaseData();
  }, []);

  // 页面可见性/卸载处理
  useEffect(() => {
    const handleBeforeUnload = () => {
      abortAllRequests();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        abortAllRequests();
      } else {
        resetAbortController();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 游戏初始化
  useEffect(() => {
    if (gameMode) {
      resetAbortController();
      gameActiveRef.current = true;
      initGame(gameMode);
      setGameStartTime(Date.now());
    }
  }, [gameMode]);

  // 游戏结束战绩提交
  useEffect(() => {
    if (!gameResult || !gameMode) return;

    const saveRecord = async () => {
      // 保存用户战绩（非游客模式）
      if (user && !isGuestMode) {
        try {
          const userPlayer = players.find(p => p.isUser);
          const duration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
          await saveGameRecord({
            role: userPlayer?.role || '观战',
            result: gameResult === 'good_win'
              ? (userPlayer?.role === '狼人' ? 'lose' : 'win')
              : (userPlayer?.role === '狼人' ? 'win' : 'lose'),
            game_mode: gameMode,
            duration_seconds: duration
          });
        } catch (err) {
          console.error('[战绩] 保存失败:', err);
        }
      }

      // 提交 AI 模型统计
      if (modelUsage?.playerModels) {
        try {
          const modelStats = {};
          Object.values(modelUsage.playerModels).forEach(({ modelId }) => {
            if (modelId) {
              modelStats[modelId] = (modelStats[modelId] || 0) + 1;
            }
          });

          const playerResults = players.map(p => ({
            playerId: p.id,
            role: p.role,
            isWinner: gameResult === 'good_win' ? p.role !== '狼人' : p.role === '狼人',
            modelId: modelUsage.playerModels[p.id]?.modelId || null,
            modelName: modelUsage.playerModels[p.id]?.modelName || null,
          }));

          await authService.submitModelStats({
            gameSessionId: modelUsage.gameSessionId,
            gameResult,
            gameMode,
            playerResults,
            modelStats
          });
        } catch (err) {
          console.error('[模型统计] 提交失败:', err);
        }
      }
    };

    saveRecord();
  }, [gameResult]);

  return { endGame, gameActiveRef };
}
