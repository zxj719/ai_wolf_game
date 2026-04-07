import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { logger } from './utils/logger';
import { useWerewolfGame } from './useWerewolfGame';
import { useAuth } from './contexts/AuthContext';
import { saveGameRecord } from './services/gameService';
import { submitGameLog } from './services/submitGameLog';
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
const SITE_BASE_URL = 'https://zhaxiaoji.com';

const SetupScreen = lazy(() =>
  import('./components/SetupScreen').then((module) => ({ default: module.SetupScreen }))
);
const GameArena = lazy(() =>
  import('./components/GameArena').then((module) => ({ default: module.GameArena }))
);
const AuthPage = lazy(() =>
  import('./components/Auth').then((module) => ({ default: module.AuthPage }))
);
const Dashboard = lazy(() =>
  import('./components/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const WolfgameHub = lazy(() =>
  import('./components/WolfgameHub').then((module) => ({ default: module.WolfgameHub }))
);
const SitesPage = lazy(() =>
  import('./components/SitesPage').then((module) => ({ default: module.SitesPage }))
);
const TokenManager = lazy(() =>
  import('./components/TokenManager').then((module) => ({ default: module.TokenManager }))
);
const UserStats = lazy(() =>
  import('./components/UserStats').then((module) => ({ default: module.UserStats }))
);

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-zinc-400">加载中...</div>
    </div>
  );
}

