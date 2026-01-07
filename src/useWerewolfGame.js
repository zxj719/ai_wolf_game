import { useReducer, useRef } from 'react';

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
};

function reducer(state, action) {
  switch (action.type) {
    case types.SET_PHASE:
      return { ...state, phase: action.payload };
    case types.SET_NIGHT_STEP:
      return { ...state, nightStep: action.payload };
    case types.SET_DAY_COUNT:
      return { ...state, dayCount: action.payload };
    case types.SET_PLAYERS:
      return { ...state, players: action.payload };
    case types.SET_USER_PLAYER:
      return { ...state, userPlayer: action.payload };
    case types.SET_NIGHT_DECISIONS:
      return { ...state, nightDecisions: action.payload };
    case types.MERGE_NIGHT_DECISIONS:
      return { ...state, nightDecisions: { ...state.nightDecisions, ...action.payload } };
    case types.SET_LOGS:
      return { ...state, logs: action.payload };
    case types.PUSH_LOG:
      return { ...state, logs: [action.payload, ...state.logs] };
    case types.SET_SEER_CHECKS:
      return { ...state, seerChecks: action.payload };
    case types.SET_GUARD_HISTORY:
      return { ...state, guardHistory: action.payload };
    case types.SET_WITCH_HISTORY:
      return { ...state, witchHistory: action.payload };
    case types.SET_SPEECH_HISTORY:
      return { ...state, speechHistory: action.payload };
    case types.SET_VOTE_HISTORY:
      return { ...state, voteHistory: action.payload };
    case types.SET_DEATH_HISTORY:
      return { ...state, deathHistory: action.payload };
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
  const setLogs = (value) => dispatch({ type: types.SET_LOGS, payload: value });
  const pushLog = (value) => dispatch({ type: types.PUSH_LOG, payload: value });

  const addLog = (text, type = 'info', speaker = null) => {
    pushLog({ text, type, speaker, id: `${Date.now()}-${Math.random()}` });
  };

  const initGame = (mode = 'player') => {
    const { TOTAL_PLAYERS, STANDARD_ROLES, ROLE_DEFINITIONS, PERSONALITIES, NAMES } = config;
    let shuffledRoles = [...STANDARD_ROLES].sort(() => 0.5 - Math.random());
    let namePool = [...NAMES].sort(() => 0.5 - Math.random());
    const newPlayers = Array.from({ length: TOTAL_PLAYERS }, (_, i) => ({
      id: i,
      name: mode === 'ai-only' ? namePool[i] : (i === 0 ? '你' : namePool[i]),
      role: shuffledRoles[i],
      isAlive: true,
      isUser: mode === 'player' && i === 0,
      personality: (mode === 'player' && i === 0) ? { traits: '人类玩家' } : PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
      avatarColor: `hsl(${(i * 50) % 360}, 60%, 45%)`,
      hasWitchSave: true,
      hasWitchPoison: true,
      canHunterShoot: true,
      isPoisoned: false
    }));

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
    addLog(`8人局启动！你是 [0号] ${newPlayers[0].name}，身份：【${newPlayers[0].role}】。配置：2狼2民1预1女1猎1守。`, 'system');
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
    setLogs,
    addLog,
    initGame,
    processedVoteDayRef,
    gameInitializedRef,
  };
}
