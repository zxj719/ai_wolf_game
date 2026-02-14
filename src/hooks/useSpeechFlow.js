import { useEffect, useRef, useCallback } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';
import { TIMING } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * useSpeechFlow - 管理白天发言系统
 * 包含：发言锁管理、AI 发言触发、用户发言处理
 */
export function useSpeechFlow({
  phase,
  players,
  gameMode,
  dayCount,
  speakerIndex,
  setSpeakerIndex,
  speechHistory,
  setSpeechHistory,
  userPlayer,
  userInput,
  setUserInput,
  addLog,
  addCurrentPhaseSpeech,
  setPhase,
  askAI,
  moveToNextSpeaker,
  gameActiveRef,
}) {
  const speakingLockRef = useRef(false);
  const currentDayRef = useRef(1);
  // 用 ref 追踪当天已发言的玩家 ID，避免频繁遍历 speechHistory
  const spokenIdsRef = useRef(new Set());

  // 当天数变化时，重置发言锁和已发言集合
  useEffect(() => {
    if (currentDayRef.current !== dayCount) {
      currentDayRef.current = dayCount;
      speakingLockRef.current = false;
      spokenIdsRef.current = new Set();
    }
  }, [dayCount]);

  // 同步 spokenIdsRef（从 speechHistory 中恢复，防止漏记）
  useEffect(() => {
    const ids = new Set();
    speechHistory.forEach(s => {
      if (s.day === dayCount) ids.add(s.playerId);
    });
    spokenIdsRef.current = ids;
  }, [speechHistory, dayCount]);

  /** 检查某玩家今天是否已发言 */
  const hasSpoken = (playerId) => spokenIdsRef.current.has(playerId);

  // AI 发言 useEffect
  useEffect(() => {
    if (phase !== 'day_discussion' || speakerIndex === -1) return;
    if (!gameActiveRef.current) return;

    const alivePlayers = players.filter(p => p.isAlive);
    if (speakerIndex < 0 || speakerIndex >= alivePlayers.length) {
      setSpeakerIndex(-1);
      setPhase('day_voting');
      addLog('全员发言结束，进入放逐投票阶段。', 'system');
      return;
    }

    const currentSpeaker = alivePlayers[speakerIndex];

    // 发言锁检查
    if (speakingLockRef.current) {
      logger.debug(`[发言控制] 发言锁被占用，等待当前发言完成`);
      return;
    }

    // 防止重复发言（使用 ref 快速检查）
    if (hasSpoken(currentSpeaker.id)) {
      logger.debug(`[发言控制] ${currentSpeaker.id}号已在第${dayCount}天发言，跳过`);
      moveToNextSpeaker();
      return;
    }

    if (currentSpeaker && (!currentSpeaker.isUser || gameMode === 'ai-only')) {
      const triggerAISpeech = async () => {
        if (speakingLockRef.current) {
          logger.debug(`[发言控制] 锁已被占用，取消本次发言请求`);
          return;
        }

        speakingLockRef.current = true;
        logger.debug(`[发言控制] ${currentSpeaker.id}号获得发言锁，开始发言`);

        try {
          if (!gameActiveRef.current) return;

          // 二次检查
          if (hasSpoken(currentSpeaker.id)) {
            logger.debug(`[发言控制] 最终检查：${currentSpeaker.id}号已发言，取消API调用`);
            return;
          }

          const res = await askAI(currentSpeaker, PROMPT_ACTIONS.DAY_SPEECH);

          if (!gameActiveRef.current) return;

          if (res) {
            if (hasSpoken(currentSpeaker.id)) {
              logger.debug(`[发言控制] API返回后检查：${currentSpeaker.id}号已发言，丢弃结果`);
              return;
            }

            if (gameMode === 'ai-only' && res.thought) {
              addLog(`(思考) ${res.thought}`, "chat", `[${currentSpeaker.id}号]`);
            }

            if (res.speech) {
              addLog(res.speech, "chat", `[${currentSpeaker.id}号]`);

              addCurrentPhaseSpeech({
                playerId: currentSpeaker.id,
                name: currentSpeaker.name,
                content: res.speech,
                thought: res.thought,
                day: dayCount,
                timestamp: Date.now()
              });

              // 立即标记为已发言
              spokenIdsRef.current.add(currentSpeaker.id);

              setSpeechHistory(prev => {
                if (prev.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
                  return prev;
                }
                return [...prev, {
                  playerId: currentSpeaker.id,
                  name: currentSpeaker.name,
                  content: res.speech,
                  thought: res.thought,
                  identity_table: res.identity_table,
                  day: dayCount,
                  summary: res.summary || res.speech.slice(0, 20),
                  voteIntention: res.voteIntention
                }];
              });
            }
          }

          await new Promise(resolve => setTimeout(resolve, TIMING.SPEECH_RATE_LIMIT));
        } catch (error) {
          logger.error(`[发言控制] ${currentSpeaker.id}号发言出错:`, error);
        } finally {
          speakingLockRef.current = false;
          // 使用微任务延迟，确保 state 更新后再触发下一轮
          Promise.resolve().then(() => {
            if (gameActiveRef.current) {
              moveToNextSpeaker();
            }
          });
        }
      };
      triggerAISpeech();
    }
  }, [phase, speakerIndex, players, speechHistory, dayCount]);

  // 用户发言
  const handleUserSpeak = useCallback(() => {
    if (!userInput.trim()) return;

    const userId = userPlayer?.id ?? 0;
    if (hasSpoken(userId)) {
      addLog('你已经在本轮发言过了！', 'warning');
      return;
    }

    if (speakingLockRef.current) {
      addLog('请等待当前发言结束...', 'warning');
      return;
    }

    speakingLockRef.current = true;

    try {
      addLog(userInput, "chat", "你");

      addCurrentPhaseSpeech({
        playerId: userId,
        name: "你",
        content: userInput,
        day: dayCount,
        timestamp: Date.now()
      });

      spokenIdsRef.current.add(userId);

      setSpeechHistory(prev => {
        if (prev.some(s => s.day === dayCount && s.playerId === userId)) {
          return prev;
        }
        return [...prev, {
          playerId: userId,
          name: "你",
          content: userInput,
          day: dayCount
        }];
      });
      setUserInput("");
    } finally {
      speakingLockRef.current = false;
      Promise.resolve().then(() => {
        if (gameActiveRef.current) {
          moveToNextSpeaker();
        }
      });
    }
  }, [userInput, speechHistory, dayCount, userPlayer, addLog, addCurrentPhaseSpeech, setSpeechHistory, setUserInput, moveToNextSpeaker]);

  return { handleUserSpeak };
}
