import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from './utils/logger';
import { useWerewolfGame } from './useWerewolfGame';
import { SetupScreen } from './components/SetupScreen';
import { GameArena } from './components/GameArena';
import { AuthPage } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { SitesPage } from './components/SitesPage';
import { useAuth } from './contexts/AuthContext';
import { TokenManager } from './components/TokenManager';
import { saveGameRecord } from './services/gameService';
import { authService } from './services/authService';
import { UserStats } from './components/UserStats';
import { ROLE_DEFINITIONS, STANDARD_ROLES, GAME_SETUPS, PERSONALITIES, NAMES, DEFAULT_TOTAL_PLAYERS, DEFAULT_CUSTOM_SELECTIONS, DEFAULT_VICTORY_MODE } from './config/roles';
import { API_KEY, API_URL } from './config/aiConfig';
import { useAI } from './hooks/useAI';
import { useDayFlow } from './hooks/useDayFlow';
import { useNightFlow } from './hooks/useNightFlow';
import { useSpeechFlow } from './hooks/useSpeechFlow';
import { useAppRouter, ROUTES } from './hooks/useAppRouter';
import { useAIModels } from './hooks/useAIModels';
import { abortAllRequests, resetAbortController } from './services/aiClient';
import { checkGameEnd as checkGameEndUtil, getPlayer as getPlayerUtil, isUserTurn as isUserTurnUtil, getCurrentNightRole as getCurrentNightRoleUtil } from './utils/gameUtils';
import { exportGameLog as exportGameLogUtil } from './utils/exportGameLog';

const TOTAL_PLAYERS = DEFAULT_TOTAL_PLAYERS;

