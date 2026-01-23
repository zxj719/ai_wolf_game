import React, { useState, useEffect, useRef } from 'react';
import { useWerewolfGame } from './useWerewolfGame';
import { SetupScreen } from './components/SetupScreen';
import { GameArena } from './components/GameArena';
import { AuthPage } from './components/Auth';
import { useAuth } from './contexts/AuthContext';
import { ROLE_DEFINITIONS, STANDARD_ROLES, GAME_SETUPS, PERSONALITIES, NAMES, DEFAULT_TOTAL_PLAYERS } from './config/roles';
import { API_KEY, API_URL, AI_MODELS as DEFAULT_AI_MODELS, AI_PROVIDER, SILICONFLOW_FALLBACK_MODELS } from './config/aiConfig';
import { useAI } from './hooks/useAI';
import { useDayFlow } from './hooks/useDayFlow';
import { PROMPT_ACTIONS } from './services/aiPrompts';
import { fetchSiliconFlowChatModels } from './services/aiClient';

// Inline game config moved to src/config
const TOTAL_PLAYERS = DEFAULT_TOTAL_PLAYERS;

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [gameMode, setGameMode] = useState(null);
  const [selectedSetup, setSelectedSetup] = useState(GAME_SETUPS[0]);
  const [isThinking, setIsThinking] = useState(false);
  const [aiModels, setAiModels] = useState(DEFAULT_AI_MODELS);
  const [hunterShooting, setHunterShooting] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [speakerIndex, setSpeakerIndex] = useState(-1);
  const [speakingOrder, setSpeakingOrder] = useState('left');
  const [spokenCount, setSpokenCount] = useState(0);
  const [userInput, setUserInput] = useState('');
  
  const disabledModelsRef = useRef(new Set());
  const speakingLockRef = useRef(false); // 发言锁，防止并发
  const currentDayRef = useRef(1); // 追踪当前天数 

  const {
    state,
    setPhase,
    setNightStep,
    setDayCount,
    setPlayers,
    setUserPlayer,
    setNightDecisions,
    mergeNightDecisions,
    setSeerChecks,
    setGuardHistory,
    setWitchHistory,
    setSpeechHistory,
    setVoteHistory,
    setDeathHistory,
    setNightActionHistory,
    addCurrentPhaseSpeech,
    addCurrentPhaseAction,
    clearCurrentPhaseData,
    setLogs,
    addLog,
    initGame,
  } = useWerewolfGame({
    ROLE_DEFINITIONS, 
    STANDARD_ROLES, 
    GAME_SETUPS, 
    PERSONALITIES, 
    NAMES, 
    TOTAL_PLAYERS: DEFAULT_TOTAL_PLAYERS
  });

  const {
    phase,
    nightStep,
    dayCount,
    players,
    userPlayer,
    logs,
    nightDecisions,
    seerChecks,
    guardHistory,
    witchHistory,
    speechHistory,
    voteHistory,
    deathHistory,
    nightActionHistory,
    currentPhaseData,
    gameBackground
  } = state;

  useEffect(() => {
    if (gameMode && phase === 'setup') {
        initGame(gameMode, selectedSetup);
    }
  }, [gameMode, phase, selectedSetup]);

  useEffect(() => {
    let cancelled = false;

    const loadProviderModels = async () => {
      if (AI_PROVIDER !== 'siliconflow') {
        setAiModels(DEFAULT_AI_MODELS);
        return;
      }

      if (!API_KEY) {
        setAiModels(SILICONFLOW_FALLBACK_MODELS);
        return;
      }

      const remoteModels = await fetchSiliconFlowChatModels({ apiKey: API_KEY });
      if (cancelled) return;

      setAiModels(remoteModels.length > 0 ? remoteModels : SILICONFLOW_FALLBACK_MODELS);
    };

    loadProviderModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentNightSequence = selectedSetup.NIGHT_SEQUENCE || ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];

  const { askAI } = useAI({
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
      AI_MODELS: aiModels,
      // 游戏配置（用于区分6人局/8人局等不同规则）
      gameSetup: selectedSetup,
      // 整局夜间行动历史（包含所有夜晚的行动记录，而非每天刷新）
      nightActionHistory
    });

  const checkGameEnd = (currentPlayers = players) => {
    const aliveWolves = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.WEREWOLF).length;
    const aliveVillagers = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.VILLAGER).length;
    const aliveGods = currentPlayers.filter(p => p.isAlive && (p.role !== '狼人' && p.role !== '村民')).length;
    
    console.log(`[GameCheck] Wolves: ${aliveWolves}, Villagers: ${aliveVillagers}, Gods: ${aliveGods}, Check State:`, currentPlayers.map(p => `${p.id}:${p.role[0]}:${p.isAlive?'alive':'dead'}`).join(','));

    const aliveGood = aliveVillagers + aliveGods;
    
    if (aliveWolves === 0) {
      addLog("🎉 狼人全灭，好人胜利！", "success");
      return 'good_win';
    }
    if (aliveVillagers === 0) {
      addLog("💀 村民全灭，狼人胜利（屠边）！", "danger");
      return 'wolf_win';
    }
    if (aliveGods === 0) {
      addLog("💀 神职全灭，狼人胜利（屠边）！", "danger");
      return 'wolf_win';
    }
    if (aliveWolves >= aliveGood) {
      addLog("💀 狼人数量大于等于好人，狼人胜利！", "danger");
      return 'wolf_win';
    }
    return null;
  };

  const {
      startDayDiscussion,
      handleAutoVote,
      handleVote,
      handleUserHunterShoot,
      handleAIHunterShoot,
      handlePlayerElimination,
      moveToNextSpeaker,
      // proceedToNextNight is used internally by useDayFlow, but we can also use it if we want to bypass App's proceedNight?
      // No, App's proceedNight handles Night Phase Steps. The hook's proceedToNextNight is for Day -> Night transition.
      // We should use hook's proceedToNextNight for Day phase end.
      // But we passed proceedNight (App) to it as External.
  } = useDayFlow({
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
    clearCurrentPhaseData
  });

  const proceedNight = (decisionsOverride = null) => {
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
  };

  const resolveNight = (decisionsOverride = null) => {
    const { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget } = decisionsOverride || nightDecisions;
    console.log(`[resolveNight] 夜间决策：`, { wolfTarget, wolfSkipKill, witchSave, witchPoison, guardTarget });
    
    // 保存当前夜间的所有行动到历史记录
    if (currentPhaseData && currentPhaseData.actions && currentPhaseData.actions.length > 0) {
      console.log(`[resolveNight] 保存${currentPhaseData.actions.length}条夜间行动到历史记录`);
      setNightActionHistory([...nightActionHistory, ...currentPhaseData.actions]);
    }
    
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
      // 注意：这里假设场上只有一个女巫，或者所有女巫共享决策（当前逻辑是单一女巫）
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

    // 检查游戏是否结束（例如屠边触发）
    if (checkGameEnd(updatedPlayers)) {
      setPhase('game_over');
      return;
    }

    if (uniqueDeads.length === 0) {
      addLog("天亮了，昨晚是平安夜。", "success");
      // 添加平安夜公告到行动面板（系统消息，所有人可见）
      addCurrentPhaseAction({
        playerId: 'system',
        type: '公告',
        description: '昨晚是平安夜，无人死亡',
        night: dayCount,
        timestamp: Date.now()
      });
      setPhase('day_announce');
      setTimeout(() => {
        startDayDiscussion(updatedPlayers, [], players.length, clearCurrentPhaseData);
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
            handleAIHunterShoot(hunter, 'night', uniqueDeads, updatedPlayers); // Pass uniqueDeads & updatedPlayers
          }
        }, 2000);
      } else {
        // 夜晚死亡无遗言，直接进入白天讨论
        setTimeout(() => {
          startDayDiscussion(updatedPlayers, uniqueDeads, players.length, clearCurrentPhaseData);
        }, 2000);
      }
    }
  };

  useEffect(() => {
    if (phase !== 'night') return;

    const executeNightAction = async () => {
    const roleOrder = currentNightSequence;
    const currentRoleKey = roleOrder[nightStep];
    
    console.log(`[夜间行动] nightStep=${nightStep}, dayCount=${dayCount}, 当前角色=${ROLE_DEFINITIONS[currentRoleKey] || '未知'}`);
    console.log(`[夜间行动] 当前 nightDecisions:`, nightDecisions);
    
    // 如果nightStep超出范围，直接跳过
    if (!currentRoleKey) {
      console.log('[夜间行动] nightStep超出范围，跳过');
      setTimeout(proceedNight, 100);
      return;
    }
    
    const actor = players.find(p => p.role === ROLE_DEFINITIONS[currentRoleKey] && p.isAlive);

    // 修正：如果该角色已全员阵亡，自动跳过
    if (!actor) {
      console.log(`[夜间行动] 没有找到存活的${ROLE_DEFINITIONS[currentRoleKey]}`);
      if (gameMode === 'ai-only') {
        addLog(`由于场上没有存活的${ROLE_DEFINITIONS[currentRoleKey]}，直接跳过。`, 'system');
      }
      setTimeout(proceedNight, 1500);
      return;
    }
    console.log(`[夜间行动] 找到角色：${actor.id}号 ${actor.name}，是否用户：${actor.isUser}`);
    // 如果是存活的用户且非全AI模式，等待交互；否则自动执行AI
    if (actor.isUser && actor.isAlive && gameMode !== 'ai-only') {
      // 如果用户是狼人，但已有其他狼人（包括AI狼）做出决定，则跳过
      // 注意：只有在狼人行动阶段（currentRoleKey === 'WEREWOLF'）才检查 wolfTarget
      // 防止新一晚开始时因旧状态值导致误跳过
      if (actor.role === ROLE_DEFINITIONS.WEREWOLF && currentRoleKey === 'WEREWOLF' && nightDecisions.wolfTarget !== null) {
        console.log(`[夜间行动] 狼人队友已选择，用户 ${actor.id} 无需行动`);
        setTimeout(proceedNight, 100);
        return;
      }
      console.log(`[夜间行动] 等待用户操作`);
      return;
    }

    // 全AI模式：打印夜间行动提示
    if (gameMode === 'ai-only') {
      // addLog(`[${actor.id}号 ${actor.name}] 正在行动...`, 'system'); // 移除【正在行动】日志
    }

    if (currentRoleKey === 'GUARD') {
      const cannotGuard = nightDecisions.lastGuardTarget;
      const alivePlayers = players.filter(p => p.isAlive).map(p => p.id);
      // 首夜建议空守避免同守同救
      const isFirstNight = dayCount === 1;
      // const hint = isFirstNight ? '首夜建议空守避免同守同救。' : ''; // Moved to AI prompt logic
      console.log(`[守卫AI] 开始守卫决策，存活玩家：${alivePlayers.join(',')}`);
      const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_GUARD, { cannotGuard });
      console.log(`[守卫AI] AI返回结果：`, res);
      // 允许 null (空守) 且如果空守，不需要检查 lastGuardTarget
      if (res && (res.targetId === null || (res.targetId !== cannotGuard && (players.find(p => p.id === res.targetId)?.isAlive)))) {
        if (res.targetId !== null) {
          console.log(`[守卫AI] 守护目标：${res.targetId}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 守卫守护了 ${res.targetId}号`, 'system');
          }
          // 添加到当前阶段数据
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
          console.log(`[守卫AI] 选择空守`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 守卫选择空守`, 'system');
          }
          mergeNightDecisions({ guardTarget: null }); // Explicitly set to null
        }
      } else {
        console.log(`[守卫AI] AI决策无效或被过滤`);
        // 当校验失败时，尝试用空守作为 fallback，而不是卡住
        console.log('[守卫AI] 强制空守');
        mergeNightDecisions({ guardTarget: null });
      }
    }
    else if (currentRoleKey === 'WEREWOLF') {
      const validTargets = players.filter(p => p.isAlive && p.role !== '狼人').map(p => p.id);
      console.log(`[狼人AI] 开始狼人决策，可选目标：${validTargets.join(',')}`);
      const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WOLF);
      console.log(`[狼人AI] AI返回结果：`, res);
      if (res && validTargets.includes(res.targetId)) {
        console.log(`[狼人AI] 狼人袭击目标：${res.targetId}号`);
        if (gameMode === 'ai-only') {
          addLog(`[${actor.id}号] 狼人选择袭击 ${res.targetId}号`, 'system');
        }
        // 添加到当前阶段数据
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
        // AI决策无效时，随机选择一个目标，避免异常空刀导致平安夜
        console.log(`[狼人AI] AI决策无效，尝试随机选择目标`);
        if (validTargets.length > 0) {
          const fallbackTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
          console.log(`[狼人AI] 随机选择袭击目标：${fallbackTarget}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 狼人选择袭击 ${fallbackTarget}号`, 'system');
          }
          mergeNightDecisions({ wolfTarget: fallbackTarget, wolfSkipKill: false });
        } else {
          console.log(`[狼人AI] 没有可选目标，狼人空刀`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 狼人选择空刀`, 'system');
          }
          mergeNightDecisions({ wolfSkipKill: true });
        }
      }
    } 
    else if (currentRoleKey === 'SEER') {
      const checkedIds = seerChecks.filter(c => c.seerId === actor.id).map(c => c.targetId);
      const validTargets = players.filter(p => p.isAlive && p.id !== actor.id && !checkedIds.includes(p.id)).map(p => p.id);
      console.log(`[预言家AI] 已查验：${checkedIds.join(',') || '无'}，可验：${validTargets.join(',')}`);
      if (validTargets.length === 0) {
        console.log(`[预言家AI] 所有目标已验完`);
        addLog(`预言家已验完所有目标。`, 'system');
      } else {
        console.log(`[预言家AI] 开始查验决策`);
        const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_SEER, { validTargets });
        console.log(`[预言家AI] AI返回结果：`, res);
        if (res?.targetId !== undefined && validTargets.includes(res.targetId)) {
          // 确保 getPlayer 这里能获取到正确的玩家
          const targetPlayer = players.find(p => p.id === res.targetId);
          if (targetPlayer) {
             const isWolf = targetPlayer.role === ROLE_DEFINITIONS.WEREWOLF;
             console.log(`[预言家AI] 查验${res.targetId}号，结果：${isWolf ? '狼人' : '好人'}`);
             if (gameMode === 'ai-only') {
               addLog(`[${actor.id}号] 预言家查验了 ${res.targetId}号，结果是${isWolf ? '狼人' : '好人'}`, 'system');
             }
             // 添加到当前阶段数据
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
             // 关键修复：确保这一步正确更新了 seerChecks 状态，以便在 buildAIContext 中使用
             setSeerChecks(prev => [...prev, { night: dayCount, targetId: res.targetId, isWolf, seerId: actor.id, thought: res.thought }]);
          } else {
             console.error(`[预言家AI] 无法找到目标玩家 ${res.targetId}`);
          }
        } else {
          console.log(`[预言家AI] AI决策无效或被过滤:`, res);
          // 视为放弃查验 (Skip Check)
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
      
      console.log(`[女巫AI] 开始女巫决策，被刀：${dyingId}，解药：${canSave}，毒药：${actor.hasWitchPoison}`);
      const res = await askAI(actor, PROMPT_ACTIONS.NIGHT_WITCH, { dyingId, canSave, hasPoison: actor.hasWitchPoison });
      console.log(`[女巫AI] AI返回结果：`, res);
      
      // 构建完整的夜间决策对象
      const finalDecisions = { ...nightDecisions };
      
      if (res) {
        if (res.useSave && canSave) {
          console.log(`[女巫AI] 使用解药救${dyingId}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫使用解药救了 ${dyingId}号`, 'system');
          }
          // 添加到当前阶段数据
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
          // remove setPlayers here to avoid state race condition, handle in resolveNight
          setWitchHistory(prev => ({ ...prev, savedIds: [...prev.savedIds, dyingId] })); // 修复：使用 prev
        } else if (res.usePoison !== null && actor.hasWitchPoison && !res.useSave && validPoisonTargets.includes(res.usePoison)) {
          console.log(`[女巫AI] 使用毒药毒${res.usePoison}号`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫使用毒药毒了 ${res.usePoison}号`, 'system');
          }
          // 添加到当前阶段数据
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
          // remove setPlayers here too
          setWitchHistory(prev => ({ ...prev, poisonedIds: [...prev.poisonedIds, res.usePoison] })); // 修复：使用 prev
        } else {
          console.log(`[女巫AI] 不使用药水`);
          if (gameMode === 'ai-only') {
            addLog(`[${actor.id}号] 女巫选择不使用药水`, 'system');
          }
        }
      } else {
        console.log(`[女巫AI] AI决策失败`);
      }
      
      // 女巫是最后一步，传递完整的决策对象
      console.log(`[女巫AI] 最终决策：`, finalDecisions);
      setTimeout(() => proceedNight(finalDecisions), 1500);
      return; // 直接返回，不要继续执行后面的 setTimeout
    }

    console.log(`[夜间行动] ${ROLE_DEFINITIONS[currentRoleKey]}行动完成，1.5秒后进入下一步`);
    setTimeout(proceedNight, 1500);
    };

    executeNightAction();
  }, [phase, nightStep]);

  // --- 发言与投票逻辑 ---
  // 用户死亡后或全AI模式下自动进行投票
  useEffect(() => {
    if (phase === 'day_voting' && !isThinking) {
      const userAlive = players.find(p => p.id === 0)?.isAlive;
      if (!userAlive || gameMode === 'ai-only') {
        // 用户已死亡或全AI模式，自动AI投票
        handleAutoVote();
      }
    }
  }, [phase, players]);

  // 当天数变化时，重置发言锁
  useEffect(() => {
    if (currentDayRef.current !== dayCount) {
      currentDayRef.current = dayCount;
      speakingLockRef.current = false;
    }
  }, [dayCount]);

  useEffect(() => {
    if (phase === 'day_discussion' && speakerIndex !== -1) {
      const alivePlayers = players.filter(p => p.isAlive);
      if (speakerIndex < 0 || speakerIndex >= alivePlayers.length) {
        setSpeakerIndex(-1);
        setPhase('day_voting');
        addLog('全员发言结束，进入放逐投票阶段。', 'system');
        return;
      }
      
      const currentSpeaker = alivePlayers[speakerIndex];
      
      // 严格检查：如果发言锁被占用，直接返回
      if (speakingLockRef.current) {
        console.log(`[发言控制] 发言锁被占用，等待当前发言完成`);
        return;
      }
      
      // 防止重复发言：检查该玩家今日是否已发言
      if (speechHistory.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
        console.log(`[发言控制] ${currentSpeaker.id}号已在第${dayCount}天发言，跳过`);
        // 已经发言过了，直接进入下一个
        moveToNextSpeaker();
        return;
      }

      if (currentSpeaker && (!currentSpeaker.isUser || gameMode === 'ai-only')) {
        const triggerAISpeech = async () => {
          // 获取发言锁
          if (speakingLockRef.current) {
            console.log(`[发言控制] 锁已被占用，取消本次发言请求`);
            return;
          }
          
          speakingLockRef.current = true;
          console.log(`[发言控制] ${currentSpeaker.id}号获得发言锁，开始发言`);
          
          try {
            // 三重检查：在API调用前再次确认
            if (speechHistory.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
              console.log(`[发言控制] 最终检查：${currentSpeaker.id}号已发言，取消API调用`);
              return;
            }

            const aliveIds = alivePlayers.map(p => p.id);
            const res = await askAI(currentSpeaker, PROMPT_ACTIONS.DAY_SPEECH);
            
            if (res) {
              // 再次检查，确保在API返回期间没有其他发言
              if (speechHistory.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
                console.log(`[发言控制] API返回后检查：${currentSpeaker.id}号已发言，丢弃结果`);
                return;
              }
              
              // 全AI模式下展示思维链(CoT)
              if (gameMode === 'ai-only' && res.thought) {
                 addLog(`(思考) ${res.thought}`, "chat", `[${currentSpeaker.id}号]`);
              }

              if (res.speech) {
                addLog(res.speech, "chat", `[${currentSpeaker.id}号]`);
                
                // 添加到当前阶段数据（用于显示气泡）
                addCurrentPhaseSpeech({
                  playerId: currentSpeaker.id,
                  name: currentSpeaker.name,
                  content: res.speech,
                  thought: res.thought,
                  day: dayCount,
                  timestamp: Date.now()
                });
                
                setSpeechHistory(prev => {
                  // 最后一次检查：确保不会添加重复记录
                  if (prev.some(s => s.day === dayCount && s.playerId === currentSpeaker.id)) {
                    console.log(`[发言控制] 添加历史前检查：${currentSpeaker.id}号已存在，跳过添加`);
                    return prev;
                  }
                  console.log(`[发言控制] ${currentSpeaker.id}号成功添加发言记录`);
                  return [...prev, { 
                    playerId: currentSpeaker.id, 
                    name: currentSpeaker.name, 
                    content: res.speech,
                    thought: res.thought, // 保存思考过程
                    day: dayCount, 
                    summary: res.summary || res.speech.slice(0, 20),
                    voteIntention: res.voteIntention 
                  }];
                });
              }
            }
            
            // 添加延迟避免API速率限制
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`[发言控制] ${currentSpeaker.id}号发言出错:`, error);
          } finally {
            // 释放锁并进入下一个
            speakingLockRef.current = false;
            console.log(`[发言控制] ${currentSpeaker.id}号释放发言锁，进入下一个`);
            moveToNextSpeaker();
          }
        };
        triggerAISpeech();
      }
    }
  }, [phase, speakerIndex, players, speechHistory, dayCount]);

  // 用户发言
  const handleUserSpeak = () => {
    if (!userInput.trim()) return;
    
    // 检查用户是否已经在当前轮次发言
    if (speechHistory.some(s => s.day === dayCount && s.playerId === userPlayer?.id)) {
      console.log(`[发言控制] 用户已在第${dayCount}天发言，不能重复发言`);
      addLog('你已经在本轮发言过了！', 'warning');
      return;
    }
    
    // 获取发言锁
    if (speakingLockRef.current) {
      console.log(`[发言控制] 发言锁被占用，用户稍后再试`);
      addLog('请等待当前发言结束...', 'warning');
      return;
    }
    
    speakingLockRef.current = true;
    console.log(`[发言控制] 用户获得发言锁，开始发言`);
    
    try {
      addLog(userInput, "chat", "你");
      
      // 添加到当前阶段数据（用于显示气泡）
      addCurrentPhaseSpeech({
        playerId: userPlayer?.id || 0,
        name: "你",
        content: userInput,
        day: dayCount,
        timestamp: Date.now()
      });
      
      setSpeechHistory(prev => {
        // 再次确认不会重复
        if (prev.some(s => s.day === dayCount && s.playerId === userPlayer?.id)) {
          return prev;
        }
        return [...prev, { 
          playerId: userPlayer?.id || 0, 
          name: "你", 
          content: userInput, 
          day: dayCount 
        }];
      });
      setUserInput("");
    } finally {
      speakingLockRef.current = false;
      console.log(`[发言控制] 用户释放发言锁`);
      moveToNextSpeaker();
    }
  };



  // 重新开始游戏
  const restartGame = () => {
    processedVoteDayRef.current = -1;
    gameInitializedRef.current = false;
    setGameMode(null);
    setLogs([]);
    setPhase('setup');
  };

  // 导出游戏日志
  const exportGameLog = () => {
    const timestamp = new Date().toLocaleString('zh-CN');
    let logContent = `========================================\n`;
    logContent += `狼人杀游戏记录\n`;
    logContent += `导出时间: ${timestamp}\n`;
    logContent += `游戏天数: ${dayCount}\n`;
    logContent += `========================================\n\n`;
    
    // 玩家身份列表
    logContent += `【玩家身份】\n`;
    logContent += `----------------------------------------\n`;
    players.forEach(p => {
      const status = p.isAlive ? '存活' : '死亡';
      const userMark = p.isUser ? ' (你)' : '';
      logContent += `${p.id}号 ${p.name}${userMark}: ${p.role} [${status}]\n`;
    });
    logContent += `\n`;
    
    // 死亡记录
    logContent += `【死亡记录】\n`;
    logContent += `----------------------------------------\n`;
    if (deathHistory.length === 0) {
      logContent += `无人死亡\n`;
    } else {
      deathHistory.forEach(d => {
        const player = players.find(p => p.id === d.playerId);
        logContent += `第${d.day}天${d.phase}: ${d.playerId}号 ${player?.name || ''} (${player?.role || '未知'}) - ${d.cause}\n`;
      });
    }
    logContent += `\n`;
    
    // 发言记录
    logContent += `【发言记录】\n`;
    logContent += `----------------------------------------\n`;
    if (speechHistory.length === 0) {
      logContent += `暂无发言\n`;
    } else {
      let currentDay = 0;
      speechHistory.forEach(s => {
        if (s.day !== currentDay) {
          currentDay = s.day;
          logContent += `\n--- 第${currentDay}天 ---\n`;
        }
        const player = players.find(p => p.id === s.playerId);
        const role = player?.role || '未知';
        logContent += `[${s.playerId}号 ${s.name} (${role})]: ${s.content}\n`;
      });
    }
    logContent += `\n`;
    
    // 投票记录
    logContent += `【投票记录】\n`;
    logContent += `----------------------------------------\n`;
    if (voteHistory.length === 0) {
      logContent += `暂无投票\n`;
    } else {
      voteHistory.forEach(v => {
        logContent += `\n第${v.day}天投票:\n`;
        v.votes.forEach(vote => {
          const fromPlayer = players.find(p => p.id === vote.from);
          const toPlayer = players.find(p => p.id === vote.to);
          logContent += `  ${vote.from}号(${fromPlayer?.role || '?'}) -> ${vote.to}号(${toPlayer?.role || '?'})\n`;
        });
        const eliminated = players.find(p => p.id === v.eliminated);
        logContent += `  结果: ${v.eliminated}号 ${eliminated?.name || ''} (${eliminated?.role || '未知'}) 被放逐\n`;
      });
    }
    logContent += `\n`;
    
    // 预言家查验记录
    logContent += `【预言家查验记录】\n`;
    logContent += `----------------------------------------\n`;
    if (seerChecks.length === 0) {
      logContent += `无查验记录\n`;
    } else {
      seerChecks.forEach(c => {
        const seer = players.find(p => p.id === c.seerId);
        const target = players.find(p => p.id === c.targetId);
        logContent += `第${c.night}夜: ${c.seerId}号(${seer?.name || ''}) 查验 ${c.targetId}号(${target?.name || ''}) = ${c.isWolf ? '狼人' : '好人'}\n`;
      });
    }
    logContent += `\n`;
    
    // 守卫记录
    logContent += `【守卫守护记录】\n`;
    logContent += `----------------------------------------\n`;
    if (guardHistory.length === 0) {
      logContent += `无守护记录\n`;
    } else {
      guardHistory.forEach(g => {
        const target = players.find(p => p.id === g.targetId);
        logContent += `第${g.night}夜: 守护 ${g.targetId}号 ${target?.name || ''}\n`;
      });
    }
    logContent += `\n`;
    
    // 女巫用药记录
    logContent += `【女巫用药记录】\n`;
    logContent += `----------------------------------------\n`;
    if (witchHistory.savedIds.length === 0 && witchHistory.poisonedIds.length === 0) {
      logContent += `无用药记录\n`;
    } else {
      if (witchHistory.savedIds.length > 0) {
        logContent += `解药救过: ${witchHistory.savedIds.map(id => {
          const p = players.find(x => x.id === id);
          return `${id}号(${p?.name || ''})`;
        }).join(', ')}\n`;
      }
      if (witchHistory.poisonedIds.length > 0) {
        logContent += `毒药毒过: ${witchHistory.poisonedIds.map(id => {
          const p = players.find(x => x.id === id);
          return `${id}号(${p?.name || ''})`;
        }).join(', ')}\n`;
      }
    }
    logContent += `\n`;
    
    // 游戏结果
    logContent += `========================================\n`;
    const aliveWolves = players.filter(p => p.isAlive && p.role === '狼人').length;
    if (aliveWolves === 0) {
      logContent += `游戏结果: 好人阵营胜利！\n`;
    } else {
      logContent += `游戏结果: 狼人阵营胜利！\n`;
    }
    logContent += `========================================\n`;
    
    // 创建下载
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `狼人杀记录_${new Date().toISOString().slice(0,10)}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPlayer = (id) => players.find(p => p.id === id);
  const isUserTurn = () => {
    const roles = currentNightSequence;
    return userPlayer?.isAlive && userPlayer.role === ROLE_DEFINITIONS[roles[nightStep]];
  };

  // 获取当前夜间阶段的角色名
  const getCurrentNightRole = () => {
    const roles = currentNightSequence.map(key => ROLE_DEFINITIONS[key]);
    return roles[nightStep] || '';
  };

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  // 未登录且不是游客模式，显示登录页面
  if (!user && !isGuestMode) {
    return <AuthPage onGuestPlay={() => setIsGuestMode(true)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 用户信息栏 */}
      {user && phase === 'setup' && !gameMode && (
        <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
          <span className="text-zinc-400 text-sm">
            欢迎, <span className="text-zinc-200">{user.username}</span>
          </span>
          <button
            onClick={logout}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            登出
          </button>
        </div>
      )}

      {/* 游客模式提示 */}
      {isGuestMode && !user && phase === 'setup' && !gameMode && (
        <div className="absolute top-4 right-4 z-50">
          <span className="text-zinc-500 text-sm">游客模式</span>
        </div>
      )}

      {/* 模式选择界面 */}
      {phase === 'setup' && !gameMode && (
        <SetupScreen
          gameMode={gameMode}
          setGameMode={setGameMode}
          selectedSetup={selectedSetup}
          setSelectedSetup={setSelectedSetup}
          gameSetups={GAME_SETUPS}
        />
      )}

      {/* 游戏主界面 - 新的圆形布局 */}
      {(phase !== 'setup' || gameMode) && (
        <GameArena
          // 游戏状态
          players={players}
          userPlayer={userPlayer}
          phase={phase}
          dayCount={dayCount}
          nightStep={nightStep}
          nightDecisions={nightDecisions}
          speechHistory={speechHistory}
          nightActionHistory={nightActionHistory}
          voteHistory={voteHistory}
          deathHistory={deathHistory}
          seerChecks={seerChecks}
          guardHistory={guardHistory}
          witchHistory={witchHistory}
          currentPhaseData={currentPhaseData}
          gameBackground={gameBackground}
          logs={logs}
          
          // 选择状态
          selectedTarget={selectedTarget}
          setSelectedTarget={setSelectedTarget}
          speakerIndex={speakerIndex}
          
          // 控制
          gameMode={gameMode}
          isThinking={isThinking}
          
          // 用户交互
          speakingOrder={speakingOrder}
          setSpeakingOrder={setSpeakingOrder}
          userInput={userInput}
          setUserInput={setUserInput}
          handleUserSpeak={handleUserSpeak}
          
          // Action handlers
          hunterShooting={hunterShooting}
          handleUserHunterShoot={handleUserHunterShoot}
          handleAIHunterShoot={handleAIHunterShoot}
          handleVote={handleVote}
          proceedNight={proceedNight}
          mergeNightDecisions={mergeNightDecisions}
          setPlayers={setPlayers}
          setUserPlayer={setUserPlayer}
          witchHistorySetter={setWitchHistory}
          getPlayer={getPlayer}
          addLog={addLog}
          setSeerChecks={setSeerChecks}
          currentNightSequence={currentNightSequence}
          ROLE_DEFINITIONS={ROLE_DEFINITIONS}
          getCurrentNightRole={getCurrentNightRole}
          isUserTurn={isUserTurn}
          exportGameLog={exportGameLog}
          restartGame={restartGame}
          
          // AI
          AI_MODELS={aiModels}
        />
      )}
    </div>
  );
}
