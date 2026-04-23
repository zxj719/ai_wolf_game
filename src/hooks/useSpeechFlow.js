import { useEffect, useRef, useCallback } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';
import { TIMING } from '../config/constants';
import { logger } from '../utils/logger';
import { validateKnightDuel, executeDuel, applyDuelResult } from '../utils/knightUtils';
import { buildSnapshot, buildActionKey } from '../services/snapshotBuilder';
import { dispatchCommand } from '../services/commandDispatcher';

/**
 * useSpeechFlow - 管理白天发言系统
 * 包含：发言锁管理、AI 发言触发、用户发言处理
 */
export function useSpeechFlow({
  phase,
  players,
  setPlayers,
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
  ROLE_DEFINITIONS,
  setDeathHistory,
  checkGameEnd,
  proceedToNextNight,
  // 柱一：幂等原子 action
  killPlayer,
  recordSpeech,
  // 柱三：结构化声明事件
  recordClaim,
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

  /** 处理骑士决斗 */
  const handleKnightDuel = useCallback(async (knight, targetId, reason, confidence) => {
    if (!gameActiveRef.current) return;

    // 验证决斗是否合法
    const validation = validateKnightDuel(knight, targetId, players);
    if (!validation.valid) {
      logger.error(`[骑士决斗] 决斗验证失败：${validation.reason}`);
      addLog(`骑士决斗失败：${validation.reason}`, 'error');
      return;
    }

    const target = players.find(p => p.id === targetId);

    // 宣告决斗
    addLog(
      `🗡️ ${knight.id}号骑士翻牌！发动决斗挑战 ${targetId}号！`,
      'system'
    );
    addLog(`决斗理由：${reason || '未说明'}（确信度：${confidence || 0}%）`, 'system');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 执行决斗判定
    const duelResult = executeDuel(knight, target, ROLE_DEFINITIONS);

    // 公布结果
    addLog(duelResult.message, 'important');
    addLog(`${target.id}号的真实身份是：${target.role}`, 'reveal');

    // 柱一：先原子 killPlayer（atomic isAlive + deathHistory），再 setPlayers 应用骑士 hasUsedDuel 等额外字段
    // 顺序重要：killPlayer 依赖 reducer 中 target 仍 isAlive 才触发；setPlayers 随后覆写的玩家数组里 isAlive 已为 false，与 killPlayer 结果一致
    killPlayer({
      playerId: duelResult.killedPlayer.id,
      day: dayCount,
      phase: '决斗',
      cause: duelResult.targetIsWolf ? '决斗（狼人被猎杀）' : '决斗失败（骑士自刎）',
    });
    const updatedPlayers = applyDuelResult(players, duelResult, knight.id);
    setPlayers(updatedPlayers);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查游戏是否结束
    if (checkGameEnd) {
      const gameEndResult = checkGameEnd(updatedPlayers);
      if (gameEndResult) {
        logger.debug(`[骑士决斗] 决斗后游戏结束：${gameEndResult.winner}`);
        return;
      }
    }

    // 根据决斗结果决定下一步
    if (duelResult.targetIsWolf) {
      // 狼人被淘汰：跳过投票，直接进入夜晚
      addLog('狼人被决斗淘汰，跳过投票，直接进入夜晚。', 'system');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSpeakerIndex(-1);
      if (proceedToNextNight) {
        proceedToNextNight(true); // 清空白天数据
      }
    } else {
      // 骑士自刎：继续白天讨论
      addLog('骑士已出局，白天讨论继续。', 'system');
      await new Promise(resolve => setTimeout(resolve, 1500));
      // 继续下一个人发言（跳过已死的骑士）
      moveToNextSpeaker();
    }
  }, [players, setPlayers, dayCount, killPlayer, checkGameEnd, addLog, ROLE_DEFINITIONS, proceedToNextNight, moveToNextSpeaker, gameActiveRef]);

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
              // 柱二：DAY_SPEECH 经分发器闸门（内容合规 + 说话人仍存活）
              const speechSnapshot = buildSnapshot(
                { players, dayCount, nightDecisions: {}, seerChecks: [], speechHistory, voteHistory: [], deathHistory: [] },
                { phase: 'day_discussion', speakerIndex }
              );
              const speechKey = buildActionKey({ day: dayCount, phase: 'day_speech', playerId: currentSpeaker.id, actionType: 'DAY_SPEECH' });
              const speechDispatch = dispatchCommand({
                actionType: 'DAY_SPEECH',
                snapshot: speechSnapshot,
                decision: { speech: res.speech },
                actorId: currentSpeaker.id,
                key: speechKey,
                skipFreshness: true,
                commit: () => {
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
                  // 柱一：幂等原子写入发言（reducer 按 (day, playerId) 去重）
                  recordSpeech({
                    playerId: currentSpeaker.id,
                    name: currentSpeaker.name,
                    content: res.speech,
                    thought: res.thought,
                    identity_table: res.identity_table,
                    day: dayCount,
                    summary: res.summary || res.speech.slice(0, 20),
                    voteIntention: res.voteIntention,
                  });
                  // 柱三：结构化声明事件落盘（replace 正则 NLP）
                  if (Array.isArray(res.claims) && recordClaim) {
                    res.claims.forEach(c => {
                      if (!c || typeof c !== 'object' || !c.type) return;
                      const { type, ...payload } = c;
                      recordClaim({
                        day: dayCount,
                        playerId: currentSpeaker.id,
                        type,
                        payload,
                        timestamp: Date.now(),
                      });
                    });
                  }
                },
              });
              if (!speechDispatch.accepted) {
                logger.warn(`[发言控制] ${currentSpeaker.id}号 发言被分发器拒绝：${speechDispatch.reason}`);
              }
            }

            // 骑士决斗处理
            if (currentSpeaker.role === ROLE_DEFINITIONS.KNIGHT && res.shouldDuel) {
              logger.debug(`[骑士决斗] ${currentSpeaker.id}号骑士决定发动决斗，目标：${res.duelTarget}号`);
              await handleKnightDuel(currentSpeaker, res.duelTarget, res.duelReason, res.confidence);
              return; // 决斗后不再继续正常流程
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
      // 柱二：DAY_SPEECH 经分发器闸门
      const uSpeechSnapshot = buildSnapshot(
        { players, dayCount, nightDecisions: {}, seerChecks: [], speechHistory, voteHistory: [], deathHistory: [] },
        { phase: 'day_discussion' }
      );
      const uSpeechKey = buildActionKey({ day: dayCount, phase: 'day_speech', playerId: userId, actionType: 'DAY_SPEECH' });
      const uSpeechDispatch = dispatchCommand({
        actionType: 'DAY_SPEECH',
        snapshot: uSpeechSnapshot,
        decision: { speech: userInput },
        actorId: userId,
        key: uSpeechKey,
        skipFreshness: true,
        commit: () => {
          addLog(userInput, "chat", "你");
          addCurrentPhaseSpeech({
            playerId: userId,
            name: "你",
            content: userInput,
            day: dayCount,
            timestamp: Date.now()
          });
          spokenIdsRef.current.add(userId);
          // 柱一：幂等原子写入发言
          recordSpeech({
            playerId: userId,
            name: "你",
            content: userInput,
            day: dayCount,
          });
          setUserInput("");
        },
      });
      if (!uSpeechDispatch.accepted) {
        addLog(`发言被系统拒绝：${uSpeechDispatch.reason}`, 'warning');
      }
    } finally {
      speakingLockRef.current = false;
      Promise.resolve().then(() => {
        if (gameActiveRef.current) {
          moveToNextSpeaker();
        }
      });
    }
  }, [userInput, speechHistory, dayCount, userPlayer, addLog, addCurrentPhaseSpeech, recordSpeech, setUserInput, moveToNextSpeaker]);

  /** 用户骑士决斗 */
  const handleUserDuel = useCallback((targetId) => {
    const knight = userPlayer;
    if (!knight) return;

    if (targetId === null) {
      addLog('请选择决斗目标！', 'warning');
      return;
    }

    // 执行决斗
    handleKnightDuel(knight, targetId, '玩家决斗', 100);
  }, [userPlayer, handleKnightDuel, addLog]);

  return { handleUserSpeak, handleUserDuel };
}
