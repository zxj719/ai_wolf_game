import { useReducer, useRef } from 'react';
import { generateAllPlayerAvatars, getPlaceholderAvatar, generateGameBackground } from './services/imageGenerator';

const initialState = {
  phase: 'setup',
  nightStep: 0,
  dayCount: 1,
  players: [],
  userPlayer: null,
  logs: [],
  nightDecisions: {
    wolfTarget: null,
    wolfSkipKill: false,
    witchSave: false,
    witchPoison: null,
    guardTarget: null,
    lastGuardTarget: null,
    seerResult: null
  },
  seerChecks: [],
  guardHistory: [],
  witchHistory: { savedIds: [], poisonedIds: [] },
  speechHistory: [],
  voteHistory: [],
  deathHistory: [],
  // 新增：夜间行动历史，用于记录每个角色的夜间行动和思考过程
  nightActionHistory: [],
  // 新增：当前阶段的发言/行动（用于显示在气泡中）
  currentPhaseData: {
    speeches: [],
    actions: []
  },
  // 游戏主题背景图像
  gameBackground: null,
  // AI模型使用追踪（用于排行榜统计）
  modelUsage: {
    gameSessionId: null,  // 游戏会话ID
    playerModels: {}      // { playerId: { modelId, modelName } }
  }
};

const types = {
  SET_PHASE: 'SET_PHASE',
  SET_NIGHT_STEP: 'SET_NIGHT_STEP',
  SET_DAY_COUNT: 'SET_DAY_COUNT',
  SET_PLAYERS: 'SET_PLAYERS',
  SET_USER_PLAYER: 'SET_USER_PLAYER',
  SET_NIGHT_DECISIONS: 'SET_NIGHT_DECISIONS',
  MERGE_NIGHT_DECISIONS: 'MERGE_NIGHT_DECISIONS',
  SET_LOGS: 'SET_LOGS',
  PUSH_LOG: 'PUSH_LOG',
  SET_SEER_CHECKS: 'SET_SEER_CHECKS',
  SET_GUARD_HISTORY: 'SET_GUARD_HISTORY',
  SET_WITCH_HISTORY: 'SET_WITCH_HISTORY',
  SET_SPEECH_HISTORY: 'SET_SPEECH_HISTORY',
  SET_VOTE_HISTORY: 'SET_VOTE_HISTORY',
  SET_DEATH_HISTORY: 'SET_DEATH_HISTORY',
  SET_NIGHT_ACTION_HISTORY: 'SET_NIGHT_ACTION_HISTORY',
  SET_CURRENT_PHASE_DATA: 'SET_CURRENT_PHASE_DATA',
  ADD_CURRENT_PHASE_SPEECH: 'ADD_CURRENT_PHASE_SPEECH',
  ADD_CURRENT_PHASE_ACTION: 'ADD_CURRENT_PHASE_ACTION',
  CLEAR_CURRENT_PHASE_DATA: 'CLEAR_CURRENT_PHASE_DATA',
  SET_GAME_BACKGROUND: 'SET_GAME_BACKGROUND',
  SET_MODEL_USAGE: 'SET_MODEL_USAGE',
  UPDATE_PLAYER_MODEL: 'UPDATE_PLAYER_MODEL',
};

