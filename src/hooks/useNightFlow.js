import { useEffect, useCallback, useRef } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';
import { logger } from '../utils/logger';
import { TIMING } from '../config/constants';

/**
 * useNightFlow - 管理夜间阶段的所有逻辑
 * 包含：proceedNight、resolveNight、executeNightAction useEffect
 */
export function useNightFlow({
  players,
  setPlayers,
  gameMode,
  addLog,
  addCurrentPhaseAction,
  updateActionResult,
  ROLE_DEFINITIONS,
  setPhase,
  phase,
  nightStep,
  setNightStep,
  dayCount,
  nightDecisions,
  nightDecisionsRef,
  mergeNightDecisions,
  seerChecks,
  setSeerChecks,
  guardHistory,
  setGuardHistory,
  witchHistory,
  setWitchHistory,
  deathHistory,
  setDeathHistory,
  selectedTarget,
  setSelectedTarget,
  setHunterShooting,
  checkGameEnd,
  askAI,
  setIsThinking,
  currentNightSequence,
  startDayDiscussion,
  handleAIHunterShoot,
  userPlayer,
  gameActiveRef,
}) {

  // --- proceedNight ---
  const proceedNight = useCallback((decisionsOverride = null) => {
    if (!gameActiveRef.current) return;
    const maxSteps = currentNightSequence.length;
    logger.debug(`[proceedNight] 当前nightStep=${nightStep}, 将要${nightStep < maxSteps - 1 ? '进入下一步' : '结算夜晚'}`);
    setSelectedTarget(null);
    if (nightStep < maxSteps - 1) {
      logger.debug(`[proceedNight] nightStep从${nightStep}变为${nightStep + 1}`);
      setNightStep(nightStep + 1);
    } else {
      logger.debug(`[proceedNight] 开始结算夜晚`);
      resolveNight(decisionsOverride);
    }
  }, [nightStep, currentNightSequence.length]);

  // --- isGoodMajority (local helper) ---
  const isGoodMajority = (currentPlayers) => {
    const aliveWolves = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.WEREWOLF).length;
    const aliveGood = currentPlayers.filter(p => p.isAlive && p.role !== ROLE_DEFINITIONS.WEREWOLF).length;
    return aliveGood > aliveWolves;
  };

  // --- resolveNight ---
  const resolveNight = useCallback((decisionsOverride = null) => {
    if (!gameActiveRef.current) return;
    const { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget } = decisionsOverride || nightDecisionsRef.current || nightDecisions;
    logger.debug(`[resolveNight] 夜间决策：`, { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget });

    let deadIds = [];
    let poisonedIds = [];
    let deathReasons = {};

    // 处理狼人袭击
    if (wolfTarget !== null && !wolfSkipKill) {
      const isGuarded = guardTarget === wolfTarget;
      const isBothGuardedAndSaved = isGuarded && witchSave;

      logger.debug(`[resolveNight] 狼刀${wolfTarget}号，守卫守${guardTarget}号，女巫救${witchSave}，守护=${isGuarded}，同守同救=${isBothGuardedAndSaved}`);

      if (isBothGuardedAndSaved) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '同守同救';
        addLog(`[${wolfTarget}号] 触发同守同救规则！`, 'warning');
        logger.debug(`[resolveNight] ${wolfTarget}号同守同救死亡`);
        updateActionResult(dayCount, '袭击', null, 'success', '同守同救');
      } else if (!isGuarded && !witchSave) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '被狼人杀害';
        logger.debug(`[resolveNight] ${wolfTarget}号被狼人杀害`);
        updateActionResult(dayCount, '袭击', null, 'success', '击杀成功');
      } else {
        logger.debug(`[resolveNight] ${wolfTarget}号存活（守护=${isGuarded}，女巫救=${witchSave}）`);
        const savedBy = isGuarded ? '被守护' : '被女巫救';
        updateActionResult(dayCount, '袭击', null, 'failed', savedBy);
      }
    }

    // 处理毒药
    if (witchPoison !== null) {
      if (!deadIds.includes(witchPoison)) {
        deadIds.push(witchPoison);
      }
      poisonedIds.push(witchPoison);
      deathReasons[witchPoison] = '被女巫毒死';
    }

    const uniqueDeads = [...new Set(deadIds)];

    // 记录死亡历史
    const deathRecords = uniqueDeads.map(id => ({
      day: dayCount,
      phase: '夜',
      playerId: id,
      cause: deathReasons[id] || '死亡'
    }));
    setDeathHistory([...deathHistory, ...deathRecords]);

    // 更新玩家状态
    let updatedPlayers = players.map(p => {
      let newP = { ...p };

      if (p.role === ROLE_DEFINITIONS.WITCH) {
        if (witchSave) newP.hasWitchSave = false;
        if (witchPoison !== null) newP.hasWitchPoison = false;
      }

      if (uniqueDeads.includes(p.id)) {
        const wasPoisoned = poisonedIds.includes(p.id);
        newP.isAlive = false;
        newP.isPoisoned = wasPoisoned;
        newP.canHunterShoot = !wasPoisoned;
      }
      return newP;
    });

    setPlayers(updatedPlayers);

    // 更新守卫的上一夜守护目标
    mergeNightDecisions({
      lastGuardTarget: guardTarget,
      wolfTarget: null,
      wolfSkipKill: false,
      witchSave: false,
      witchPoison: null,
      guardTarget: null,
      seerResult: null
    });

    // 检查游戏是否结束
    if (checkGameEnd(updatedPlayers)) {
      setPhase('game_over');
      return;
    }

    // 处理猎人开枪逻辑
    const handleHunterOrDay = (currentPlayers, nightDeads) => {
      const hunter = nightDeads.map(id => currentPlayers.find(p => p.id === id))
        .find(p => p && p.role === ROLE_DEFINITIONS.HUNTER && p.canHunterShoot);

      if (hunter) {
        setTimeout(() => {
          setHunterShooting({ ...hunter, source: 'night' });
          if (hunter.isUser && gameMode !== 'ai-only') {
            setPhase('hunter_shoot');
          } else {
            handleAIHunterShoot(hunter, 'night', nightDeads, currentPlayers);
          }
        }, TIMING.DAY_TRANSITION_DELAY);
      } else {
        setTimeout(() => {
          startDayDiscussion(currentPlayers, nightDeads, players.length);
        }, TIMING.DAY_TRANSITION_DELAY);
      }
    };

    if (uniqueDeads.length === 0) {
      addLog("天亮了，昨晚是平安夜。", "success");
      setPhase('day_announce');
      setTimeout(() => {
        startDayDiscussion(updatedPlayers, [], players.length);
      }, TIMING.DAY_TRANSITION_DELAY);
    } else {
      addLog(`天亮了，昨晚倒牌的玩家：${uniqueDeads.map(id => `[${id}号]`).join(', ')}`, "danger");
      setPhase('day_announce');
      handleHunterOrDay(updatedPlayers, uniqueDeads);
    }
  }, [nightDecisions, dayCount, players, deathHistory]);

  // --- executeNightAction useEffect ---
  useEffect(() => {
    if (phase !== 'night') return;

    const executeNightAction = async () => {
      if (!gameActiveRef.current) return;
      const roleOrder = currentNightSequence;
      const currentRoleKey = roleOrder[nightStep];

      logger.debug(`[夜间行动] nightStep=${nightStep}, dayCount=${dayCount}, 当前角色=${ROLE_DEFINITIONS[currentRoleKey] || '未知'}`);
      logger.debug(`[夜间行动] 当前 nightDecisions:`, nightDecisions);

      // 如果nightStep超出范围，直接跳过
      if (!currentRoleKey) {
        logger.debug('[夜间行动] nightStep超出范围，跳过');
        setTimeout(() => {
          if (!gameActiveRef.current) return;
          proceedNight();
        }, TIMING.SKIP_DELAY);
        return;
      }

      const actor = players.find(p => p.role === ROLE_DEFINITIONS[currentRoleKey] && p.isAlive);

      // 如果该角色已全员阵亡，自动跳过
      if (!actor) {
        logger.debug(`[夜间行动] 没有找到存活的${ROLE_DEFINITIONS[currentRoleKey]}`);
        if (gameMode === 'ai-only') {
          addLog(`由于场上没有存活的${ROLE_DEFINITIONS[currentRoleKey]}，直接跳过。`, 'system');
        }
        setTimeout(() => {
          if (!gameActiveRef.current) return;
          proceedNight();
        }, TIMING.NIGHT_ACTION_DELAY);
        return;
      }

      logger.debug(`[夜间行动] 找到角色：${actor.id}号 ${actor.name}，是否用户：${actor.isUser}`);

      // 如果是存活的用户且非全AI模式，等待交互
      if (actor.isUser && actor.isAlive && gameMode !== 'ai-only') {
        if (actor.role === ROLE_DEFINITIONS.WEREWOLF && currentRoleKey === 'WEREWOLF' && nightDecisions.wolfTarget !== null) {
          logger.debug(`[夜间行动] 狼人队友已选择，用户 ${actor.id} 无需行动`);
          setTimeout(() => {
            if (!gameActiveRef.current) return;
            proceedNight();
          }, TIMING.SKIP_DELAY);
          return;
        }
        logger.debug(`[夜间行动] 等待用户操作`);
        return;
      }

      // --- 各角色 AI 行动 ---
      if (currentRoleKey === 'GUARD') {
        const cannotGuard = nightDecisions.lastGuardTarget;
        logger.debug(`[守卫AI] 开始守卫决策，存活玩家：${players.filter(p => p.isAlive).map(p => p.id).join(',')}`);
        const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_GUARD, { cannotGuard });
        logger.debug(`[守卫AI] AI返回结果：`, res);

        if (res && (res.targetId === null || (res.targetId !== cannotGuard && (players.find(p => p.id === res.targetId)?.isAlive)))) {
          if (res.targetId !== null) {
            logger.debug(`[守卫AI] 守护目标：${res.targetId}号`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 守卫守护了 ${res.targetId}号`, 'system');
            }
            addCurrentPhaseAction({
              playerId: actor.id,
              type: '守护',
              target: res.targetId,
              night: dayCount,
              thought: res.thought,
              description: `守护了 ${res.targetId}号`,
              timestamp: Date.now()
            });
            mergeNightDecisions({ guardTarget: res.targetId });
            setGuardHistory([...guardHistory, { night: dayCount, targetId: res.targetId, thought: res.thought }]);
          } else {
            logger.debug(`[守卫AI] 选择空守`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 守卫选择空守`, 'system');
            }
            mergeNightDecisions({ guardTarget: null });
          }
        } else {
          logger.debug(`[守卫AI] AI决策无效或被过滤，强制空守`);
          mergeNightDecisions({ guardTarget: null });
        }
      }
      else if (currentRoleKey === 'WEREWOLF') {
        const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id);
        logger.debug(`[狼人AI] 开始狼人决策，可选目标：${validTargets.join(',')}`);
        const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WOLF);
        logger.debug(`[狼人AI] AI返回结果：`, res);

        if (res && validTargets.includes(res.targetId)) {
          logger.debug(`[狼人AI] 狼人袭击目标：${res.targetId}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 狼人选择袭击 ${res.targetId}号`, 'system');
          }
          addCurrentPhaseAction({
            playerId: actor.id,
            type: '袭击',
            target: res.targetId,
            night: dayCount,
            thought: res.thought,
            description: `袭击 ${res.targetId}号`,
            timestamp: Date.now()
          });
          mergeNightDecisions({ wolfTarget: res.targetId, wolfSkipKill: false });
        } else {
          logger.debug(`[狼人AI] AI决策无效，尝试随机选择目标`);
          if (validTargets.length > 0) {
            const fallbackTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
            logger.debug(`[狼人AI] 随机选择袭击目标：${fallbackTarget}号`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 狼人选择袭击 ${fallbackTarget}号`, 'system');
            }
            addCurrentPhaseAction({
              playerId: actor.id,
              type: '袭击',
              target: fallbackTarget,
              night: dayCount,
              thought: res?.thought,
              description: `袭击 ${fallbackTarget}号 (随机)`,
              timestamp: Date.now()
            });
            mergeNightDecisions({ wolfTarget: fallbackTarget, wolfSkipKill: false });
          } else {
            logger.error(`[狼人AI] 错误：没有可袭击目标，这不应该发生！`);
          }
        }
      }
      else if (currentRoleKey === 'SEER') {
        const checkedIds = seerChecks.filter(c => c.seerId === actor.id).map(c => c.targetId);
        const validTargets = players.filter(p => p.isAlive && p.id !== actor.id && !checkedIds.includes(p.id)).map(p => p.id);
        logger.debug(`[预言家AI] 已查验：${checkedIds.join(',') || '无'}，可验：${validTargets.join(',')}`);

        if (validTargets.length === 0) {
          logger.debug(`[预言家AI] 所有目标已验完`);
          addLog(`预言家已验完所有目标。`, 'system');
        } else {
          logger.debug(`[预言家AI] 开始查验决策`);
          const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_SEER, { validTargets });
          logger.debug(`[预言家AI] AI返回结果：`, res);

          if (res?.targetId !== undefined && validTargets.includes(res.targetId)) {
            const targetPlayer = players.find(p => p.id === res.targetId);
            if (targetPlayer) {
              const isWolf = targetPlayer.role === ROLE_DEFINITIONS.WEREWOLF;
              logger.debug(`[预言家AI] 查验${res.targetId}号，结果：${isWolf ? '狼人' : '好人'}`);
              if (gameMode === 'ai-only') {
                addLog(`[${actor.id}号] 预言家查验了 ${res.targetId}号，结果是${isWolf ? '狼人' : '好人'}`, 'system');
              }
              addCurrentPhaseAction({
                playerId: actor.id,
                type: '查验',
                target: res.targetId,
                result: isWolf ? '狼人' : '好人',
                night: dayCount,
                thought: res.thought,
                description: `查验 ${res.targetId}号，结果是${isWolf ? '狼人' : '好人'}`,
                timestamp: Date.now()
              });
              mergeNightDecisions({ seerResult: { targetId: res.targetId, isWolf } });
              setSeerChecks(prev => [...prev, { night: dayCount, targetId: res.targetId, isWolf, seerId: actor.id, thought: res.thought }]);
            } else {
              logger.error(`[预言家AI] 无法找到目标玩家 ${res.targetId}`);
            }
          } else {
            logger.debug(`[预言家AI] AI决策无效或被过滤:`, res);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 预言家放弃查验`, 'system');
            }
          }
        }
      }
      else if (currentRoleKey === 'WITCH') {
        const dyingId = nightDecisions.wolfTarget;
        const canSave = actor.hasWitchSave && dyingId !== null && (dyingId !== actor.id || dayCount === 1);
        const validPoisonTargets = players.filter(p => p.isAlive && p.id !== dyingId).map(p => p.id);

        logger.debug(`[女巫AI] 开始女巫决策，被刀：${dyingId}，解药：${canSave}，毒药：${actor.hasWitchPoison}`);
        const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WITCH, {
          dyingId,
          canSave,
          hasPoison: actor.hasWitchPoison,
          witchId: actor.id
        });
        logger.debug(`[女巫AI] AI返回结果：`, res);

        // 构建完整的夜间决策对象
        const finalDecisions = { ...nightDecisions };

        if (res) {
          if (res.useSave && canSave) {
            logger.debug(`[女巫AI] 使用解药救${dyingId}号`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 女巫使用解药救了 ${dyingId}号`, 'system');
            }
            addCurrentPhaseAction({
              playerId: actor.id,
              type: '解药',
              target: dyingId,
              night: dayCount,
              thought: res.thought,
              description: `使用解药救了 ${dyingId}号`,
              timestamp: Date.now()
            });
            finalDecisions.witchSave = true;
            mergeNightDecisions({ witchSave: true });
            setWitchHistory(prev => ({ ...prev, savedIds: [...prev.savedIds, dyingId] }));
          } else if (res.usePoison !== null && actor.hasWitchPoison && !res.useSave && validPoisonTargets.includes(res.usePoison)) {
            logger.debug(`[女巫AI] 使用毒药毒${res.usePoison}号`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 女巫使用毒药毒了 ${res.usePoison}号`, 'system');
            }
            addCurrentPhaseAction({
              playerId: actor.id,
              type: '毒药',
              target: res.usePoison,
              night: dayCount,
              thought: res.thought,
              description: `使用毒药毒了 ${res.usePoison}号`,
              timestamp: Date.now()
            });
            finalDecisions.witchPoison = res.usePoison;
            mergeNightDecisions({ witchPoison: res.usePoison });
            setWitchHistory(prev => ({ ...prev, poisonedIds: [...prev.poisonedIds, res.usePoison] }));
          } else {
            logger.debug(`[女巫AI] 不使用药水`);
            if (gameMode === 'ai-only') {
              addLog(`[${actor.id}号] 女巫选择不使用药水`, 'system');
            }
          }
        } else {
          logger.debug(`[女巫AI] AI决策失败`);
        }

        // 女巫是最后一步，传递完整的决策对象
        logger.debug(`[女巫AI] 最终决策：`, finalDecisions);
        setTimeout(() => proceedNight(finalDecisions), TIMING.NIGHT_ACTION_DELAY);
        return; // 直接返回，不要继续执行后面的 setTimeout
      }

      logger.debug(`[夜间行动] ${ROLE_DEFINITIONS[currentRoleKey]}行动完成，1.5秒后进入下一步`);
      setTimeout(() => {
        if (!gameActiveRef.current) return;
        proceedNight();
      }, TIMING.NIGHT_ACTION_DELAY);
    };

    executeNightAction();
  }, [phase, nightStep]);

  return {
    proceedNight,
    resolveNight,
  };
}
