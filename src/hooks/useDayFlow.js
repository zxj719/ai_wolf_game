import { useCallback } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';

export function useDayFlow({
  players,
  setPlayers,
  gameMode,
  addLog,
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
  proceedToNextNightExternal // optional override from night flow
}) {
  const proceedToNextNight = useCallback((clearPhaseData) => {
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
  }, [addLog, dayCount, setDayCount, setPhase, setNightStep, mergeNightDecisions]);

  const moveToNextSpeaker = useCallback(() => {
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
  }, [players, spokenCount, speakingOrder, setSpeakerIndex, setPhase, addLog, setSpokenCount, speechHistory, dayCount]);

  const startDayDiscussion = useCallback((currentPlayers, nightDeads = [], TOTAL_PLAYERS, clearPhaseData) => {
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
  }, [addLog, players, setSpeakerIndex, setSpokenCount, setPhase]);

  const handleAIHunterShoot = useCallback(async (hunter, source, nightDeads = [], currentPlayersState = null) => {
    setIsThinking(true);
    let currentPlayers = currentPlayersState ? [...currentPlayersState] : [...players];
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
    setIsThinking(false);

    if (res?.shoot && res.targetId !== null && aliveTargets.includes(res.targetId)) {
      const reason = res.reason ? `(${res.reason})` : '';
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人！开枪带走了 [${res.targetId}号]！${reason}`, 'danger');
      currentPlayers = currentPlayers.map(p => p.id === res.targetId ? { ...p, isAlive: false } : p);
      setPlayers(currentPlayers);
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: res.targetId, cause: '被猎人带走' }]);
    } else {
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人，选择不开枪。`, 'info');
    }

    setTimeout(() => {
      setHunterShooting(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      if (source === 'vote') {
        (proceedToNextNightExternal || proceedToNextNight)();
      } else {
        startDayDiscussion(currentPlayers, nightDeads, players.length);
      }
    }, 2000);
  }, [askAI, setIsThinking, players, addLog, setPlayers, setDeathHistory, dayCount, checkGameEnd, setPhase, setHunterShooting, proceedToNextNightExternal, startDayDiscussion]);

  const handleUserHunterShoot = useCallback((source) => {
    let currentPlayers = [...players];
    const aliveTargets = currentPlayers.filter(p => p.isAlive && p.id !== userPlayer.id);

    if (selectedTarget !== null && aliveTargets.some(p => p.id === selectedTarget)) {
      addLog(`你是猎人！开枪带走了 [${selectedTarget}号]！`, 'danger');
      currentPlayers = currentPlayers.map(p => p.id === selectedTarget ? { ...p, isAlive: false } : p);
      setPlayers(currentPlayers);
      setDeathHistory(prev => [...prev, { day: dayCount, phase: '猎人枪', playerId: selectedTarget, cause: '被猎人带走' }]);
    } else {
      addLog(`你是猎人，选择不开枪。`, 'info');
    }

    setTimeout(() => {
      setHunterShooting(null);
      setSelectedTarget(null);
      const result = checkGameEnd(currentPlayers);
      if (result) {
        setPhase('game_over');
        return;
      }
      if (source === 'vote') {
        (proceedToNextNightExternal || proceedToNextNight)();
      } else {
        startDayDiscussion(currentPlayers, [], players.length);
      }
    }, 2000);
  }, [players, userPlayer, selectedTarget, addLog, setPlayers, setDeathHistory, dayCount, checkGameEnd, setPhase, setHunterShooting, setSelectedTarget, startDayDiscussion, proceedToNextNightExternal]);

  const handleAutoVote = useCallback(async () => {
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
  }, [askAI, players, speechHistory, dayCount, seerChecks, setIsThinking]);

  const processVoteResults = useCallback((votes, aliveIds) => {
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
  }, [addLog, players, voteHistory, dayCount, setVoteHistory, checkGameEnd, setPhase, setIsThinking, setSelectedTarget]);

  const handlePlayerElimination = useCallback((outPlayer) => {
    const updatedPlayers = players.map(p => p.id === outPlayer.id ? { ...p, isAlive: false } : p);
    setPlayers(updatedPlayers);
    setDeathHistory([...deathHistory, { day: dayCount, phase: '投票', playerId: outPlayer.id, cause: '被公投出局' }]);
    const isHunter = outPlayer.role === ROLE_DEFINITIONS.HUNTER && outPlayer.canHunterShoot;

    setTimeout(() => {
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
    }, 2000);
  }, [players, setPlayers, deathHistory, setDeathHistory, dayCount, ROLE_DEFINITIONS.HUNTER, setHunterShooting, gameMode, setPhase, handleAIHunterShoot, checkGameEnd, proceedToNextNightExternal]);

  const handleVote = useCallback(async () => {
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
  }, [selectedTarget, players, addLog, setIsThinking, speechHistory, dayCount, seerChecks, processVoteResults, askAI]);

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
