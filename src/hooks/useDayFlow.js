import { useCallback, useRef } from 'react';
import { PROMPT_ACTIONS } from '../services/aiPrompts';
import { TIMING } from '../config/constants';
import { btDecide } from '../services/btClient';
import { validateDecision } from '../services/logicValidator';
import { actionQueue } from '../services/actionQueue';
import { buildSnapshot, buildActionKey } from '../services/snapshotBuilder';
import { dispatchCommand } from '../services/commandDispatcher';

const ABSTAIN_TARGET = -1;

function normalizeVoteTarget(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) return undefined;
  return numeric;
}

function buildVoteRecord({ voter, targetId, validTargets, reasoning, thought = '' }) {
  const normalizedTarget = normalizeVoteTarget(targetId);
  if (normalizedTarget === ABSTAIN_TARGET) {
    return { voterId: voter.id, voterName: voter.name, targetId: ABSTAIN_TARGET, reasoning: reasoning || '弃票', thought };
  }
  if (validTargets.includes(normalizedTarget)) {
    return { voterId: voter.id, voterName: voter.name, targetId: normalizedTarget, reasoning, thought };
  }
  if (targetId !== undefined && targetId !== null) {
    const fallback = validTargets[0];
    if (fallback !== undefined) {
      return { voterId: voter.id, voterName: voter.name, targetId: fallback, reasoning: reasoning || '备用选择', thought };
    }
  }
  return null;
}

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
  clearCurrentPhaseData,
  proceedToNextNightExternal, // optional override from night flow
  gameActiveRef,
  // 柱一：幂等原子 action
  killPlayer,
  recordVoteRound,
  recordNightAction,
}) {
  // Guard against re-entrant handleAutoVote calls. Each askAI call inside
  // the sequential vote loop sets isThinking=false on completion, which
  // triggers WerewolfModule's useEffect to call handleAutoVote again.
  // Without this guard, multiple vote loops run in parallel → state
  // corruption → votes never complete.
  const votingInProgressRef = useRef(false);

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
      seerCheckedThisNight: false,  // 重置一晚一验锁
      dreamTarget: null,
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

    // 直接验证是否所有存活玩家都已发言（比计数器更可靠，避免闭包过期导致跳人）
    const allSpoken = alivePlayers.every(p =>
      speechHistory.some(s => s.day === dayCount && s.playerId === p.id)
    );
    const spokenThisDay = speechHistory.filter(s => s.day === dayCount).length;
    setSpokenCount(spokenThisDay);

    console.log(`[moveToNextSpeaker] 已发言: ${spokenThisDay}/${alivePlayers.length}, allSpoken=${allSpoken}`);

    if (allSpoken) {
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

        let attempts = 0;
        while (attempts < alivePlayers.length) {
          const nextPlayer = alivePlayers[next];
          if (nextPlayer && !speechHistory.some(s => s.day === dayCount && s.playerId === nextPlayer.id)) {
            console.log(`[moveToNextSpeaker] 下一个发言: index=${next} (${nextPlayer.id}号 ${nextPlayer.name})`);
            return next;
          }
          next = next + direction;
          if (next < 0) next = alivePlayers.length - 1;
          if (next >= alivePlayers.length) next = 0;
          attempts++;
        }

        // 循环完毕仍没找到未发言者 → 全员已发言
        console.log(`[moveToNextSpeaker] 循环检查：所有人都已发言，进入投票`);
        setSpeakerIndex(-1);
        setPhase('day_voting');
        addLog('全员发言结束，进入放逐投票阶段。', 'system');
        return -1;
      });
    }
  }, [addLog, dayCount, gameActiveRef, players, speakingOrder, speechHistory, setPhase, setSpeakerIndex, setSpokenCount]);

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

    // BT 决策：优先走 ECS BT Server，降级到本地 BT，再降级到 LLM
    const _hunterGameState = { players: currentPlayers, speechHistory, voteHistory: [], seerChecks, dayCount };
    const _hunterBT = await btDecide(hunter, 'HUNTER_SHOOT', _hunterGameState, { validTargets: aliveTargets });
    const res = _hunterBT
      ? { targetId: _hunterBT.targetId, thought: _hunterBT.reasoning }
      : await askAI(hunter, PROMPT_ACTIONS.HUNTER_SHOOT, { aliveTargets, hunterContext });
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
      if (gameMode === 'ai-only' && res?.thought) {
        addLog(`💭 [${hunter.id}号 猎人] ${res.thought}`, 'thought');
      }

      // 柱二：HUNTER_SHOOT 经分发器闸门（目标合法、射手仍可开枪、非自射）
      const hunterSnapshot = buildSnapshot(
        { players: currentPlayers, dayCount, nightDecisions, seerChecks, speechHistory, voteHistory: [], deathHistory: [] },
        { phase: 'hunter_shoot', chainDepth }
      );
      const hunterKey = buildActionKey({ day: dayCount, phase: 'hunter_shoot', step: chainDepth, playerId: hunter.id, actionType: 'HUNTER_SHOOT' });
      const hunterDispatch = dispatchCommand({
        actionType: 'HUNTER_SHOOT',
        snapshot: hunterSnapshot,
        decision: { targetId, shooterId: hunter.id },
        actorId: hunter.id,
        key: hunterKey,
        skipFreshness: true, // 猎人开枪 UI 串行触发
        commit: () => {
          recordNightAction({
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
          // 柱一：原子 kill（同 dispatch 内完成 isAlive + deathHistory）
          killPlayer({ playerId: targetId, day: dayCount, phase: '猎人枪', cause: '被猎人带走' });
        },
      });
      if (!hunterDispatch.accepted) {
        addLog(`猎人开枪被系统拒绝：${hunterDispatch.reason}`, 'error');
      }
      // 找到被带走的玩家（无论是否 accepted，后续 UI 流程需知道目标）
      targetPlayer = currentPlayers.find(p => p.id === targetId);
      // 局部变量同步，仅用于后续闭包内逻辑
      currentPlayers = currentPlayers.map(p => p.id === targetId ? { ...p, isAlive: false } : p);
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
  }, [recordNightAction, addLog, askAI, checkGameEnd, clearCurrentPhaseData, dayCount, gameActiveRef, gameMode, killPlayer, players, proceedToNextNightExternal, ROLE_DEFINITIONS, seerChecks, setHunterShooting, setIsThinking, setPhase, speechHistory, startDayDiscussion]);

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

      // 柱二：HUNTER_SHOOT 经分发器闸门
      const uHunterSnapshot = buildSnapshot(
        { players: currentPlayers, dayCount, nightDecisions, seerChecks, speechHistory, voteHistory: [], deathHistory: [] },
        { phase: 'hunter_shoot', chainDepth }
      );
      const uHunterKey = buildActionKey({ day: dayCount, phase: 'hunter_shoot', step: chainDepth, playerId: userPlayer.id, actionType: 'HUNTER_SHOOT' });
      const uHunterDispatch = dispatchCommand({
        actionType: 'HUNTER_SHOOT',
        snapshot: uHunterSnapshot,
        decision: { targetId: selectedTarget, shooterId: userPlayer.id },
        actorId: userPlayer.id,
        key: uHunterKey,
        skipFreshness: true,
        commit: () => {
          recordNightAction({
            playerId: userPlayer.id,
            type: '猎人开枪',
            target: selectedTarget,
            day: dayCount,
            source: normalizedSource,
            description: `猎人开枪带走 ${selectedTarget}号`,
            timestamp: Date.now(),
            persist: true
          });
          killPlayer({ playerId: selectedTarget, day: dayCount, phase: '猎人枪', cause: '被猎人带走' });
        },
      });
      if (!uHunterDispatch.accepted) {
        addLog(`猎人开枪被系统拒绝：${uHunterDispatch.reason}`, 'error');
        return;
      }

      const targetPlayer = currentPlayers.find(p => p.id === selectedTarget);
      currentPlayers = currentPlayers.map(p => p.id === selectedTarget ? { ...p, isAlive: false } : p);

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
  }, [recordNightAction, addLog, checkGameEnd, clearCurrentPhaseData, dayCount, gameActiveRef, gameMode, handleAIHunterShoot, killPlayer, players, proceedToNextNightExternal, ROLE_DEFINITIONS.HUNTER, selectedTarget, setHunterShooting, setPhase, setSelectedTarget, startDayDiscussion, userPlayer]);

  const handleAutoVote = useCallback(async () => {
    if (gameActiveRef && !gameActiveRef.current) return;
    if (votingInProgressRef.current) return;
    votingInProgressRef.current = true;
    setIsThinking(true);
    const alive = players.filter(p => p.isAlive);
    const aliveIds = alive.map(p => p.id);
    const deadIds = players.filter(p => !p.isAlive).map(p => p.id);

    // 顺序投票：每次一个 AI 调用 LLM。原本是 Promise.all 并行 8 个，但
    // ECS 端 spawn claude CLI 子进程在并发 ≥ 6 时会偶发 502（资源/锁竞争）。
    // 顺序后整个 vote phase 从 ~30s 拉长到 ~3min，但 0 fail。
    const voteResults = [];
    for (const p of alive) {
      if (gameActiveRef && !gameActiveRef.current) break;
      let targetId = null;
      let reasoning = '';
      let thought = '';
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);

      const validVoteTargets = aliveIds.filter(id => id !== p.id);

      // voteDecided 机制：发言阶段 AI 填 voteDecided=true 表示已决定，直接用 voteIntention；
      // voteDecided=false 或无效则给 AI 一次额外投票思考调用
      const decided = mySpeech?.voteDecided === true;
      const speechVoteTarget = normalizeVoteTarget(mySpeech?.voteIntention);
      if (decided && (speechVoteTarget === ABSTAIN_TARGET || validVoteTargets.includes(speechVoteTarget))) {
        targetId = speechVoteTarget;
        reasoning = '遵循发言意向';
      } else {
        // 行为树短路：hybrid 模式下，注册的 (role, DAY_VOTE) 组合用 BT 决策（0ms）
        const btResult = await btDecide(p, 'DAY_VOTE',
          { players, speechHistory, voteHistory, seerChecks, dayCount },
          { validTargets: validVoteTargets });

        if (btResult && btResult.targetId != null) {
          targetId = btResult.targetId;
          reasoning = btResult.reasoning;
        } else {
          // 兜底：走 LLM（legacy 管线）
          let seerConstraint = '';
          if (p.role === '预言家') {
            const myChecks = seerChecks.filter(c => c.seerId === p.id);
            const goodPeople = myChecks.filter(c => !c.isWolf).map(c => c.targetId);
            if (goodPeople.length > 0) {
              seerConstraint = `\n【预言家约束】你查验过以下玩家是好人：${goodPeople.join(',')}号。【严禁投票给你验证为好人的玩家！】除非有极强的反逻辑证据。`;
            }
          }

          const res = await askAI(p, PROMPT_ACTIONS.DAY_VOTE, { validTargets: validVoteTargets, seerConstraint });
          targetId = res?.targetId;
          reasoning = res?.reasoning || '';
          thought = res?.thought || '';
        }
      }

      voteResults.push(buildVoteRecord({
        voter: p,
        targetId,
        validTargets: validVoteTargets,
        reasoning,
        thought,
      }));
    }
    const votes = voteResults.filter(v => v !== null);

    processVoteResults(votes, aliveIds);
    votingInProgressRef.current = false;
  }, [askAI, dayCount, gameActiveRef, players, seerChecks, setIsThinking, speechHistory]);

  const processVoteResults = useCallback((votes, aliveIds) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    const countedVotes = votes.filter((v) => aliveIds.includes(v.targetId));
    const counts = countedVotes.reduce((acc, v) => {
      acc[v.targetId] = (acc[v.targetId] || 0) + 1;
      return acc;
    }, {});

    addLog('--- 投票记录 ---', 'system');
    votes.forEach(v => {
      const reasonText = v.reasoning ? ` (${v.reasoning})` : '';
      const targetText = v.targetId === ABSTAIN_TARGET ? '弃票' : `[${v.targetId}号]`;
      addLog(`[${v.voterId}号] 投给 -> ${targetText}${reasonText}`, 'info');
      if (gameMode === 'ai-only' && v.thought) {
        addLog(`💭 [${v.voterId}号] 投票思考: ${v.thought}`, 'thought');
      }
    });

    if (Object.keys(counts).length === 0) {
      addLog('无人投票，平安日。', 'info');
      // 柱一：按 day 幂等记录投票轮
      recordVoteRound({ day: dayCount, votes: [], eliminatedId: null });
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
    const topCandidates = Object.keys(counts).filter(id => parseInt(counts[id]) === maxVotes);
    let outPlayer;
    if (topCandidates.length > 1) {
      addLog(`平票！[${topCandidates.join('号]和[')}号] 各获得 ${maxVotes} 票，进入 PK 环节。`, 'warning');
      recordVoteRound({
        day: dayCount,
        votes: votes.map(v => ({ from: v.voterId, to: v.targetId, reasoning: v.reasoning || '', thought: v.thought || '' })),
        eliminatedId: null,
      });
      setIsThinking(false);
      setSelectedTarget(null);
      handlePKRound(topCandidates.map(id => parseInt(id, 10)), aliveIds);
      return;
    } else {
      outPlayer = players.find(p => p.id === parseInt(topCandidates[0], 10));
    }

    if (!outPlayer) {
      addLog('无人出局（投票目标不存在），进入下一夜。', 'system');
      recordVoteRound({ day: dayCount, votes: votes.map(v => ({ from: v.voterId, to: v.targetId })), eliminatedId: null });
      setIsThinking(false);
      setSelectedTarget(null);
      const result = checkGameEnd();
      if (result) { setPhase('game_over'); } else { proceedToNextNight(); }
      return;
    }

    addLog(`[${outPlayer.id}号] ${outPlayer.name} 被公投出局。`, 'danger');
    // 柱二：DAY_VOTE 经分发器闸门（快照+合法性+actor活性）后再提交
    const voteSnapshot = buildSnapshot(
      { players, dayCount, nightDecisions, seerChecks, speechHistory, voteHistory, deathHistory },
      { phase: 'day_voting' }
    );
    const voteKey = buildActionKey({ day: dayCount, phase: 'day_vote', playerId: outPlayer.id, actionType: 'DAY_VOTE' });
    const voteDispatch = dispatchCommand({
      actionType: 'DAY_VOTE',
      snapshot: voteSnapshot,
      decision: { targetId: outPlayer.id },
      actorId: null, // 放逐是全体行为，无单一 actor
      key: voteKey,
      skipFreshness: true, // 投票流程本身串行，无需版本闸
      commit: () => {
        // 柱一：按 day 幂等记录投票轮，保留每票 reasoning/thought
        recordVoteRound({
          day: dayCount,
          votes: votes.map(v => ({ from: v.voterId, to: v.targetId, reasoning: v.reasoning || '', thought: v.thought || '' })),
          eliminatedId: outPlayer.id,
        });
        setPhase('day_processing');
        handlePlayerElimination(outPlayer);
      },
    });
    if (!voteDispatch.accepted) {
      addLog(`投票被系统拒绝：${voteDispatch.reason}，直接进入下一夜。`, 'error');
      recordVoteRound({ day: dayCount, votes: votes.map(v => ({ from: v.voterId, to: v.targetId })), eliminatedId: null });
      const result = checkGameEnd();
      if (result) { setPhase('game_over'); } else { proceedToNextNight(); }
    }
    setIsThinking(false);
    setSelectedTarget(null);
  // handlePKRound 声明在后面，不能放进 deps（TDZ），走闭包引用
  }, [addLog, checkGameEnd, dayCount, gameActiveRef, gameMode, players, recordVoteRound, setIsThinking, setPhase, setSelectedTarget]);

  // PK 平票处理：被 tie 的候选人各发一段 PK 发言 → 全员重投 → 再平票进夜
  const handlePKRound = useCallback(async (pkCandidateIds, aliveIds) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    setIsThinking(true);
    addLog('--- PK 环节开始 ---', 'system');

    // PK 发言：每个 tied 候选人发一段为自己辩护的话
    for (const candidateId of pkCandidateIds) {
      if (gameActiveRef && !gameActiveRef.current) break;
      const candidate = players.find(p => p.id === candidateId);
      if (!candidate || !candidate.isAlive) continue;

      const res = await askAI(candidate, PROMPT_ACTIONS.DAY_SPEECH, { pkMode: true });
      if (res?.speech) {
        addLog(`[PK] [${candidate.id}号] ${candidate.name}: ${res.speech}`, 'chat');
        if (gameMode === 'ai-only' && res.thought) {
          addLog(`💭 [${candidate.id}号 PK] ${res.thought}`, 'thought');
        }
      }
    }

    addLog('PK 发言结束，进入 PK 投票。', 'system');

    // PK 投票：所有存活玩家投票，只能在 PK 候选人之间选或弃票
    const alive = players.filter(p => p.isAlive);
    const pkVoteResults = [];
    for (const p of alive) {
      if (gameActiveRef && !gameActiveRef.current) break;
      let targetId = null;
      let reasoning = '';
      let thought = '';
      const validTargets = pkCandidateIds.filter(id => id !== p.id);

      if (validTargets.length === 0) {
        pkVoteResults.push({ voterId: p.id, voterName: p.name, targetId: ABSTAIN_TARGET, reasoning: 'PK 候选人只有自己，自动弃票', thought: '' });
        continue;
      }

      const btResult = await btDecide(p, 'DAY_VOTE',
        { players, speechHistory, voteHistory, seerChecks, dayCount },
        { validTargets });

      if (btResult && btResult.targetId != null) {
        targetId = btResult.targetId;
        reasoning = btResult.reasoning;
      } else {
        const res = await askAI(p, PROMPT_ACTIONS.DAY_VOTE, {
          validTargets,
          seerConstraint: '',
          pkMode: true,
          pkCandidates: pkCandidateIds,
        });
        targetId = res?.targetId;
        reasoning = res?.reasoning || '';
        thought = res?.thought || '';
      }

      pkVoteResults.push(buildVoteRecord({
        voter: p,
        targetId,
        validTargets,
        reasoning,
        thought,
      }));
    }
    const pkVotes = pkVoteResults.filter(v => v !== null);

    // 统计 PK 票数
    addLog('--- PK 投票记录 ---', 'system');
    pkVotes.forEach(v => {
      const targetText = v.targetId === ABSTAIN_TARGET ? '弃票' : `[${v.targetId}号]`;
      addLog(`[${v.voterId}号] PK投票 -> ${targetText}${v.reasoning ? ` (${v.reasoning})` : ''}`, 'info');
    });

    const pkCounted = pkVotes.filter(v => pkCandidateIds.includes(v.targetId));
    const pkCounts = pkCounted.reduce((acc, v) => {
      acc[v.targetId] = (acc[v.targetId] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(pkCounts).length === 0) {
      addLog('PK 投票全部弃票，无人出局，进入下一夜。', 'warning');
      setIsThinking(false);
      proceedToNextNight();
      return;
    }

    const pkMax = Math.max(...Object.values(pkCounts));
    const pkTop = Object.keys(pkCounts).filter(id => pkCounts[id] === pkMax);

    if (pkTop.length > 1) {
      addLog(`PK 仍然平票！[${pkTop.join('号]和[')}号] 各获得 ${pkMax} 票，无人出局，直接进入夜晚。`, 'warning');
      setIsThinking(false);
      proceedToNextNight();
      return;
    }

    const pkOutPlayer = players.find(p => p.id === parseInt(pkTop[0], 10));
    if (!pkOutPlayer) {
      addLog('PK 投票目标不存在，进入下一夜。', 'system');
      setIsThinking(false);
      proceedToNextNight();
      return;
    }

    addLog(`[${pkOutPlayer.id}号] ${pkOutPlayer.name} 在 PK 中被淘汰。`, 'danger');
    setIsThinking(false);
    setPhase('day_processing');
    handlePlayerElimination(pkOutPlayer);
  }, [addLog, askAI, dayCount, gameActiveRef, gameMode, players, proceedToNextNight, setIsThinking, setPhase, speechHistory, seerChecks, voteHistory]);

  const handlePlayerElimination = useCallback((outPlayer) => {
    if (gameActiveRef && !gameActiveRef.current) return;
    // 柱一：原子 kill（atomicity replaces separate setPlayers + setDeathHistory）
    killPlayer({ playerId: outPlayer.id, day: dayCount, phase: '投票', cause: '被公投出局' });
    const updatedPlayers = players.map(p => p.id === outPlayer.id ? { ...p, isAlive: false } : p);
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
  }, [checkGameEnd, dayCount, gameActiveRef, gameMode, handleAIHunterShoot, killPlayer, players, proceedToNextNightExternal, ROLE_DEFINITIONS.HUNTER, setHunterShooting, setPhase]);

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

    // 顺序投票：每次一个 AI 调用 LLM（避免并发 spawn claude 触发 ECS 端
    // 资源竞争 → 偶发 502 → 兜底 random）。这是 player-mode 的入口，
    // handleAutoVote 上面那段是 ai-only 模式入口，两段都改成顺序。
    const aiVoteResults = [];
    for (const p of aiPlayers) {
      if (gameActiveRef && !gameActiveRef.current) break;
      const validTargets = aliveIds.filter(id => id !== p.id);
      let targetId = null;
      let reasoning = '';
      const mySpeech = speechHistory.find(s => s.day === dayCount && s.playerId === p.id);

      const decided = mySpeech?.voteDecided === true;
      const speechVoteTarget = normalizeVoteTarget(mySpeech?.voteIntention);
      if (decided && (speechVoteTarget === ABSTAIN_TARGET || validTargets.includes(speechVoteTarget))) {
        targetId = speechVoteTarget;
        reasoning = '遵循发言意向';
      } else {
        const btResult = await btDecide(p, 'DAY_VOTE',
          { players, speechHistory, voteHistory, seerChecks, dayCount },
          { validTargets });

        if (btResult && btResult.targetId != null) {
          targetId = btResult.targetId;
          reasoning = btResult.reasoning;
        } else {
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
      }

      aiVoteResults.push(buildVoteRecord({
        voter: p,
        targetId,
        validTargets,
        reasoning,
      }));
    }
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
