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
  const proceedToNextNight = useCallback(() => {
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
    setSpokenCount(newSpokenCount);

    if (newSpokenCount >= alivePlayers.length) {
      setSpeakerIndex(-1);
      setPhase('day_voting');
      addLog('全员发言结束，进入放逐投票阶段。', 'system');
    } else {
      const direction = speakingOrder === 'right' ? -1 : 1;
      setSpeakerIndex(prev => {
        let next = prev + direction;
        if (next < 0) next = alivePlayers.length - 1;
        if (next >= alivePlayers.length) next = 0;
        return next;
      });
    }
  }, [players, spokenCount, speakingOrder, setSpeakerIndex, setPhase, addLog, setSpokenCount]);

  const startDayDiscussion = useCallback((currentPlayers, nightDeads = [], TOTAL_PLAYERS) => {
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
    const res = await askAI(hunter, PROMPT_ACTIONS.HUNTER_SHOOT, { aliveTargets });
    setIsThinking(false);

    if (res?.shoot && res.targetId !== null && aliveTargets.includes(res.targetId)) {
      addLog(`[${hunter.id}号] ${hunter.name} 是猎人！开枪带走了 [${res.targetId}号]！`, 'danger');
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
    let votes = [];

    for (let p of alive) {
      let targetId = null;
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);
      if (mySpeech && mySpeech.voteIntention !== undefined && aliveIds.includes(mySpeech.voteIntention)) {
        targetId = mySpeech.voteIntention;
      }
      if (targetId === null) {
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
      }
      if (targetId !== undefined && aliveIds.includes(targetId)) {
        votes.push({ voterId: p.id, voterName: p.name, targetId });
      } else if (targetId !== undefined) {
        const fallback = aliveIds.filter(id => id !== p.id)[0] || aliveIds[0];
        votes.push({ voterId: p.id, voterName: p.name, targetId: fallback });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    processVoteResults(votes, aliveIds);
  }, [askAI, players, speechHistory, dayCount, seerChecks, setIsThinking]);

  const processVoteResults = useCallback((votes, aliveIds) => {
    const counts = votes.reduce((acc, v) => {
      acc[v.targetId] = (acc[v.targetId] || 0) + 1;
      return acc;
    }, {});

    addLog('--- 投票记录 ---', 'system');
    votes.forEach(v => addLog(`[${v.voterId}号] 投给 -> [${v.targetId}号]`, 'info'));

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
    const userVote = players.find(p => p.id === 0)?.isAlive ? { voterId: 0, voterName: '你', targetId: selectedTarget } : null;
    const aiPlayers = alive.filter(p => !p.isUser);
    const aiVotes = [];
    for (const p of aiPlayers) {
      const validTargets = aliveIds.filter(id => id !== p.id);
      let targetId = null;
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);
      if (mySpeech && mySpeech.voteIntention !== undefined && validTargets.includes(mySpeech.voteIntention)) {
        targetId = mySpeech.voteIntention;
      }
      if (targetId === null) {
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
      }
      if (targetId !== undefined && validTargets.includes(targetId)) {
        aiVotes.push({ voterId: p.id, voterName: p.name, targetId });
      } else if (targetId !== undefined) {
        const fallback = validTargets[Math.floor(Math.random() * validTargets.length)];
        aiVotes.push({ voterId: p.id, voterName: p.name, targetId: fallback });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const votes = userVote ? [userVote, ...aiVotes] : aiVotes;
    processVoteResults(votes, aliveIds);
  }, [selectedTarget, players, addLog, setIsThinking, speechHistory, dayCount, seerChecks, processVoteResults]);

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