export default function App() {
  const { user, loading: authLoading, logout, modelscopeToken, tokenStatus, verifyModelscopeToken } = useAuth();

  // --- Local UI state ---
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [gameMode, setGameMode] = useState(null);
  const [selectedSetup, setSelectedSetup] = useState(GAME_SETUPS[0]);
  const [isThinking, setIsThinking] = useState(false);
  const [hunterShooting, setHunterShooting] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [speakerIndex, setSpeakerIndex] = useState(-1);
  const [speakingOrder, setSpeakingOrder] = useState('left');
  const [spokenCount, setSpokenCount] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [gameResult, setGameResult] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [customRoleSelections, setCustomRoleSelections] = useState(DEFAULT_CUSTOM_SELECTIONS);
  const [victoryMode, setVictoryMode] = useState(DEFAULT_VICTORY_MODE);

  // --- Refs ---
  const nightDecisionsRef = useRef(null);
  const gameActiveRef = useRef(false);

  // --- Game state (reducer) ---
  const {
    state,
    setPhase, setNightStep, setDayCount, setPlayers, setUserPlayer,
    setNightDecisions, mergeNightDecisions,
    setSeerChecks, setGuardHistory, setWitchHistory, setMagicianHistory,
    setSpeechHistory, setVoteHistory, setDeathHistory,
    setNightActionHistory,
    addCurrentPhaseSpeech, addCurrentPhaseAction, clearCurrentPhaseData,
    setLogs, addLog, initGame,
    processedVoteDayRef, gameInitializedRef,
    updatePlayerModel, updateActionResult,
  } = useWerewolfGame({
    ROLE_DEFINITIONS, STANDARD_ROLES, GAME_SETUPS, PERSONALITIES, NAMES, TOTAL_PLAYERS: DEFAULT_TOTAL_PLAYERS
  });

  const {
    phase, nightStep, dayCount, players, userPlayer, logs,
    nightDecisions, seerChecks, guardHistory, witchHistory, magicianHistory,
    speechHistory, voteHistory, deathHistory, nightActionHistory,
    currentPhaseData, gameBackground, modelUsage,
  } = state;

  // --- AI Models ---
  const { aiModels, disabledModelsRef } = useAIModels();

  // --- Derived values ---
  const isGameActive = phase !== 'setup' || !!gameMode;
  const currentNightSequence = selectedSetup.NIGHT_SEQUENCE || ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];
  const effectiveApiKey = modelscopeToken || API_KEY;

  // Keep ref in sync
  nightDecisionsRef.current = nightDecisions;

  // --- endGame ---
  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    abortAllRequests();
    processedVoteDayRef.current = -1;
    gameInitializedRef.current = false;
    setGameMode(null);
    setLogs([]);
    setPhase('setup');
    setNightStep(0);
    setDayCount(1);
    clearCurrentPhaseData();
    setHunterShooting(null);
    setSelectedTarget(null);
    setSpeakerIndex(-1);
    setSpokenCount(0);
    setSpeakingOrder('left');
    setUserInput('');
    setIsThinking(false);
    setGameResult(null);
    setGameStartTime(null);
    setShowStats(false);
    setShowTokenManager(false);
  }, [clearCurrentPhaseData, setDayCount, setLogs, setNightStep, setPhase]);

  // --- Router ---
  const {
    navigate, isHomeRoute, isCustomRoute, isPlayRoute, isSitesRoute, isAuthed,
  } = useAppRouter({ user, isGuestMode, isGameActive, endGame, gameMode, phase });

  // --- Guest mode auto-disable ---
  useEffect(() => {
    if (user && isGuestMode) {
      setIsGuestMode(false);
    }
  }, [user, isGuestMode]);

  // --- Game active tracking ---
  useEffect(() => {
    gameActiveRef.current = isGameActive;
  }, [isGameActive]);

  // --- Page lifecycle ---
  useEffect(() => {
    const handleBeforeUnload = () => abortAllRequests();
    const handleVisibilityChange = () => {
      if (document.hidden) abortAllRequests();
      else resetAbortController();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- Game initialization ---
  useEffect(() => {
    if (gameMode) {
      resetAbortController();
      gameActiveRef.current = true;
      initGame(gameMode, selectedSetup);
      setGameStartTime(Date.now());
    }
  }, [gameMode, selectedSetup]);

  // --- Game result: save record & model stats ---
  useEffect(() => {
    if (!gameResult || !gameMode) return;
    const saveRecord = async () => {
      if (user && !isGuestMode) {
        try {
          const up = players.find(p => p.isUser);
          const duration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
          await saveGameRecord({
            role: up?.role || '观战',
            result: gameResult === 'good_win' ? (up?.role === '狼人' ? 'lose' : 'win') : (up?.role === '狼人' ? 'win' : 'lose'),
            game_mode: gameMode,
            duration_seconds: duration
          });
        } catch (err) {
          logger.error('[战绩] 保存失败:', err);
        }
      }
      if (modelUsage?.playerModels) {
        try {
          const modelStats = {};
          Object.values(modelUsage.playerModels).forEach(({ modelId }) => {
            if (modelId) modelStats[modelId] = (modelStats[modelId] || 0) + 1;
          });
          const playerResults = players.map(p => ({
            playerId: p.id, role: p.role,
            isWinner: gameResult === 'good_win' ? p.role !== '狼人' : p.role === '狼人',
            modelId: modelUsage.playerModels[p.id]?.modelId || null,
            modelName: modelUsage.playerModels[p.id]?.modelName || null,
          }));
          await authService.submitModelStats({
            gameSessionId: modelUsage.gameSessionId, gameResult, gameMode, playerResults, modelStats
          });
        } catch (err) {
          logger.error('[模型统计] 提交失败:', err);
        }
      }
    };
    saveRecord();
  }, [gameResult]);

  // --- checkGameEnd wrapper ---
  const checkGameEnd = useCallback((currentPlayers = players) => {
    return checkGameEndUtil(currentPlayers, victoryMode, addLog, setGameResult);
  }, [players, victoryMode, addLog]);

  // --- AI ---
  const { askAI } = useAI({
    players, speechHistory, voteHistory, deathHistory, nightDecisions,
    seerChecks, guardHistory, witchHistory, dayCount, phase, setIsThinking,
    disabledModelsRef, API_URL, API_KEY: effectiveApiKey, AI_MODELS: aiModels,
    gameSetup: selectedSetup, nightActionHistory,
    onModelUsed: updatePlayerModel, victoryMode, gameActiveRef
  });

  // --- Day flow ---
  const {
    startDayDiscussion, handleAutoVote, handleVote,
    handleUserHunterShoot, handleAIHunterShoot,
    handlePlayerElimination, moveToNextSpeaker,
  } = useDayFlow({
    players, setPlayers, gameMode, addLog, addCurrentPhaseAction,
    ROLE_DEFINITIONS, setPhase, setNightStep, nightDecisions, mergeNightDecisions,
    dayCount, setDayCount, seerChecks, speechHistory, setSpeechHistory,
    voteHistory, setVoteHistory, deathHistory, setDeathHistory,
    setHunterShooting, selectedTarget, setSelectedTarget,
    speakerIndex, setSpeakerIndex, speakingOrder, setSpeakingOrder,
    spokenCount, setSpokenCount, userPlayer, isThinking, setIsThinking,
    checkGameEnd, askAI, clearCurrentPhaseData, gameActiveRef
  });

  // --- Night flow ---
  const { proceedNight } = useNightFlow({
    players, setPlayers, gameMode, addLog, addCurrentPhaseAction, updateActionResult,
    ROLE_DEFINITIONS, setPhase, phase, nightStep, setNightStep, dayCount,
    nightDecisions, nightDecisionsRef, mergeNightDecisions,
    seerChecks, setSeerChecks, guardHistory, setGuardHistory,
    witchHistory, setWitchHistory, magicianHistory, setMagicianHistory,
    deathHistory, setDeathHistory,
    selectedTarget, setSelectedTarget, setHunterShooting,
    checkGameEnd, askAI, setIsThinking, currentNightSequence,
    startDayDiscussion, handleAIHunterShoot, userPlayer, gameActiveRef,
  });

  // --- Speech flow ---
  const { handleUserSpeak } = useSpeechFlow({
    phase, players, gameMode, dayCount, speakerIndex, setSpeakerIndex,
    speechHistory, setSpeechHistory, userPlayer, userInput, setUserInput,
    addLog, addCurrentPhaseSpeech, setPhase, askAI, moveToNextSpeaker, gameActiveRef,
  });

  // --- Auto-vote trigger ---
  useEffect(() => {
    if (phase === 'day_voting' && !isThinking) {
      const userAlive = players.find(p => p.id === 0)?.isAlive;
      if (!userAlive || gameMode === 'ai-only') {
        handleAutoVote();
      }
    }
  }, [phase, players]);

  // --- Utility wrappers ---
  const getPlayer = (id) => getPlayerUtil(players, id);
  const isUserTurn = () => isUserTurnUtil(userPlayer, nightStep, currentNightSequence);
  const getCurrentNightRole = () => getCurrentNightRoleUtil(nightStep, currentNightSequence);

  const exportGameLog = () => exportGameLogUtil({
    players, dayCount, deathHistory, speechHistory, voteHistory,
    seerChecks, guardHistory, witchHistory, victoryMode
  });

  const restartGame = () => {
    endGame();
    navigate(ROUTES.CUSTOM, { replace: true });
  };

  // --- Navigation handlers ---
  const handleGuestPlay = useCallback(() => {
    setIsGuestMode(true);
    navigate(ROUTES.HOME, { replace: true });
  }, [navigate]);

  const handleGuestExitToLogin = useCallback(() => {
    endGame();
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [endGame, navigate]);

  const handleLogout = useCallback(async () => {
    endGame();
    await logout();
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [endGame, logout, navigate]);

  const handleExitToHome = useCallback(() => {
    endGame();
    navigate(ROUTES.HOME, { replace: true });
  }, [endGame, navigate]);

  const handleEnterWolfgame = useCallback(() => {
    navigate(ROUTES.CUSTOM);
  }, [navigate]);

  const handleEnterSites = useCallback(() => {
    navigate(ROUTES.SITES);
  }, [navigate]);

  // ===================== RENDER =====================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">加载中...</div>
      </div>
    );
  }

  if (!isAuthed) {
    return <AuthPage onGuestPlay={handleGuestPlay} />;
  }

  if (isHomeRoute) {
    return (
      <Dashboard
        onEnterWolfgame={handleEnterWolfgame}
        onEnterSites={handleEnterSites}
        onLogout={handleLogout}
        isGuestMode={isGuestMode}
        onLogin={handleGuestExitToLogin}
      />
    );
  }

  if (isSitesRoute) {
    return <SitesPage onBack={handleExitToHome} />;
  }

  if (!isCustomRoute && !isPlayRoute) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
      {isCustomRoute && (
        <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
          {isGuestMode && !user && (
            <span className="text-zinc-500 text-sm">游客模式</span>
          )}
          <button
            onClick={handleExitToHome}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            返回主页
          </button>
          {!isGuestMode && user && (
            <>
              <button
                onClick={() => setShowTokenManager(true)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  tokenStatus.hasToken
                    ? 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/50'
                    : 'bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/50'
                }`}
              >
                {tokenStatus.hasToken ? '令牌已配置' : '配置令牌'}
              </button>
              <button
                onClick={() => setShowStats(true)}
                className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
              >
                战绩
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                登出
              </button>
            </>
          )}
          {isGuestMode && (
            <button
              onClick={handleGuestExitToLogin}
              className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
            >
              登录
            </button>
          )}
        </div>
      )}

      {isPlayRoute && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleExitToHome}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            结束并返回主页
          </button>
        </div>
      )}

      {showStats && <UserStats onClose={() => setShowStats(false)} />}

      {showTokenManager && (
        <TokenManager
          onClose={() => setShowTokenManager(false)}
          onTokenSaved={() => {
            setShowTokenManager(false);
            verifyModelscopeToken();
          }}
        />
      )}

      {isCustomRoute && phase === 'setup' && !gameMode && (
        <SetupScreen
          gameMode={gameMode}
          setGameMode={setGameMode}
          isLoggedIn={!!user}
          isGuestMode={isGuestMode}
          hasModelscopeToken={tokenStatus.hasToken}
          onConfigureToken={() => setShowTokenManager(true)}
          customRoleSelections={customRoleSelections}
          setCustomRoleSelections={setCustomRoleSelections}
          onBuildCustomSetup={setSelectedSetup}
          victoryMode={victoryMode}
          setVictoryMode={setVictoryMode}
        />
      )}

      {isPlayRoute && (phase !== 'setup' || gameMode) && (
        <GameArena
          players={players} userPlayer={userPlayer} phase={phase}
          dayCount={dayCount} nightStep={nightStep} nightDecisions={nightDecisions}
          speechHistory={speechHistory} nightActionHistory={nightActionHistory}
          voteHistory={voteHistory} deathHistory={deathHistory}
          seerChecks={seerChecks} guardHistory={guardHistory}
          witchHistory={witchHistory} magicianHistory={magicianHistory}
          currentPhaseData={currentPhaseData}
          gameBackground={gameBackground} logs={logs} modelUsage={modelUsage}
          selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
          speakerIndex={speakerIndex}
          gameMode={gameMode} isThinking={isThinking}
          speakingOrder={speakingOrder} setSpeakingOrder={setSpeakingOrder}
          userInput={userInput} setUserInput={setUserInput}
          handleUserSpeak={handleUserSpeak}
          hunterShooting={hunterShooting}
          handleUserHunterShoot={handleUserHunterShoot}
          handleAIHunterShoot={handleAIHunterShoot}
          handleVote={handleVote}
          proceedNight={proceedNight}
          mergeNightDecisions={mergeNightDecisions}
          setPlayers={setPlayers} setUserPlayer={setUserPlayer}
          witchHistorySetter={setWitchHistory}
          magicianHistorySetter={setMagicianHistory}
          getPlayer={getPlayer} addLog={addLog} setSeerChecks={setSeerChecks}
          currentNightSequence={currentNightSequence}
          ROLE_DEFINITIONS={ROLE_DEFINITIONS}
          getCurrentNightRole={getCurrentNightRole}
          isUserTurn={isUserTurn}
          exportGameLog={exportGameLog}
          restartGame={restartGame}
          AI_MODELS={aiModels}
        />
      )}
    </div>
  );
}
