import { useCallback } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';
import { TIMING } from '../config/constants';

export function useDayFlow({
  players,
  setPlayers,
  gameMode,
  addLog,
  addCurrentPhaseAction,
  ROLE_DEFINITIONS,
  setPhase,
  setNightStep,
  nightDecisions,
  mergeNightDecisions,
  dayCount,
  setDayCount,
  seerChecks,
  speechHistory,
  setSpeechHistory,
  voteHistory,
  setVoteHistory,
  deathHistory,
  setDeathHistory,
  setHunterShooting,
  selectedTarget,
  setSelectedTarget,
  speakerIndex,
  setSpeakerIndex,
  speakingOrder,
  setSpeakingOrder,
  spokenCount,
  setSpokenCount,
  userPlayer,
  isThinking,
  setIsThinking,
  checkGameEnd,
  askAI,
  clearCurrentPhaseData,
  proceedToNextNightExternal, // optional override from night flow
  gameActiveRef
}) {
  const proceedToNextNight = useCallback((clearPhaseData) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    // 清空白天的发言数据
    if (clearPhaseData) {
      clearPhaseData();
    }
    // 重置 nightDecisions，但保留 lastGuardTarget（用于守卫连守限制）
    mergeNightDecisions({
      wolfTarget: null,
      wolfSkipKill: false,
      witchSave: false,
      witchPoison: null,
      guardTarget: null,
      seerResult: null,
      // 保留 lastGuardTarget，它在 resolveNight 中已被正确设置
    });
    setDayCount(dayCount + 1);
    setPhase('night');
    setNightStep(0);
    addLog(`进入第 ${dayCount + 1} 夜...`, 'system');
  }, [addLog, dayCount, gameActiveRef, mergeNightDecisions, setDayCount, setNightStep, setPhase]);

  const moveToNextSpeaker = useCallback(() => {
    if (gameActiveRef && !gameActiveRef.current) return;
    const alivePlayers = players.filter(p => p.isAlive);
    const newSpokenCount = spokenCount + 1;
    
    console.log(`[moveToNextSpeaker] 当前已发言: ${spokenCount}, 存活玩家: ${alivePlayers.length}`);
    
    // 检查实际发言历史与计数是否匹配
    const actualSpokenCount = speechHistory.filter(s => s.day === dayCount).length;
    const effectiveCount = Math.max(newSpokenCount, actualSpokenCount);
    
    setSpokenCount(effectiveCount);

    if (effectiveCount >= alivePlayers.length) {
      console.log(`[moveToNextSpeaker] 全员发言完毕，进入投票阶段`);
      setSpeakerIndex(-1);
      setPhase('day_voting');
      addLog('全员发言结束，进入放逐投票阶段。', 'system');
    } else {
      const direction = speakingOrder === 'right' ? -1 : 1;
      setSpeakerIndex(prev => {
        let next = prev + direction;
        if (next < 0) next = alivePlayers.length - 1;
        if (next >= alivePlayers.length) next = 0;
        
        // 跳过已经发言过的玩家
        let attempts = 0;
        while (attempts < alivePlayers.length) {
          const nextPlayer = alivePlayers[next];
          if (nextPlayer && !speechHistory.some(s => s.day === dayCount && s.playerId === nextPlayer.id)) {
            console.log(`[moveToNextSpeaker] 下一个发言: ${next}号 (${nextPlayer.id}号)`);
            return next;
          }
          next = next + direction;
          if (next < 0) next = alivePlayers.length - 1;
          if (next >= alivePlayers.length) next = 0;
          attempts++;
        }
        
        // 如果所有人都发言了，进入投票
        console.log(`[moveToNextSpeaker] 所有人都已发言，进入投票`);
        setSpeakerIndex(-1);
        setPhase('day_voting');
        addLog('全员发言结束，进入放逐投票阶段。', 'system');
        return -1;
      });
    }
  }, [addLog, dayCount, gameActiveRef, players, speakingOrder, speechHistory, spokenCount, setPhase, setSpeakerIndex, setSpokenCount]);

  const startDayDiscussion = useCallback((currentPlayers, nightDeads = [], TOTAL_PLAYERS, clearPhaseData) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    // 清空夜晚的行动数据
    if (clearPhaseData) {
      clearPhaseData();
    }
    setPhase('day_discussion');
    const alivePlayers = (currentPlayers || players).filter(p => p.isAlive);
    const aliveIds = alivePlayers.map(p => p.id).sort((a,b)=>a-b);

    if (nightDeads.length > 0) {
      const deadId = Math.max(...nightDeads);
      let startId = -1;
      for (let i = 1; i <= TOTAL_PLAYERS; i++) {
        const check = (deadId + i) % TOTAL_PLAYERS;
        if (aliveIds.includes(check)) {
          startId = check;
          break;
        }
      }
      const startIndexInAlive = alivePlayers.findIndex(p => p.id === startId);
      setSpeakerIndex(startIndexInAlive);
      addLog(`昨晚${deadId}号死亡，从${startId}号开始发言。`, 'system');
    } else {
      const randomStartPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const startIndexInAlive = alivePlayers.findIndex(p => p.id === randomStartPlayer.id);
      setSpeakerIndex(startIndexInAlive);
      addLog(`平安夜，随机从${randomStartPlayer.id}号开始发言。`, 'system');
    }
    setSpokenCount(0);
  }, [addLog, gameActiveRef, players, setPhase, setSpeakerIndex, setSpokenCount]);

  // 任务1：支持连锁开枪的猎人AI开枪函数
  // chainDepth: 连锁深度，防止无限循环（最大3层）
  const handleAIHunterShoot = useCallback(async (hunter, source, nightDeads = [], currentPlayersState = null, chainDepth = 0, flowSource = null) => {
    if (gameActiveRef && !gameActiveRef.current) {
      setHunterShooting(null);
      return;
    }
    const normalizedSource = typeof source === 'string' ? source : null;
    const normalizedFlowSource = typeof flowSource === 'string' ? flowSource : normalizedSource;

    let currentPlayers = currentPlayersState ? [...currentPlayersState] : [...players];

    // 防止无限连锁（最大3层）
    if (chainDepth > 3) {
      addLog(`连锁开枪达到上限，停止。`, 'warning');
      setHunterShooting(null);

      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }

      if (normalizedFlowSource === 'vote') {
        (proceedToNextNightExternal || proceedToNextNight)();
      } else {
        startDayDiscussion(currentPlayers, nightDeads, players.length, clearCurrentPhaseData);
      }
      return;
    }

    setIsThinking(true);
    const aliveTargets = currentPlayers.filter(p => p.isAlive && p.id !== hunter.id).map(p => p.id);

    // 构建猎人上下文：查杀信息、发言摘要等帮助猎人决策
    let hunterContext = '';

    // 查杀信息（预言家查出的狼人）
    const wolfChecks = seerChecks.filter(c => c.isWolf && aliveTargets.includes(c.targetId));
    if (wolfChecks.length > 0) {
      hunterContext += `【查杀】${wolfChecks.map(c => `${c.targetId}号`).join(',')}被预言家查杀\n`;
    }

    // 金水信息（预言家验证的好人）
    const goodChecks = seerChecks.filter(c => !c.isWolf && aliveTargets.includes(c.targetId));
    if (goodChecks.length > 0) {
      hunterContext += `【金水】${goodChecks.map(c => `${c.targetId}号`).join(',')}是好人(勿带走)\n`;
    }

    // 最近发言摘要
    const recentSpeeches = speechHistory.filter(s => s.day === dayCount).map(s =>
      `${s.playerId}号:${s.summary || s.content.slice(0, 30)}`
    ).join(';');
    if (recentSpeeches) {
      hunterContext += `【今日发言】${recentSpeeches}\n`;
    }

    const res = await askAI(hunter, PROMPT_ACTIONS.HUNTER_SHOOT, { aliveTargets, hunterContext });
    if (gameActiveRef && !gameActiveRef.current) {
      setIsThinking(false);
      return;
    }
    setIsThinking(false);

    let targetPlayer = null;
    let targetId = null;

    // 猎人必须开枪（除非没有可开枪目标）
    if (res?.targetId !== null && aliveTargets.includes(res.targetId)) {
      targetId = res.targetId;
    } else if (aliveTargets.length > 0) {
      // AI决策无效时，随机选择一个目标（猎人必须开枪）
      targetId = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      console.log(`[猎人AI] AI决策无效，随机选择开枪目标：${targetId}号`);
    }

    if (targetId !== null) {
      const reason = res?.reason ? `(${res.reason})` : '';
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人！开枪带走了 [${targetId}号]！${reason}`, 'danger');

      addCurrentPhaseAction({
        playerId: hunter.id,
        type: '猎人开枪',
        target: targetId,
        day: dayCount,
        source: normalizedSource,
        thought: res?.thought,
        description: `猎人开枪带走 ${targetId}号${res?.reason ? `（${res.reason}）` : ''}`,
        timestamp: Date.now(),
        persist: true
      });

      // 找到被带走的玩家
      targetPlayer = currentPlayers.find(p => p.id === targetId);

      // 使用函数式更新，确保基于最新状态（避免覆盖夜间死亡的玩家状态）
      setPlayers(prev => {
        const updated = prev.map(p => p.id === targetId ? { ...p, isAlive: false } : p);
        // 同步更新局部变量，用于后续的 checkGameEnd 等逻辑
        currentPlayers = updated;
        return updated;
      });
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: targetId, cause: '被猎人带走' }]);
    } else {
      // 理论上不应该发生 - 必须有可开枪目标
      console.error(`[猎人AI] 错误：没有可开枪目标！`);
    }

    // 任务1：检查连锁开枪 - 被带走的玩家如果也是猎人且能开枪
    if (targetPlayer && targetPlayer.role === ROLE_DEFINITIONS.HUNTER && targetPlayer.canHunterShoot) {
      if (chainDepth >= 3) {
        addLog(`连锁开枪达到上限，跳过后续连锁。`, 'warning');
      } else {
      addLog(`[${targetPlayer.id}号] ${targetPlayer.name} 也是猎人！触发连锁开枪！`, 'warning');
      setTimeout(() => {
        if (gameActiveRef && !gameActiveRef.current) return;
        // 如果连锁猎人是用户玩家，则进入用户选择阶段
        if (targetPlayer.isUser && gameMode !== 'ai-only') {
          setHunterShooting({
            ...targetPlayer,
            source: 'chain',
            flowSource: normalizedFlowSource,
            nightDeads,
            chainDepth: chainDepth + 1
          });
          setPhase('hunter_shoot');
          return;
        }

        setHunterShooting({ ...targetPlayer, source: 'chain', chainDepth: chainDepth + 1 });
        // 递归调用，增加连锁深度，并保留最终流程来源（夜晚/投票）
        handleAIHunterShoot(targetPlayer, 'chain', nightDeads, currentPlayers, chainDepth + 1, normalizedFlowSource);
      }, TIMING.NIGHT_ACTION_DELAY);
      return; // 不继续后续流程，等待连锁完成
      }
    }

    setTimeout(() => {
      if (gameActiveRef && !gameActiveRef.current) return;
      setHunterShooting(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      if (normalizedFlowSource === 'vote') {
        (proceedToNextNightExternal || proceedToNextNight)();
      } else {
        startDayDiscussion(currentPlayers, nightDeads, players.length, clearCurrentPhaseData);
      }
    }, TIMING.DAY_TRANSITION_DELAY);
  }, [addCurrentPhaseAction, addLog, askAI, checkGameEnd, clearCurrentPhaseData, dayCount, gameActiveRef, gameMode, players, proceedToNextNightExternal, ROLE_DEFINITIONS, seerChecks, setDeathHistory, setHunterShooting, setIsThinking, setPhase, setPlayers, speechHistory, startDayDiscussion]);

  const handleUserHunterShoot = useCallback((source, nightDeads = [], flowSource = null, chainDepth = 0) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    let currentPlayers = [...players];
    const aliveTargets = currentPlayers.filter(p => p.isAlive && p.id !== userPlayer.id);
    const normalizedSource = typeof source === 'string' ? source : null;
    const normalizedFlowSource = typeof flowSource === 'string' ? flowSource : normalizedSource;

    // 猎人必须开枪（除非没有目标）
    if (selectedTarget === null || !aliveTargets.some(p => p.id === selectedTarget)) {
      if (aliveTargets.length > 0) {
        addLog(`猎人必须选择一个目标开枪！`, 'warning');
        return; // 不继续，强制用户选择
      }
      // 没有可选目标时才允许不开枪
      console.error(`[猎人] 没有可开枪目标！`);
    } else {
      addLog(`你是猎人！开枪带走了 [${selectedTarget}号]！`, 'danger');

      addCurrentPhaseAction({
        playerId: userPlayer.id,
        type: '猎人开枪',
        target: selectedTarget,
        day: dayCount,
        source: normalizedSource,
        description: `猎人开枪带走 ${selectedTarget}号`,
        timestamp: Date.now(),
        persist: true
      });

      const targetPlayer = currentPlayers.find(p => p.id === selectedTarget);

      // 使用函数式更新，确保基于最新状态
      setPlayers(prev => {
        const updated = prev.map(p => p.id === selectedTarget ? { ...p, isAlive: false } : p);
        currentPlayers = updated;
        return updated;
      });
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: selectedTarget, cause: '被猎人带走' }]);

      // 连锁开枪：带走的玩家如果也是猎人且能开枪
      if (
        targetPlayer
        && targetPlayer.role === ROLE_DEFINITIONS.HUNTER
        && targetPlayer.canHunterShoot
        && chainDepth < 3
      ) {
        addLog(`[${targetPlayer.id}号] ${targetPlayer.name} 也是猎人！触发连锁开枪！`, 'warning');
        setTimeout(() => {
          if (gameActiveRef && !gameActiveRef.current) return;
          setSelectedTarget(null);

          // 用户是唯一玩家：若连锁猎人是用户，则继续等待用户操作；否则交给AI
          if (targetPlayer.isUser && gameMode !== 'ai-only') {
            setHunterShooting({
              ...targetPlayer,
              source: 'chain',
              flowSource: normalizedFlowSource,
              nightDeads,
              chainDepth: chainDepth + 1
            });
            setPhase('hunter_shoot');
            return;
          }

          // AI 连锁开枪：进入结算态，避免白天流程提前推进
          setPhase('day_resolution');
          handleAIHunterShoot(targetPlayer, 'chain', nightDeads, currentPlayers, chainDepth + 1, normalizedFlowSource);
        }, TIMING.NIGHT_ACTION_DELAY);
        return;
      }
    }

    setTimeout(() => {
      if (gameActiveRef && !gameActiveRef.current) return;
      setHunterShooting(null);
      setSelectedTarget(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      if (normalizedFlowSource === 'vote') {
        (proceedToNextNightExternal || proceedToNextNight)();
      } else {
        startDayDiscussion(currentPlayers, nightDeads, players.length, clearCurrentPhaseData);
      }
    }, TIMING.DAY_TRANSITION_DELAY);
  }, [addCurrentPhaseAction, addLog, checkGameEnd, clearCurrentPhaseData, dayCount, gameActiveRef, gameMode, handleAIHunterShoot, players, proceedToNextNightExternal, ROLE_DEFINITIONS.HUNTER, selectedTarget, setDeathHistory, setHunterShooting, setPhase, setPlayers, setSelectedTarget, startDayDiscussion, userPlayer]);

  const handleAutoVote = useCallback(async () => {
    if (gameActiveRef && !gameActiveRef.current) return;
    setIsThinking(true);
    const alive = players.filter(p => p.isAlive);
    const aliveIds = alive.map(p => p.id);
    const deadIds = players.filter(p => !p.isAlive).map(p => p.id);

    // 并行投票：所有AI同时做决策
    const votePromises = alive.map(async (p) => {
      let targetId = null;
      let reasoning = '';
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);

      // 优先使用发言意向
      if (mySpeech && mySpeech.voteIntention !== undefined && aliveIds.includes(mySpeech.voteIntention)) {
        targetId = mySpeech.voteIntention;
        reasoning = '遵循发言意向';
      } else {
        // 需要AI决策
        let seerConstraint = '';
        if (p.role === '预言家') {
          const myChecks = seerChecks.filter(c => c.seerId === p.id);
          const goodPeople = myChecks.filter(c => !c.isWolf).map(c => c.targetId);
          if (goodPeople.length > 0) {
            seerConstraint = `\n【预言家约束】你查验过以下玩家是好人：${goodPeople.join(',')}号。【严禁投票给你验证为好人的玩家！】除非有极强的反逻辑证据。`;
          }
        }

        const validVoteTargets = aliveIds.filter(id => id !== p.id);
        const res = await askAI(p, PROMPT_ACTIONS.DAY_VOTE, { validTargets: validVoteTargets, seerConstraint });
        targetId = res?.targetId;
        reasoning = res?.reasoning || '';
      }

      // 构建投票对象
      if (targetId !== undefined && aliveIds.includes(targetId)) {
        return { voterId: p.id, voterName: p.name, targetId, reasoning };
      } else if (targetId !== undefined) {
        const fallback = aliveIds.filter(id => id !== p.id)[0] || aliveIds[0];
        return { voterId: p.id, voterName: p.name, targetId: fallback, reasoning: reasoning || '备用选择' };
      }
      return null;
    });

    // 等待所有投票完成
    const voteResults = await Promise.all(votePromises);
    const votes = voteResults.filter(v => v !== null);

    processVoteResults(votes, aliveIds);
  }, [askAI, dayCount, gameActiveRef, players, seerChecks, setIsThinking, speechHistory]);

  const processVoteResults = useCallback((votes, aliveIds) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    const counts = votes.reduce((acc, v) => {
      acc[v.targetId] = (acc[v.targetId] || 0) + 1;
      return acc;
    }, {});

    addLog('--- 投票记录 ---', 'system');
    votes.forEach(v => {
      const reasonText = v.reasoning ? ` (${v.reasoning})` : '';
      addLog(`[${v.voterId}号] 投给 -> [${v.targetId}号]${reasonText}`, 'info');
    });

    if (Object.keys(counts).length === 0) {
      addLog('无人投票，平安日。', 'info');
      setVoteHistory([...voteHistory, { day: dayCount, votes: [], eliminated: null }]);
      setIsThinking(false);
      setSelectedTarget(null);
      const result = checkGameEnd();
      if (result) {
        setPhase('game_over');
      } else {
        proceedToNextNight();
      }
      return;
    }

    const maxVotes = Math.max(...Object.values(counts));
    const topCandidates = Object.keys(counts).filter(id => parseInt(counts[id]) === maxVotes); // Ensure numeric comparison
    let outPlayer;
    if (topCandidates.length > 1) {
      addLog(`平票！[${topCandidates.join('号]和[')}号] 各获得 ${maxVotes} 票，PK后随机出局。`, 'warning');
      const outId = topCandidates[Math.floor(Math.random() * topCandidates.length)];
      outPlayer = players.find(p => p.id === parseInt(outId, 10));
    } else {
      outPlayer = players.find(p => p.id === parseInt(topCandidates[0], 10));
    }

    if (!outPlayer) {
      addLog('系统错误：无法确定出局玩家', 'error');
      setIsThinking(false);
      setSelectedTarget(null);
      return;
    }

    addLog(`[${outPlayer.id}号] ${outPlayer.name} 被公投出局。`, 'danger');
    const updatedVoteHistory = [...voteHistory, { day: dayCount, votes: votes.map(v => ({ from: v.voterId, to: v.targetId })), eliminated: outPlayer.id }];
    setVoteHistory(updatedVoteHistory);
    setPhase('day_processing');
    handlePlayerElimination(outPlayer);
    setIsThinking(false);
    setSelectedTarget(null);
  }, [addLog, checkGameEnd, dayCount, gameActiveRef, players, setIsThinking, setPhase, setSelectedTarget, setVoteHistory, voteHistory]);

  const handlePlayerElimination = useCallback((outPlayer) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    const updatedPlayers = players.map(p => p.id === outPlayer.id ? { ...p, isAlive: false } : p);
    setPlayers(updatedPlayers);
    setDeathHistory(prev => [...prev, { day: dayCount, phase: '投票', playerId: outPlayer.id, cause: '被公投出局' }]);
    const isHunter = outPlayer.role === ROLE_DEFINITIONS.HUNTER && outPlayer.canHunterShoot;

    setTimeout(() => {
      if (gameActiveRef && !gameActiveRef.current) return;
      if (isHunter) {
        setHunterShooting({ ...outPlayer, source: 'vote' });
        if (outPlayer.isUser && gameMode !== 'ai-only') {
          setPhase('hunter_shoot');
        } else {
          handleAIHunterShoot(outPlayer, 'vote', [], updatedPlayers);
        }
      } else {
        const result = checkGameEnd(updatedPlayers);
        if (result) {
          setPhase('game_over');
          return;
        }
        (proceedToNextNightExternal || proceedToNextNight)();
      }
    }, TIMING.DAY_TRANSITION_DELAY);
  }, [checkGameEnd, dayCount, gameActiveRef, gameMode, handleAIHunterShoot, players, proceedToNextNightExternal, ROLE_DEFINITIONS.HUNTER, setDeathHistory, setHunterShooting, setPhase, setPlayers]);

  const handleVote = useCallback(async () => {
    if (gameActiveRef && !gameActiveRef.current) return;
    if (selectedTarget === null || isThinking) return;
    const targetPlayer = players.find(p => p.id === selectedTarget);
    if (!targetPlayer?.isAlive) {
      addLog('不能投票给死亡玩家！', 'warning');
      return;
    }
    setIsThinking(true);
    const alive = players.filter(p => p.isAlive);
    const aliveIds = alive.map(p => p.id);
    const deadIds = players.filter(p => !p.isAlive).map(p => p.id);

    // 找到用户玩家（isUser标记）
    const userPlayerObj = players.find(p => p.isUser);
    const userVote = userPlayerObj?.isAlive ? {
      voterId: userPlayerObj.id,
      voterName: userPlayerObj.name,
      targetId: selectedTarget,
      reasoning: '玩家选择'
    } : null;

    const aiPlayers = alive.filter(p => !p.isUser);

    // 并行投票：所有AI同时做决策
    const aiVotePromises = aiPlayers.map(async (p) => {
      const validTargets = aliveIds.filter(id => id !== p.id);
      let targetId = null;
      let reasoning = '';
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);

      // 优先使用发言意向
      if (mySpeech && mySpeech.voteIntention !== undefined && validTargets.includes(mySpeech.voteIntention)) {
        targetId = mySpeech.voteIntention;
        reasoning = '遵循发言意向';
      } else {
        // 需要AI决策
        let seerConstraint = '';
        if (p.role === '预言家') {
          const myChecks = seerChecks.filter(c => c.seerId === p.id);
          const goodPeople = myChecks.filter(c => !c.isWolf).map(c => c.targetId);
          if (goodPeople.length > 0) {
            seerConstraint = `\n【预言家约束】你查验过以下玩家是好人：${goodPeople.join(',')}号。【严禁投票给你验证为好人的玩家！】`;
          }
        }

        const res = await askAI(p, PROMPT_ACTIONS.DAY_VOTE, { validTargets, seerConstraint });
        targetId = res?.targetId;
        reasoning = res?.reasoning || '';
      }

      // 构建投票对象
      if (targetId !== undefined && validTargets.includes(targetId)) {
        return { voterId: p.id, voterName: p.name, targetId, reasoning };
      } else if (targetId !== undefined) {
        const fallback = validTargets[Math.floor(Math.random() * validTargets.length)];
        return { voterId: p.id, voterName: p.name, targetId: fallback, reasoning: reasoning || '备用选择' };
      }
      return null;
    });

    // 等待所有AI投票完成
    const aiVoteResults = await Promise.all(aiVotePromises);
    const aiVotes = aiVoteResults.filter(v => v !== null);

    const votes = userVote ? [userVote, ...aiVotes] : aiVotes;
    processVoteResults(votes, aliveIds);
  }, [addLog, askAI, dayCount, gameActiveRef, players, processVoteResults, seerChecks, selectedTarget, setIsThinking, speechHistory]);

  return {
    startDayDiscussion,
    moveToNextSpeaker,
    handleAutoVote,
    handleVote,
    processVoteResults,
    handlePlayerElimination,
    proceedToNextNight,
    handleAIHunterShoot,
    handleUserHunterShoot
  };
}
