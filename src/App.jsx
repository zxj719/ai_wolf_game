import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { logger } from './utils/logger';
import { useWerewolfGame } from './useWerewolfGame';
import { useAuth } from './contexts/AuthContext';
import { saveGameRecord } from './services/gameService';
import { submitGameLog } from './services/submitGameLog';
import { authService } from './services/authService';
import {
  ROLE_DEFINITIONS,
  STANDARD_ROLES,
  GAME_SETUPS,
  PERSONALITIES,
  NAMES,
  DEFAULT_TOTAL_PLAYERS,
  DEFAULT_CUSTOM_SELECTIONS,
  DEFAULT_VICTORY_MODE,
} from './config/roles';
import { API_KEY, API_URL } from './config/aiConfig';
import { useAI } from './hooks/useAI';
import { useDayFlow } from './hooks/useDayFlow';
import { useNightFlow } from './hooks/useNightFlow';
import { useSpeechFlow } from './hooks/useSpeechFlow';
import { useAppRouter, ROUTES } from './hooks/useAppRouter';
import { useAIModels } from './hooks/useAIModels';
import { abortAllRequests, resetAbortController } from './services/aiClient';
import {
  checkGameEnd as checkGameEndUtil,
  getPlayer as getPlayerUtil,
  isUserTurn as isUserTurnUtil,
  getCurrentNightRole as getCurrentNightRoleUtil,
} from './utils/gameUtils';
import { exportGameLog as exportGameLogUtil } from './utils/exportGameLog';
import { LanguageToggle } from './components/LanguageToggle';
import { getUiCopy, readStoredLocale, writeStoredLocale } from './i18n/locale.js';

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

function FullPageLoader({ text = 'Loading...' }) {
  return (
    <div className="mac-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="mac-window px-8 py-6 text-sm text-slate-500">{text}</div>
    </div>
  );
}

function InlineLoader({ text = 'Loading...' }) {
  return <div className="w-full py-14 text-center text-slate-500">{text}</div>;
}

function LocaleOverlay({ locale, onChange, label }) {
  return (
    <div className="mac-floating-toolbar">
      <LanguageToggle locale={locale} onChange={onChange} label={label} />
    </div>
  );
}