function reducer(state, action) {
  const apply = (key, payload) => 
    typeof payload === 'function' ? payload(state[key]) : payload;

  switch (action.type) {
    case types.SET_PHASE:
      return { ...state, phase: apply('phase', action.payload) };
    case types.SET_NIGHT_STEP:
      return { ...state, nightStep: apply('nightStep', action.payload) };
    case types.SET_DAY_COUNT:
      return { ...state, dayCount: apply('dayCount', action.payload) };
    case types.SET_PLAYERS:
      return { ...state, players: apply('players', action.payload) };
    case types.SET_USER_PLAYER:
      return { ...state, userPlayer: apply('userPlayer', action.payload) };
    case types.SET_NIGHT_DECISIONS:
      return { ...state, nightDecisions: apply('nightDecisions', action.payload) };
    case types.MERGE_NIGHT_DECISIONS:
      return { ...state, nightDecisions: { ...state.nightDecisions, ...action.payload } };
    case types.SET_LOGS:
      return { ...state, logs: apply('logs', action.payload) };
    case types.PUSH_LOG:
      return { ...state, logs: [action.payload, ...state.logs] };
    case types.SET_SEER_CHECKS:
      return { ...state, seerChecks: apply('seerChecks', action.payload) };
    case types.SET_GUARD_HISTORY:
      return { ...state, guardHistory: apply('guardHistory', action.payload) };
    case types.SET_WITCH_HISTORY:
      return { ...state, witchHistory: apply('witchHistory', action.payload) };
    case types.SET_SPEECH_HISTORY:
      return { ...state, speechHistory: apply('speechHistory', action.payload) };
    case types.SET_VOTE_HISTORY:
      return { ...state, voteHistory: apply('voteHistory', action.payload) };
    case types.SET_DEATH_HISTORY:
      return { ...state, deathHistory: apply('deathHistory', action.payload) };
    case types.SET_NIGHT_ACTION_HISTORY:
      return { ...state, nightActionHistory: apply('nightActionHistory', action.payload) };
    case types.SET_CURRENT_PHASE_DATA:
      return { ...state, currentPhaseData: apply('currentPhaseData', action.payload) };
    case types.ADD_CURRENT_PHASE_SPEECH:
      return { 
        ...state, 
        currentPhaseData: { 
          ...state.currentPhaseData, 
          speeches: [...state.currentPhaseData.speeches, action.payload] 
        } 
      };
    case types.ADD_CURRENT_PHASE_ACTION:
      return { 
        ...state, 
        currentPhaseData: { 
          ...state.currentPhaseData, 
          actions: [...state.currentPhaseData.actions, action.payload] 
        } 
      };
    case types.CLEAR_CURRENT_PHASE_DATA:
      return { ...state, currentPhaseData: { speeches: [], actions: [] } };
    case types.SET_GAME_BACKGROUND:
      return { ...state, gameBackground: action.payload };
    case types.SET_MODEL_USAGE:
      return { ...state, modelUsage: apply('modelUsage', action.payload) };
    case types.UPDATE_PLAYER_MODEL:
      return {
        ...state,
        modelUsage: {
          ...state.modelUsage,
          playerModels: {
            ...state.modelUsage.playerModels,
            [action.payload.playerId]: {
              modelId: action.payload.modelId,
              modelName: action.payload.modelName
            }
          }
        }
      };
    default:
      return state;
  }
}

