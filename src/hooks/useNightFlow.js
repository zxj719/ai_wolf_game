import { useCallback } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';

/**
 * useNightFlow - 管理夜间阶段的所有逻辑
 * 从 App.jsx 提取以减少主组件复杂度
 */
export function useNightFlow({
  players,
  setPlayers,
  gameMode,
  addLog,
  ROLE_DEFINITIONS,
  setPhase,
  nightStep,
  setNightStep,
  dayCount,
  nightDecisions,
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
  handleAIHunterShoot
}) {
  
  /**
   * 推进夜间流程到下一步
   */
  const proceedNight = useCallback((decisionsOverride = null) => {
    const maxSteps = currentNightSequence.length;
    console.log(`[proceedNight] 当前nightStep=${nightStep}, 将要${nightStep < maxSteps - 1 ? '进入下一步' : '结算夜晚'}`);
    setSelectedTarget(null);
    if (nightStep < maxSteps - 1) {
      console.log(`[proceedNight] nightStep从${nightStep}变为${nightStep + 1}`);
      setNightStep(nightStep + 1);
    } else {
      console.log(`[proceedNight] 开始结算夜晚`);
      resolveNight(decisionsOverride);
    }
  }, [nightStep, currentNightSequence.length, setSelectedTarget, setNightStep]);

  /**
   * 结算夜间所有行动
   */
  const resolveNight = useCallback((decisionsOverride = null) => {
    const { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget } = decisionsOverride || nightDecisions;
    console.log(`[resolveNight] 夜间决策：`, { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget });
    
    let deadIds = [];
    let poisonedIds = [];
    let deathReasons = {};

    // 处理狼人袭击
    if (wolfTarget !== null && !wolfSkipKill) {
      const isGuarded = guardTarget === wolfTarget;
      const isBothGuardedAndSaved = isGuarded && witchSave;
      
      console.log(`[resolveNight] 狼刀${wolfTarget}号，守卫守${guardTarget}号，女巫救${witchSave}，守护=${isGuarded}，同守同救=${isBothGuardedAndSaved}`);
      
      if (isBothGuardedAndSaved) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '同守同救';
        addLog(`[${wolfTarget}号] 触发同守同救规则！`, 'warning');
        console.log(`[resolveNight] ${wolfTarget}号同守同救死亡`);
      } else if (!isGuarded && !witchSave) {
        deadIds.push(wolfTarget);
        deathReasons[wolfTarget] = '被狼人杀害';
        console.log(`[resolveNight] ${wolfTarget}号被狼人杀害`);
      } else {
        console.log(`[resolveNight] ${wolfTarget}号存活（守护=${isGuarded}，女巫救=${witchSave}）`);
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
      
      // 更新女巫的药水状态
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

    if (uniqueDeads.length === 0) {
      addLog("天亮了，昨晚是平安夜。", "success");
      setPhase('day_announce');
      setTimeout(() => {
        startDayDiscussion(updatedPlayers, [], players.length);
      }, 2000);
    } else {
      addLog(`天亮了，昨晚倒牌的玩家：${uniqueDeads.map(id => `[${id}号]`).join(', ')}`, "danger");
      setPhase('day_announce');
      
      // 夜晚死亡无遗言，但猎人可以开枪
      const hunter = uniqueDeads.map(id => updatedPlayers.find(p => p.id === id))
        .find(p => p && p.role === ROLE_DEFINITIONS.HUNTER && p.canHunterShoot);
      
      if (hunter) {
        setTimeout(() => {
          setHunterShooting({ ...hunter, source: 'night' });
          if (hunter.isUser && gameMode !== 'ai-only') {
            setPhase('hunter_shoot');
          } else {
            handleAIHunterShoot(hunter, 'night', uniqueDeads, updatedPlayers);
          }
        }, 2000);
      } else {
        // 夜晚死亡无遗言，直接进入白天讨论
        setTimeout(() => {
          startDayDiscussion(updatedPlayers, uniqueDeads, players.length);
        }, 2000);
      }
    }
  }, [nightDecisions, dayCount, players, deathHistory, setDeathHistory, setPlayers, 
      ROLE_DEFINITIONS, mergeNightDecisions, checkGameEnd, setPhase, addLog, 
      startDayDiscussion, setHunterShooting, gameMode, handleAIHunterShoot]);

  /**
   * 执行守卫AI行动
   */
  const executeGuardAction = useCallback(async (actor) => {
    const cannotGuard = nightDecisions.lastGuardTarget;
    const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_GUARD, { cannotGuard });
    const targetId = res?.targetId;
    if (targetId !== null && players.some(p => p.id === targetId && p.isAlive)) {
      mergeNightDecisions({ guardTarget: targetId });
      setGuardHistory(prev => [...prev, { night: dayCount, targetId }]);
      addLog(`[${actor.id}号] 守卫选择了守护目标。`, 'info');
    } else {
      addLog(`[${actor.id}号] 守卫选择空守。`, 'info');
    }
  }, [askAI, nightDecisions.lastGuardTarget, players, mergeNightDecisions, setGuardHistory, dayCount, addLog]);

  /**
   * 执行狼人AI行动
   */
  const executeWolfAction = useCallback(async (actor) => {
    const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WOLF);
    const targetId = res?.targetId;
    if (targetId !== null && players.some(p => p.id === targetId && p.isAlive && p.role !== '狼人')) {
      mergeNightDecisions({ wolfTarget: targetId });
      addLog(`狼人完成了今夜的行动...`, 'danger');
    } else {
      mergeNightDecisions({ wolfSkipKill: true });
      addLog(`狼人选择空刀。`, 'info');
    }
  }, [askAI, players, mergeNightDecisions, addLog]);

  /**
   * 执行预言家AI行动
   */
  const executeSeerAction = useCallback(async (actor) => {
    const validTargets = players.filter(p => 
      p.isAlive && p.id !== actor.id && 
      !seerChecks.some(c => c.seerId === actor.id && c.targetId === p.id)
    ).map(p => p.id);
    
    if (validTargets.length > 0) {
      const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_SEER, { validTargets });
      const targetId = res?.targetId;
      if (targetId !== undefined && validTargets.includes(targetId)) {
        const target = players.find(p => p.id === targetId);
        const isWolf = target?.role === ROLE_DEFINITIONS.WEREWOLF;
        setSeerChecks(prev => [...prev, { seerId: actor.id, targetId, isWolf, night: dayCount }]);
        mergeNightDecisions({ seerResult: { targetId, isWolf } });
        addLog(`[${actor.id}号] 预言家完成了查验。`, 'info');
      }
    } else {
      addLog(`[${actor.id}号] 预言家已查验所有玩家，本夜空过。`, 'info');
    }
  }, [askAI, players, seerChecks, ROLE_DEFINITIONS, setSeerChecks, mergeNightDecisions, dayCount, addLog]);

  /**
   * 执行女巫AI行动
   */
  const executeWitchAction = useCallback(async (actor) => {
    const dyingId = nightDecisions.wolfTarget;
    const canSave = actor.hasWitchSave && dyingId !== null && dyingId !== actor.id;
    
    const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WITCH, { 
      dyingId, 
      canSave, 
      hasPoison: actor.hasWitchPoison 
    });
    
    if (res?.save && canSave) {
      mergeNightDecisions({ witchSave: true });
      setWitchHistory(prev => ({ ...prev, savedIds: [...prev.savedIds, dyingId] }));
      setPlayers(prev => prev.map(p => p.id === actor.id ? { ...p, hasWitchSave: false } : p));
      addLog(`[${actor.id}号] 女巫使用了解药。`, 'success');
    }
    
    if (res?.poison !== null && res?.poison !== undefined && actor.hasWitchPoison) {
      const poisonTarget = res.poison;
      if (players.some(p => p.id === poisonTarget && p.isAlive && p.id !== actor.id)) {
        mergeNightDecisions({ witchPoison: poisonTarget });
        setWitchHistory(prev => ({ ...prev, poisonedIds: [...prev.poisonedIds, poisonTarget] }));
        setPlayers(prev => prev.map(p => p.id === actor.id ? { ...p, hasWitchPoison: false } : p));
        addLog(`[${actor.id}号] 女巫使用了毒药。`, 'danger');
      }
    }
  }, [askAI, nightDecisions.wolfTarget, players, mergeNightDecisions, setWitchHistory, setPlayers, addLog]);

  return {
    proceedNight,
    resolveNight,
    executeGuardAction,
    executeWolfAction,
    executeSeerAction,
    executeWitchAction
  };
}