export default function App() {
  const { user, loading: authLoading, logout, modelscopeToken, tokenStatus, verifyModelscopeToken } = useAuth();

  const [locale, setLocale] = useState(() => readStoredLocale());
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

  const nightDecisionsRef = useRef(null);
  const gameActiveRef = useRef(false);
  const gameStateRef = useRef(null);

  const {
    state,
    setPhase,
    setNightStep,
    setDayCount,
    setPlayers,
    setUserPlayer,
    mergeNightDecisions,
    setSeerChecks,
    setGuardHistory,
    setWitchHistory,
    setMagicianHistory,
    dreamweaverHistory,
    setDreamweaverHistory,
    setSpeechHistory,
    setVoteHistory,
    setDeathHistory,
    addCurrentPhaseSpeech,
    addCurrentPhaseAction,
    clearCurrentPhaseData,
    setLogs,
    addLog,
    initGame,
    processedVoteDayRef,
    gameInitializedRef,
    updatePlayerModel,
    updateActionResult,
  } = useWerewolfGame({
    ROLE_DEFINITIONS,
    STANDARD_ROLES,
    GAME_SETUPS,
    PERSONALITIES,
    NAMES,
    TOTAL_PLAYERS: DEFAULT_TOTAL_PLAYERS,
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
    magicianHistory,
    speechHistory,
    voteHistory,
    deathHistory,
    nightActionHistory,
    currentPhaseData,
    gameBackground,
    modelUsage,
  } = state;

  const { aiModels, disabledModelsRef } = useAIModels();

  const isGameActive = phase !== 'setup' || !!gameMode;
  const currentNightSequence = selectedSetup.NIGHT_SEQUENCE || ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];
  const effectiveApiKey = modelscopeToken || API_KEY;
  const ui = getUiCopy(locale);

  nightDecisionsRef.current = nightDecisions;

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

  const { navigate, isHomeRoute, isWolfgameRoute, isCustomRoute, isPlayRoute, isSitesRoute, isAuthed } = useAppRouter({
    user,
    isGuestMode,
    isGameActive,
    endGame,
    gameMode,
    phase,
  });

  useEffect(() => {
    const pageMeta = (() => {
      if (!isAuthed) {
        return {
          title: ui.app.authTitle,
          description: ui.app.authDescription,
        };
      }
      if (isHomeRoute) {
        return {
          title: ui.app.homeTitle,
          description: ui.app.homeDescription,
        };
      }
      if (isWolfgameRoute) {
        return {
          title: ui.app.homeTitle,
          description: ui.app.homeDescription,
        };
      }
      if (isCustomRoute) {
        return {
          title: ui.app.setupTitle,
          description: ui.app.setupDescription,
        };
      }
      if (isPlayRoute) {
        return {
          title: ui.app.playTitle(dayCount),
          description: ui.app.playDescription,
        };
      }
      if (isSitesRoute) {
        return {
          title: ui.app.sitesTitle,
          description: ui.app.sitesDescription,
        };
      }
      return {
        title: ui.app.defaultTitle,
        description: ui.app.defaultDescription,
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
  }, [dayCount, isAuthed, isCustomRoute, isHomeRoute, isPlayRoute, isSitesRoute, isWolfgameRoute, ui.app]);

  useEffect(() => {
    if (user && isGuestMode) {
      setIsGuestMode(false);
    }
  }, [user, isGuestMode]);

  useEffect(() => {
    gameActiveRef.current = isGameActive;
  }, [isGameActive]);

  useEffect(() => {
    writeStoredLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

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

  useEffect(() => {
    if (gameMode) {
      resetAbortController();
      gameActiveRef.current = true;
      initGame(gameMode, selectedSetup);
      setGameStartTime(Date.now());
    }
  }, [gameMode, initGame, selectedSetup]);

  useEffect(() => {
    if (!gameResult || !gameMode) return;

    const saveRecord = async () => {
      if (user && !isGuestMode) {
        try {
          const currentUserPlayer = players.find((player) => player.isUser);
          const duration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
          await saveGameRecord({
            role: currentUserPlayer?.role || '观战',
            result:
              gameResult === 'good_win'
                ? currentUserPlayer?.role === ROLE_DEFINITIONS.WEREWOLF ? 'lose' : 'win'
                : currentUserPlayer?.role === ROLE_DEFINITIONS.WEREWOLF ? 'win' : 'lose',
            game_mode: gameMode,
            duration_seconds: duration,
          });
        } catch (error) {
          logger.error('[stats] save failed:', error);
        }
      }

      if (modelUsage?.playerModels && modelUsage.gameSessionId) {
        try {
          const durationSeconds = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
          const modelPlayers = players
            .filter((player) => modelUsage.playerModels[player.id]?.modelId)
            .map((player) => ({
              playerId: player.id,
              role: player.role,
              modelId: modelUsage.playerModels[player.id].modelId,
              modelName: modelUsage.playerModels[player.id].modelName || modelUsage.playerModels[player.id].modelId,
              result:
                gameResult === 'good_win'
                  ? player.role === ROLE_DEFINITIONS.WEREWOLF ? 'lose' : 'win'
                  : player.role === ROLE_DEFINITIONS.WEREWOLF ? 'win' : 'lose',
            }));

          if (modelPlayers.length > 0) {
            await authService.submitModelStats({
              gameSessionId: modelUsage.gameSessionId,
              gameMode,
              durationSeconds,
              result: gameResult,
              players: modelPlayers,
            });
          }
        } catch (error) {
          logger.error('[model stats] submit failed:', error);
        }
      }
    };

    saveRecord();
  }, [gameMode, gameResult, gameStartTime, isGuestMode, modelUsage, players, user]);

  useEffect(() => {
    gameStateRef.current = state;
  });

  useEffect(() => {
    if (!gameResult || !gameStateRef.current) return;

    submitGameLog(gameStateRef.current, {
      onError: (message) => logger.error('[game log] submit failed:', message),
    });
  }, [gameResult]);

  const checkGameEnd = useCallback(
    (currentPlayers = players) => checkGameEndUtil(currentPlayers, victoryMode, addLog, setGameResult),
    [players, victoryMode, addLog]
  );

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
    API_KEY: effectiveApiKey,
    AI_MODELS: aiModels,
    gameSetup: selectedSetup,
    nightActionHistory,
    onModelUsed: updatePlayerModel,
    victoryMode,
    gameActiveRef,
  });

  const {
    startDayDiscussion,
    handleAutoVote,
    handleVote,
    handleUserHunterShoot,
    handleAIHunterShoot,
    moveToNextSpeaker,
    proceedToNextNight,
  } = useDayFlow({
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
    gameActiveRef,
  });

  const { proceedNight } = useNightFlow({
    players,
    setPlayers,
    gameMode,
    addLog,
    addCurrentPhaseAction,
    updateActionResult,
    ROLE_DEFINITIONS,
    setPhase,
    phase,
    nightStep,
    setNightStep,
    dayCount,
    nightDecisions,
    nightDecisionsRef,
    mergeNightDecisions,
    seerChecks,
    setSeerChecks,
    guardHistory,
    setGuardHistory,
    witchHistory,
    setWitchHistory,
    magicianHistory,
    setMagicianHistory,
    dreamweaverHistory,
    setDreamweaverHistory,
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
    handleAIHunterShoot,
    userPlayer,
    gameActiveRef,
  });

  const { handleUserSpeak, handleUserDuel } = useSpeechFlow({
    phase,
    players,
    setPlayers,
    gameMode,
    dayCount,
    speakerIndex,
    setSpeakerIndex,
    speechHistory,
    setSpeechHistory,
    userPlayer,
    userInput,
    setUserInput,
    addLog,
    addCurrentPhaseSpeech,
    setPhase,
    askAI,
    moveToNextSpeaker,
    gameActiveRef,
    ROLE_DEFINITIONS,
    setDeathHistory,
    checkGameEnd,
    proceedToNextNight,
  });

  useEffect(() => {
    if (phase === 'day_voting' && !isThinking) {
      const currentUserAlive = players.find((player) => player.id === 0)?.isAlive;
      if (!currentUserAlive || gameMode === 'ai-only') {
        handleAutoVote();
      }
    }
  }, [gameMode, handleAutoVote, isThinking, phase, players]);

  const getPlayer = (id) => getPlayerUtil(players, id);
  const isUserTurn = () => isUserTurnUtil(userPlayer, nightStep, currentNightSequence);
  const getCurrentNightRole = () => getCurrentNightRoleUtil(nightStep, currentNightSequence);

  const exportGameLog = () => exportGameLogUtil({
    players,
    dayCount,
    deathHistory,
    speechHistory,
    voteHistory,
    seerChecks,
    guardHistory,
    witchHistory,
    victoryMode,
  });

  const restartGame = () => {
    endGame();
    navigate(ROUTES.CUSTOM, { replace: true });
  };

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
    if (user || isGuestMode) {
      navigate(ROUTES.CUSTOM);
      return;
    }
    handleGuestWolfgame();
  }, [handleGuestWolfgame, isGuestMode, navigate, user]);

  const handleEnterWolfgameSetup = useCallback(() => {
    navigate(ROUTES.CUSTOM);
  }, [navigate]);

  const handleEnterSites = useCallback(() => {
    navigate(ROUTES.SITES);
  }, [navigate]);

  const routeToolbar = (isCustomRoute || isPlayRoute) ? (
    <div className="mac-floating-toolbar flex-wrap justify-end">
      {(isCustomRoute || isPlayRoute) && (
        <button type="button" onClick={handleExitToHome} className="mac-button mac-button-secondary">
          {isPlayRoute ? ui.app.endAndHome : ui.app.backHome}
        </button>
      )}
      {isCustomRoute && !isGuestMode && user && (
        <>
          <button
            type="button"
            onClick={() => setShowTokenManager(true)}
            className={`mac-button ${tokenStatus.hasToken ? 'mac-button-secondary' : 'mac-button-ghost'}`}
          >
            {tokenStatus.hasToken ? ui.app.tokenReady : ui.app.tokenNeeded}
          </button>
          <button type="button" onClick={() => setShowStats(true)} className="mac-button mac-button-secondary">
            {ui.app.stats}
          </button>
          <button type="button" onClick={handleLogout} className="mac-button mac-button-secondary">
            {ui.app.logout}
          </button>
        </>
      )}
      {isCustomRoute && isGuestMode && (
        <button type="button" onClick={handleGuestExitToLogin} className="mac-button mac-button-secondary">
          {ui.app.login}
        </button>
      )}
      <LanguageToggle locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
    </div>
  ) : null;

  if (authLoading) {
    return (
      <>
        <LocaleOverlay locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
        <FullPageLoader text={ui.common.loading} />
      </>
    );
  }

  if (isHomeRoute) {
    return (
      <div className="mac-app-shell">
        <LocaleOverlay locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
        <Suspense fallback={<FullPageLoader text={ui.common.loading} />}>
          <Dashboard
            locale={locale}
            onEnterWolfgame={handleEnterWolfgame}
            onEnterSites={handleEnterSites}
            onLogout={handleLogout}
            isGuestMode={isGuestMode}
            onLogin={isGuestMode ? handleGuestExitToLogin : handleGoToLogin}
            onGuestPlay={handleGuestPlay}
          />
        </Suspense>
      </div>
    );
  }

  if (isWolfgameRoute) {
    return (
      <div className="mac-app-shell">
        <LocaleOverlay locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
        <Suspense fallback={<FullPageLoader text={ui.common.loading} />}>
          <WolfgameHub
            locale={locale}
            onBackHome={handleExitToHome}
            onEnterWolfgame={handleEnterWolfgameSetup}
            onGuestWolfgame={handleGuestWolfgame}
            onLogin={isGuestMode ? handleGuestExitToLogin : handleGoToLogin}
            isGuestMode={isGuestMode}
          />
        </Suspense>
      </div>
    );
  }

  if (isSitesRoute) {
    return (
      <div className="mac-app-shell">
        <LocaleOverlay locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
        <Suspense fallback={<FullPageLoader text={ui.common.loading} />}>
          <SitesPage onBack={handleExitToHome} locale={locale} />
        </Suspense>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="mac-app-shell">
        <LocaleOverlay locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
        <Suspense fallback={<FullPageLoader text={ui.common.loading} />}>
          <AuthPage onGuestPlay={handleGuestPlay} locale={locale} />
        </Suspense>
      </div>
    );
  }

  if (!isCustomRoute && !isPlayRoute) {
    return null;
  }

  return (
    <div className="mac-app-shell relative">
      {routeToolbar}

      <Suspense fallback={null}>
        {showStats && <UserStats onClose={() => setShowStats(false)} locale={locale} />}
        {showTokenManager && (
          <TokenManager
            locale={locale}
            onClose={() => setShowTokenManager(false)}
            onTokenSaved={() => {
              setShowTokenManager(false);
              verifyModelscopeToken();
            }}
          />
        )}
      </Suspense>

      <main className="relative" aria-label={ui.app.defaultTitle}>
        {isCustomRoute && phase === 'setup' && !gameMode && (
          <Suspense fallback={<InlineLoader text={ui.app.loadingSetup} />}>
            <SetupScreen
              locale={locale}
              gameMode={gameMode}
              setGameMode={setGameMode}
              isLoggedIn={!!user}
              isGuestMode={isGuestMode}
              hasModelscopeToken={tokenStatus.hasToken}
              onConfigureToken={() => {
                if (isGuestMode) {
                  handleGuestExitToLogin();
                  return;
                }
                setShowTokenManager(true);
              }}
              customRoleSelections={customRoleSelections}
              setCustomRoleSelections={setCustomRoleSelections}
              onBuildCustomSetup={setSelectedSetup}
              victoryMode={victoryMode}
              setVictoryMode={setVictoryMode}
            />
          </Suspense>
        )}

        {isPlayRoute && (phase !== 'setup' || gameMode) && (
          <Suspense fallback={<InlineLoader text={ui.app.loadingGame} />}>
            <GameArena
              locale={locale}
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
              magicianHistory={magicianHistory}
              dreamweaverHistory={dreamweaverHistory}
              currentPhaseData={currentPhaseData}
              gameBackground={gameBackground}
              logs={logs}
              modelUsage={modelUsage}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              speakerIndex={speakerIndex}
              gameMode={gameMode}
              isThinking={isThinking}
              speakingOrder={speakingOrder}
              setSpeakingOrder={setSpeakingOrder}
              userInput={userInput}
              setUserInput={setUserInput}
              handleUserSpeak={handleUserSpeak}
              hunterShooting={hunterShooting}
              handleUserHunterShoot={handleUserHunterShoot}
              handleUserDuel={handleUserDuel}
              handleAIHunterShoot={handleAIHunterShoot}
              handleVote={handleVote}
              proceedNight={proceedNight}
              mergeNightDecisions={mergeNightDecisions}
              setPlayers={setPlayers}
              setUserPlayer={setUserPlayer}
              witchHistorySetter={setWitchHistory}
              magicianHistorySetter={setMagicianHistory}
              dreamweaverHistorySetter={setDreamweaverHistory}
              getPlayer={getPlayer}
              addLog={addLog}
              setSeerChecks={setSeerChecks}
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