export function useWerewolfGame(config) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const processedVoteDayRef = useRef(-1);
  const gameInitializedRef = useRef(false);

  const setPhase = (value) => dispatch({ type: types.SET_PHASE, payload: value });
  const setNightStep = (value) => dispatch({ type: types.SET_NIGHT_STEP, payload: value });
  const setDayCount = (value) => dispatch({ type: types.SET_DAY_COUNT, payload: value });
  const setPlayers = (value) => dispatch({ type: types.SET_PLAYERS, payload: value });
  const setUserPlayer = (value) => dispatch({ type: types.SET_USER_PLAYER, payload: value });
  const setNightDecisions = (value) => dispatch({ type: types.SET_NIGHT_DECISIONS, payload: value });
  const mergeNightDecisions = (value) => dispatch({ type: types.MERGE_NIGHT_DECISIONS, payload: value });
  const setSeerChecks = (value) => dispatch({ type: types.SET_SEER_CHECKS, payload: value });
  const setGuardHistory = (value) => dispatch({ type: types.SET_GUARD_HISTORY, payload: value });
  const setWitchHistory = (value) => dispatch({ type: types.SET_WITCH_HISTORY, payload: value });
  const setSpeechHistory = (value) => dispatch({ type: types.SET_SPEECH_HISTORY, payload: value });
  const setVoteHistory = (value) => dispatch({ type: types.SET_VOTE_HISTORY, payload: value });
  const setDeathHistory = (value) => dispatch({ type: types.SET_DEATH_HISTORY, payload: value });
  const setNightActionHistory = (value) => dispatch({ type: types.SET_NIGHT_ACTION_HISTORY, payload: value });
  const setCurrentPhaseData = (value) => dispatch({ type: types.SET_CURRENT_PHASE_DATA, payload: value });
  const addCurrentPhaseSpeech = (value) => dispatch({ type: types.ADD_CURRENT_PHASE_SPEECH, payload: value });
  const addCurrentPhaseAction = (value) => dispatch({ type: types.ADD_CURRENT_PHASE_ACTION, payload: value });
  const clearCurrentPhaseData = () => dispatch({ type: types.CLEAR_CURRENT_PHASE_DATA });
  const setGameBackground = (value) => dispatch({ type: types.SET_GAME_BACKGROUND, payload: value });
  const setLogs = (value) => dispatch({ type: types.SET_LOGS, payload: value });
  const pushLog = (value) => dispatch({ type: types.PUSH_LOG, payload: value });
  const setModelUsage = (value) => dispatch({ type: types.SET_MODEL_USAGE, payload: value });
  const updatePlayerModel = (playerId, modelId, modelName) => dispatch({
    type: types.UPDATE_PLAYER_MODEL,
    payload: { playerId, modelId, modelName }
  });

  const addLog = (text, type = 'info', speaker = null) => {
    pushLog({ text, type, speaker, id: `${Date.now()}-${Math.random()}` });
  };

  const initGame = async (mode = 'player', customConfig = null) => {
    const { ROLE_DEFINITIONS, PERSONALITIES, NAMES } = config;
    
    // Use custom config if provided, otherwise fallback to default config
    // Assuming customConfig provides TOTAL_PLAYERS and STANDARD_ROLES
    const activeTotalPlayers = customConfig?.TOTAL_PLAYERS || config.TOTAL_PLAYERS;
    const activeRoles = customConfig?.STANDARD_ROLES || config.STANDARD_ROLES;
    const setupName = customConfig?.name || "标准局";

    let shuffledRoles = [...activeRoles].sort(() => 0.5 - Math.random());
    let namePool = [...NAMES].sort(() => 0.5 - Math.random());
    let newPlayers = Array.from({ length: activeTotalPlayers }, (_, i) => ({
      id: i,
      name: mode === 'ai-only' ? namePool[i] : (i === 0 ? '你' : namePool[i]),
      role: shuffledRoles[i],
      isAlive: true,
      isUser: mode === 'player' && i === 0,
      personality: (mode === 'player' && i === 0) ? { traits: '人类玩家' } : PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
      avatarColor: `hsl(${(i * 50) % 360}, 60%, 45%)`,
      // 玩家模式下使用中性占位符（用户自己除外），AI模式下显示角色占位符
      avatarUrl: mode === 'ai-only'
        ? getPlaceholderAvatar(shuffledRoles[i])
        : (i === 0 ? getPlaceholderAvatar('cat') : getPlaceholderAvatar('村民')),
      hasWitchSave: true,
      hasWitchPoison: true,
      canHunterShoot: true,
      isPoisoned: false
    }));

    // Set initial players with placeholders
    setPlayers(newPlayers);
    setUserPlayer(mode === 'player' ? newPlayers[0] : null);
    setPhase('night');
    setNightStep(0);
    setDayCount(1);
    setSeerChecks([]);
    setGuardHistory([]);
    setWitchHistory({ savedIds: [], poisonedIds: [] });
    setSpeechHistory([]);
    setVoteHistory([]);
    setDeathHistory([]);
    setNightActionHistory([]);
    clearCurrentPhaseData();
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
    // 初始化模型使用追踪（生成唯一游戏会话ID）
    setModelUsage({
      gameSessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      playerModels: {}
    });
    
    // Generate role summary string
    const roleCounts = activeRoles.reduce((acc, role) => {
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});
    const configStr = Object.entries(roleCounts).map(([r, c]) => `${c}${r}`).join('');

    // Different log message for AI-only vs player mode
    if (mode === 'ai-only') {
      addLog(`${activeTotalPlayers}人${setupName}启动！配置：${configStr}。`, 'system');
    } else {
      addLog(`${activeTotalPlayers}人${setupName}启动！你是 [0号] ${newPlayers[0].name}，身份：【${newPlayers[0].role}】。配置：${configStr}。`, 'system');
    }
    addLog(`正在生成角色头像...`, 'system');

    // Generate avatars asynchronously (don't block game start)
    generateAllPlayerAvatars(newPlayers, mode)
      .then(playersWithAvatars => {
        setPlayers(playersWithAvatars);
        addLog(`头像生成完成！`, 'success');
      })
      .catch(err => {
        console.error('[Game] Avatar generation failed:', err);
        addLog(`头像生成失败，使用默认图标`, 'warning');
      });

    // Generate game background asynchronously
    generateGameBackground()
      .then(backgroundUrl => {
        if (backgroundUrl) {
          setGameBackground(backgroundUrl);
          addLog(`背景生成完成！`, 'success');
        }
      })
      .catch(err => {
        console.error('[Game] Background generation failed:', err);
      });
  };

  return {
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
    setCurrentPhaseData,
    addCurrentPhaseSpeech,
    addCurrentPhaseAction,
    clearCurrentPhaseData,
    setGameBackground,
    setLogs,
    addLog,
    initGame,
    processedVoteDayRef,
    gameInitializedRef,
    setModelUsage,
    updatePlayerModel,
  };
}