function InlineLoader({ text = '加载中...' }) {
  return (
    <div className="w-full py-14 text-center text-zinc-500">{text}</div>
  );
}

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
  const gameStateRef = useRef(null);

  // --- Game state (reducer) ---
  const {
    state,
    setPhase, setNightStep, setDayCount, setPlayers, setUserPlayer,
    setNightDecisions, mergeNightDecisions,
    setSeerChecks, setGuardHistory, setWitchHistory, setMagicianHistory,
    dreamweaverHistory, setDreamweaverHistory,
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
    navigate, isHomeRoute, isWolfgameRoute, isCustomRoute, isPlayRoute, isSitesRoute, isAuthed,
  } = useAppRouter({ user, isGuestMode, isGameActive, endGame, gameMode, phase });

  // --- Route meta for SPA SEO ---
  useEffect(() => {
    const pageMeta = (() => {
      if (isHomeRoute) {
        return {
          title: 'Zhaxiaoji Studio | 个人主页',
          description: 'Zhaxiaoji Studio 主页，公开展示个人项目入口，并保留狼人杀、游客试玩与登录能力。'
        };
      }
      if (isWolfgameRoute) {
        return {
          title: 'AI 狼人杀 | Zhaxiaoji Studio',
          description: '了解 AI 狼人杀玩法，从游客试玩或登录后进入对局，并统一访问战绩与令牌入口。'
        };
      }
      if (isSitesRoute) {
        return {
          title: 'Projects & Labs | Zhaxiaoji Studio',
          description: '统一访问 Zhaxiaoji Studio 的项目、实验和工具入口。'
        };
      }
      if (isCustomRoute) {
        return {
          title: '游戏设置 | Zhaxiaoji Studio',
          description: '配置狼人杀角色阵容与胜利条件，开始游客、人机或全 AI 对局。'
        };
      }
      if (isPlayRoute) {
        return {
          title: `对局进行中（第${dayCount}天）| Zhaxiaoji Studio`,
          description: '狼人杀对局进行中，继续查看发言、投票、结算与模型使用情况。'
        };
      }
      if (!isAuthed) {
        return {
          title: '登录 | Zhaxiaoji Studio',
          description: '登录 Zhaxiaoji Studio，保存狼人杀战绩与令牌配置。'
        };
      }
      return {
        title: 'Zhaxiaoji Studio',
        description: 'Zhaxiaoji Studio 个人主页与 AI 狼人杀入口。'
      };
    })();

    const canonicalUrl = `${SITE_BASE_URL}${window.location.pathname}`;
    document.title = pageMeta.title;

    const updateMetaContent = (selector, content) => {
      const element = document.querySelector(selector);
      if (element) {
        element.setAttribute('content', content);
      }
    };

    updateMetaContent('meta[name="description"]', pageMeta.description);
    updateMetaContent('meta[property="og:title"]', pageMeta.title);
    updateMetaContent('meta[property="og:description"]', pageMeta.description);
    updateMetaContent('meta[property="og:url"]', canonicalUrl);
    updateMetaContent('meta[name="twitter:title"]', pageMeta.title);
    updateMetaContent('meta[name="twitter:description"]', pageMeta.description);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', canonicalUrl);
    }
  }, [dayCount, isAuthed, isCustomRoute, isHomeRoute, isPlayRoute, isSitesRoute, isWolfgameRoute]);

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

  // --- Game result: save record ---
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
    };
    saveRecord();
  }, [gameResult]);

  // --- Game state ref: keep latest reducer state available for submitGameLog ---
  // Using a ref (not useEffect) avoids re-render on every state change.
  // Updated synchronously so submitGameLog always reads fresh data.
  useEffect(() => {
    gameStateRef.current = state;
  });

  // --- Game log review: submit full state to review pipeline on game end ---
  useEffect(() => {
    if (!gameResult || !gameStateRef.current) return;

    submitGameLog(gameStateRef.current, {
      onError: (msg) => logger.error('[游戏日志] 提交失败:', msg),
    });
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
    handlePlayerElimination, moveToNextSpeaker, proceedToNextNight,
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
    dreamweaverHistory, setDreamweaverHistory,
    deathHistory, setDeathHistory,
    selectedTarget, setSelectedTarget, setHunterShooting,
    checkGameEnd, askAI, setIsThinking, currentNightSequence,
    startDayDiscussion, handleAIHunterShoot, userPlayer, gameActiveRef,
  });

  // --- Speech flow ---
  const { handleUserSpeak, handleUserDuel } = useSpeechFlow({
    phase, players, setPlayers, gameMode, dayCount, speakerIndex, setSpeakerIndex,
    speechHistory, setSpeechHistory, userPlayer, userInput, setUserInput,
    addLog, addCurrentPhaseSpeech, setPhase, askAI, moveToNextSpeaker, gameActiveRef,
    ROLE_DEFINITIONS, setDeathHistory, checkGameEnd, proceedToNextNight,
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

  const handleGuestWolfgame = useCallback(() => {
    setIsGuestMode(true);
    navigate(ROUTES.CUSTOM, { replace: true });
  }, [navigate]);

  const handleGuestExitToLogin = useCallback(() => {
    endGame();
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [endGame, navigate]);

  const handleGoToLogin = useCallback(() => {
    navigate(ROUTES.LOGIN);
  }, [navigate]);

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
    navigate(ROUTES.WOLFGAME);
  }, [navigate]);

  const handleEnterWolfgameSetup = useCallback(() => {
    navigate(ROUTES.CUSTOM);
  }, [navigate]);

  const handleEnterSites = useCallback(() => {
    navigate(ROUTES.SITES);
  }, [navigate]);

  // ===================== RENDER =====================

  if (authLoading) {
    return <FullPageLoader />;
  }

  if (isHomeRoute) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <Dashboard
          onEnterWolfgame={handleEnterWolfgame}
          onEnterSites={handleEnterSites}
          onLogout={handleLogout}
          isGuestMode={isGuestMode}
          onLogin={isGuestMode ? handleGuestExitToLogin : handleGoToLogin}
          onGuestPlay={handleGuestPlay}
        />
      </Suspense>
    );
  }

  if (isWolfgameRoute) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <WolfgameHub
          onBackHome={handleExitToHome}
          onEnterWolfgame={handleEnterWolfgameSetup}
          onGuestWolfgame={handleGuestWolfgame}
          onLogin={isGuestMode ? handleGuestExitToLogin : handleGoToLogin}
          isGuestMode={isGuestMode}
        />
      </Suspense>
    );
  }

  if (isSitesRoute) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <SitesPage onBack={handleExitToHome} />
      </Suspense>
    );
  }

  if (!isAuthed) {
    return (
      <Suspense fallback={<FullPageLoader />}>
        <AuthPage onGuestPlay={handleGuestPlay} />
      </Suspense>
    );
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
            aria-label="返回主页"
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            返回主页
          </button>
          {!isGuestMode && user && (
            <>
              <button
                onClick={() => setShowTokenManager(true)}
                aria-label={tokenStatus.hasToken ? '查看令牌配置状态' : '打开令牌配置'}
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
                aria-label="查看战绩"
                className="px-3 py-1 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
              >
                战绩
              </button>
              <button
                onClick={handleLogout}
                aria-label="退出登录"
                className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
              >
                登出
              </button>
            </>
          )}
          {isGuestMode && (
            <button
              onClick={handleGuestExitToLogin}
              aria-label="前往登录"
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
            aria-label="结束游戏并返回主页"
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            结束并返回主页
          </button>
        </div>
      )}

      <Suspense fallback={null}>
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
      </Suspense>

      <main className="relative" aria-label="狼人杀主内容区">
        {isCustomRoute && phase === 'setup' && !gameMode && (
          <Suspense fallback={<InlineLoader text="正在加载游戏设置..." />}>
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
          </Suspense>
        )}

        {isPlayRoute && (phase !== 'setup' || gameMode) && (
          <Suspense fallback={<InlineLoader text="正在加载对局..." />}>
            <GameArena
              players={players} userPlayer={userPlayer} phase={phase}
              dayCount={dayCount} nightStep={nightStep} nightDecisions={nightDecisions}
              speechHistory={speechHistory} nightActionHistory={nightActionHistory}
              voteHistory={voteHistory} deathHistory={deathHistory}
              seerChecks={seerChecks} guardHistory={guardHistory}
              witchHistory={witchHistory} magicianHistory={magicianHistory}
              dreamweaverHistory={dreamweaverHistory}
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
              handleUserDuel={handleUserDuel}
              handleAIHunterShoot={handleAIHunterShoot}
              handleVote={handleVote}
              proceedNight={proceedNight}
              mergeNightDecisions={mergeNightDecisions}
              setPlayers={setPlayers} setUserPlayer={setUserPlayer}
              witchHistorySetter={setWitchHistory}
              magicianHistorySetter={setMagicianHistory}
              dreamweaverHistorySetter={setDreamweaverHistory}
              getPlayer={getPlayer} addLog={addLog} setSeerChecks={setSeerChecks}
              currentNightSequence={currentNightSequence}
              ROLE_DEFINITIONS={ROLE_DEFINITIONS}
              getCurrentNightRole={getCurrentNightRole}
              isUserTurn={isUserTurn}
              exportGameLog={exportGameLog}
              restartGame={restartGame}
              AI_MODELS={aiModels}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
