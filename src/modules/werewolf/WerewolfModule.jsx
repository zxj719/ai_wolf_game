import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { logger } from '../../utils/logger';
import { useWerewolfGame } from '../../useWerewolfGame';
import { useAuth } from '../../contexts/AuthContext';
import { saveGameRecord } from '../../services/gameService';
import { submitGameLog } from '../../services/submitGameLog';
import { authService } from '../../services/authService';
import {
  clearWerewolfGameSnapshot,
  createWerewolfGameSnapshot,
  loadWerewolfGameSnapshot,
  saveWerewolfGameSnapshot,
} from '../../services/werewolfGameSnapshot';
import {
  ROLE_DEFINITIONS,
  STANDARD_ROLES,
  GAME_SETUPS,
  PERSONALITIES,
  NAMES,
  DEFAULT_TOTAL_PLAYERS,
  DEFAULT_CUSTOM_SELECTIONS,
  DEFAULT_VICTORY_MODE,
} from '../../config/roles';
import { API_KEY, API_URL, WEREWOLF_AI_MODE, WEREWOLF_SESSION_MODELS } from '../../config/aiConfig';
import { useAI } from '../../hooks/useAI';
import { useDayFlow } from '../../hooks/useDayFlow';
import { useNightFlow } from '../../hooks/useNightFlow';
import { useSpeechFlow } from '../../hooks/useSpeechFlow';
import { useAIModels } from '../../hooks/useAIModels';
import { abortAllRequests, resetAbortController } from '../../services/aiClient';
import {
  checkGameEnd as checkGameEndUtil,
  getPlayer as getPlayerUtil,
  isUserTurn as isUserTurnUtil,
  getCurrentNightRole as getCurrentNightRoleUtil,
} from '../../utils/gameUtils';
import { exportGameLog as exportGameLogUtil } from '../../utils/exportGameLog';
import { getUiCopy } from '../../i18n/locale.js';
import { LanguageToggle } from '../../components/LanguageToggle';
import { useShell } from '../../shell/ShellContext';
import { useAuthNav } from '../../shell/useAuthNav';
import { ROUTES } from '../../shell/paths';

const SetupScreen = lazy(() =>
  import('../../components/SetupScreen').then((m) => ({ default: m.SetupScreen }))
);
const GameArena = lazy(() =>
  import('../../components/GameArena').then((m) => ({ default: m.GameArena }))
);
const WolfgameHub = lazy(() =>
  import('../../components/WolfgameHub').then((m) => ({ default: m.WolfgameHub }))
);
const TokenManager = lazy(() =>
  import('../../components/TokenManager').then((m) => ({ default: m.TokenManager }))
);
const UserStats = lazy(() =>
  import('../../components/UserStats').then((m) => ({ default: m.UserStats }))
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

/**
 * WerewolfModule — 狼人杀业务模块的唯一根组件。
 *
 * Registry 里 /werewolf、/werewolf/setup、/werewolf/play 三条路由都指向
 * 本组件，React 视为同一 element 类型 → 跨路径切换时不会 unmount，游戏
 * 状态自然保留。内部按 currentPath 决定渲染 hub / setup / play 哪个子视图。
 *
 * 离开 /werewolf/* 进入其它模块时 Router 会换渲染另一个组件 → 本组件
 * unmount，在 useEffect 清理里调 endGame() 做一次性扫尾。不依赖 descriptor
 * 上的可变 runtime handle。
 */
export default function WerewolfModule() {
  const {
    locale,
    setLocale,
    currentPath,
    navigate,
    isGuestMode,
    setIsGuestMode,
    showTokenManager,
    showStats,
    openTokenManager,
    closeTokenManager,
    openStats,
    closeStats,
  } = useShell();

  const { user, logout, modelscopeToken, tokenStatus, verifyModelscopeToken } = useAuth();
  const { enterGuestMode, handleLogout: baseHandleLogout } = useAuthNav({ navigate, logout, setIsGuestMode });
  const ui = getUiCopy(locale);

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
  const [customRoleSelections, setCustomRoleSelections] = useState(DEFAULT_CUSTOM_SELECTIONS);
  const [victoryMode, setVictoryMode] = useState(DEFAULT_VICTORY_MODE);
  const [pendingSnapshot, setPendingSnapshot] = useState(null);

  const nightDecisionsRef = useRef(null);
  const gameActiveRef = useRef(false);
  const gameStateRef = useRef(null);
  const initGameRef = useRef(null);
  const restoringSnapshotRef = useRef(false);

  const {
    state,
    setPhase, setNightStep, setDayCount,
    setPlayers, setUserPlayer,
    mergeNightDecisions, setSeerChecks, setGuardHistory, setWitchHistory, setMagicianHistory,
    dreamweaverHistory, setDreamweaverHistory,
    setSpeechHistory, setVoteHistory, setDeathHistory,
    addCurrentPhaseSpeech, clearCurrentPhaseData,
    setLogs, addLog, initGame, hydrateGameState,
    processedVoteDayRef, gameInitializedRef,
    updatePlayerModel, updateActionResult,
    // 柱一：幂等原子 action
    killPlayer, recordVoteRound, recordSpeech, recordNightAction,
    // 柱三：结构化声明事件
    recordClaim,
  } = useWerewolfGame({
    ROLE_DEFINITIONS, STANDARD_ROLES, GAME_SETUPS, PERSONALITIES, NAMES,
    TOTAL_PLAYERS: DEFAULT_TOTAL_PLAYERS,
  });

  const {
    phase, nightStep, dayCount, players, userPlayer, logs,
    nightDecisions, seerChecks, guardHistory, witchHistory, magicianHistory,
    speechHistory, voteHistory, deathHistory, nightActionHistory,
    claimHistory,
    currentPhaseData, gameBackground, modelUsage,
  } = state;

  const { aiModels, disabledModelsRef } = useAIModels();

  const isHubRoute   = currentPath === ROUTES.WEREWOLF;
  const isSetupRoute = currentPath === ROUTES.WEREWOLF_SETUP;
  const isPlayRoute  = currentPath === ROUTES.WEREWOLF_PLAY;
  const isGameActive = phase !== 'setup' || !!gameMode;
  const currentNightSequence = selectedSetup.NIGHT_SEQUENCE || ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'];
  const usesServerSessionAI = WEREWOLF_AI_MODE === 'session' || WEREWOLF_AI_MODE === 'claude-session';
  const serverSessionModel = WEREWOLF_SESSION_MODELS[0];
  const effectiveApiKey = usesServerSessionAI ? '' : (modelscopeToken || API_KEY);

  nightDecisionsRef.current = nightDecisions;
  initGameRef.current = initGame;

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
    closeStats();
    closeTokenManager();
  }, [clearCurrentPhaseData, setDayCount, setLogs, setNightStep, setPhase, closeStats, closeTokenManager,
      processedVoteDayRef, gameInitializedRef]);

  const snapshotCurrentGame = useCallback(() => {
    if (gameResult) return false;
    const snapshot = createWerewolfGameSnapshot({
      state: gameStateRef.current || state,
      moduleState: {
        gameMode,
        selectedSetup,
        customRoleSelections,
        victoryMode,
        gameStartTime,
        hunterShooting,
        selectedTarget,
        speakerIndex,
        speakingOrder,
        spokenCount,
        userInput,
        gameResult,
      },
    });
    if (!snapshot) return false;
    const saved = saveWerewolfGameSnapshot({ user, isGuestMode, snapshot });
    if (saved) setPendingSnapshot(snapshot);
    return saved;
  }, [
    customRoleSelections,
    gameMode,
    gameResult,
    gameStartTime,
    hunterShooting,
    isGuestMode,
    selectedSetup,
    selectedTarget,
    speakerIndex,
    speakingOrder,
    spokenCount,
    state,
    user,
    userInput,
    victoryMode,
  ]);

  const snapshotCurrentGameRef = useRef(snapshotCurrentGame);
  useEffect(() => { snapshotCurrentGameRef.current = snapshotCurrentGame; }, [snapshotCurrentGame]);

  // === 卸载时兜底：离开 werewolf/* 到别的模块，组件 unmount → 清理游戏 ===
  const endGameRef = useRef(endGame);
  useEffect(() => { endGameRef.current = endGame; }, [endGame]);
  useEffect(() => {
    return () => {
      if (gameActiveRef.current) {
        snapshotCurrentGameRef.current?.();
        endGameRef.current?.();
      }
    };
  }, []);

  // === 路径内部跳转副作用（替代 useAppRouter 里的 PLAY/CUSTOM 关联效果）===
  useEffect(() => {
    if (gameMode && isSetupRoute) {
      navigate(ROUTES.WEREWOLF_PLAY, { replace: true });
    }
  }, [gameMode, isSetupRoute, navigate]);

  useEffect(() => {
    if (isPlayRoute && !gameMode && phase === 'setup') {
      navigate(ROUTES.WEREWOLF_SETUP, { replace: true });
    }
  }, [gameMode, isPlayRoute, navigate, phase]);

  // === 游戏生命周期 ===
  useEffect(() => {
    gameActiveRef.current = isGameActive;
  }, [isGameActive]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      snapshotCurrentGameRef.current?.();
      abortAllRequests();
    };
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
      if (restoringSnapshotRef.current) {
        restoringSnapshotRef.current = false;
        return;
      }
      initGameRef.current(gameMode, selectedSetup);
      setGameStartTime(Date.now());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, selectedSetup]);

  useEffect(() => {
    if (!gameResult || !gameMode) return;
    const saveRecord = async () => {
      if (user && !isGuestMode) {
        try {
          const currentUserPlayer = players.find((p) => p.isUser);
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
        } catch (e) { logger.error('[stats] save failed:', e); }
      }
      if (modelUsage?.playerModels && modelUsage.gameSessionId) {
        try {
          const durationSeconds = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
          const modelPlayers = players
            .filter((p) => modelUsage.playerModels[p.id]?.modelId)
            .map((p) => ({
              playerId: p.id,
              role: p.role,
              modelId: modelUsage.playerModels[p.id].modelId,
              modelName: modelUsage.playerModels[p.id].modelName || modelUsage.playerModels[p.id].modelId,
              result:
                gameResult === 'good_win'
                  ? p.role === ROLE_DEFINITIONS.WEREWOLF ? 'lose' : 'win'
                  : p.role === ROLE_DEFINITIONS.WEREWOLF ? 'win' : 'lose',
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
        } catch (e) { logger.error('[model stats] submit failed:', e); }
      }
    };
    saveRecord();
  }, [gameMode, gameResult, gameStartTime, isGuestMode, modelUsage, players, user]);

  useEffect(() => { gameStateRef.current = state; });

  useEffect(() => {
    if (phase !== 'setup' || gameMode) return;
    setPendingSnapshot(loadWerewolfGameSnapshot({ user, isGuestMode }));
  }, [gameMode, isGuestMode, phase, user]);

  useEffect(() => {
    if (!gameResult) return;
    clearWerewolfGameSnapshot({ user, isGuestMode });
    setPendingSnapshot(null);
  }, [gameResult, isGuestMode, user]);

  useEffect(() => {
    if (!gameResult || !gameStateRef.current) return;
    submitGameLog(gameStateRef.current, {
      onError: (msg) => logger.error('[game log] submit failed:', msg),
    });
  }, [gameResult]);

  // === AI / 白天 / 夜晚 / 发言流 ===
  const checkGameEnd = useCallback(
    (currentPlayers = players) => checkGameEndUtil(currentPlayers, victoryMode, addLog, setGameResult),
    [players, victoryMode, addLog]
  );

  const { askAI } = useAI({
    players, speechHistory, voteHistory, deathHistory, nightDecisions,
    seerChecks, guardHistory, witchHistory, dayCount, phase,
    setIsThinking, disabledModelsRef, API_URL, API_KEY: effectiveApiKey,
    AI_MODELS: aiModels, gameSetup: selectedSetup, nightActionHistory,
    claimHistory,
    onModelUsed: updatePlayerModel, gameSessionId: modelUsage.gameSessionId, victoryMode, gameActiveRef,
  });

  const {
    startDayDiscussion, handleAutoVote, handleVote,
    handleUserHunterShoot, handleAIHunterShoot,
    moveToNextSpeaker, proceedToNextNight,
  } = useDayFlow({
    players, setPlayers, gameMode, addLog,
    ROLE_DEFINITIONS, setPhase, setNightStep, nightDecisions, mergeNightDecisions,
    dayCount, setDayCount, seerChecks, speechHistory, setSpeechHistory,
    voteHistory, setVoteHistory, deathHistory, setDeathHistory,
    setHunterShooting, selectedTarget, setSelectedTarget,
    speakerIndex, setSpeakerIndex, speakingOrder, setSpeakingOrder,
    spokenCount, setSpokenCount, userPlayer, isThinking, setIsThinking,
    checkGameEnd, askAI, clearCurrentPhaseData, gameActiveRef,
    killPlayer, recordVoteRound, recordNightAction,
  });

  const { proceedNight } = useNightFlow({
    players, setPlayers, gameMode, addLog, updateActionResult,
    ROLE_DEFINITIONS, setPhase, phase, nightStep, setNightStep, dayCount,
    nightDecisions, nightDecisionsRef, mergeNightDecisions,
    seerChecks, setSeerChecks, guardHistory, setGuardHistory,
    witchHistory, setWitchHistory, magicianHistory, setMagicianHistory,
    dreamweaverHistory, setDreamweaverHistory, deathHistory, setDeathHistory,
    selectedTarget, setSelectedTarget, setHunterShooting,
    checkGameEnd, askAI, setIsThinking, currentNightSequence,
    startDayDiscussion, handleAIHunterShoot, userPlayer, gameActiveRef,
    speechHistory,
    killPlayer, recordNightAction,
  });

  const { handleUserSpeak, handleUserDuel } = useSpeechFlow({
    phase, players, setPlayers, gameMode, dayCount,
    speakerIndex, setSpeakerIndex, speechHistory, setSpeechHistory,
    userPlayer, userInput, setUserInput, addLog, addCurrentPhaseSpeech,
    setPhase, askAI, moveToNextSpeaker, gameActiveRef, ROLE_DEFINITIONS,
    setDeathHistory, checkGameEnd, proceedToNextNight,
    killPlayer, recordSpeech,
    recordClaim,
  });

  useEffect(() => {
    if (phase === 'day_voting' && !isThinking) {
      const currentUserAlive = players.find((p) => p.id === 0)?.isAlive;
      if (!currentUserAlive || gameMode === 'ai-only') {
        handleAutoVote();
      }
    }
  }, [gameMode, handleAutoVote, isThinking, phase, players]);

  const getPlayer = (id) => getPlayerUtil(players, id);
  const isUserTurn = () => isUserTurnUtil(userPlayer, nightStep, currentNightSequence);
  const getCurrentNightRole = () => getCurrentNightRoleUtil(nightStep, currentNightSequence);

  const exportGameLog = () => exportGameLogUtil({
    players, dayCount, deathHistory, speechHistory, voteHistory,
    seerChecks, guardHistory, witchHistory, victoryMode,
    nightActionHistory,
  });

  const restartGame = () => {
    clearWerewolfGameSnapshot({ user, isGuestMode });
    setPendingSnapshot(null);
    endGame();
    navigate(ROUTES.WEREWOLF_SETUP, { replace: true });
  };

  // === Handlers ===
  const handleResumeSnapshot = useCallback(() => {
    const snapshot = pendingSnapshot || loadWerewolfGameSnapshot({ user, isGuestMode });
    if (!snapshot?.state) return;
    const moduleState = snapshot.moduleState || {};
    const hydratedState = usesServerSessionAI
      ? {
          ...snapshot.state,
          modelUsage: {
            ...(snapshot.state.modelUsage || {}),
            playerModels: Object.fromEntries(
              (snapshot.state.players || [])
                .filter((p) => !p.isUser)
                .map((p) => [p.id, {
                  modelId: serverSessionModel.id,
                  modelName: serverSessionModel.name,
                }])
            ),
          },
        }
      : snapshot.state;

    restoringSnapshotRef.current = true;
    resetAbortController();
    hydrateGameState(hydratedState);
    setGameMode(moduleState.gameMode || 'player');
    if (moduleState.selectedSetup) setSelectedSetup(moduleState.selectedSetup);
    if (moduleState.customRoleSelections) setCustomRoleSelections(moduleState.customRoleSelections);
    if (moduleState.victoryMode) setVictoryMode(moduleState.victoryMode);
    setGameStartTime(moduleState.gameStartTime || Date.now());
    setHunterShooting(moduleState.hunterShooting || null);
    setSelectedTarget(moduleState.selectedTarget ?? null);
    setSpeakerIndex(moduleState.speakerIndex ?? -1);
    setSpeakingOrder(moduleState.speakingOrder || 'left');
    setSpokenCount(moduleState.spokenCount ?? 0);
    setUserInput(moduleState.userInput || '');
    setGameResult(moduleState.gameResult || null);
    processedVoteDayRef.current = -1;
    gameInitializedRef.current = true;
    gameActiveRef.current = true;
    setPendingSnapshot(null);
    navigate(ROUTES.WEREWOLF_PLAY, { replace: true });
  }, [gameInitializedRef, hydrateGameState, isGuestMode, navigate, pendingSnapshot, processedVoteDayRef, user, usesServerSessionAI]);

  const handleDiscardSnapshot = useCallback(() => {
    clearWerewolfGameSnapshot({ user, isGuestMode });
    setPendingSnapshot(null);
  }, [isGuestMode, user]);

  const handleStartNewGame = useCallback(() => {
    handleDiscardSnapshot();
  }, [handleDiscardSnapshot]);

  const handleExitToHome = useCallback(() => {
    snapshotCurrentGame();
    endGame();
    navigate(ROUTES.HOME, { replace: true });
  }, [endGame, navigate, snapshotCurrentGame]);

  const handleEnterWolfgameSetup = useCallback(() => {
    navigate(ROUTES.WEREWOLF_SETUP);
  }, [navigate]);

  const handleGuestWolfgame = useCallback(() => {
    enterGuestMode();
    navigate(ROUTES.WEREWOLF_SETUP, { replace: true });
  }, [enterGuestMode, navigate]);

  const handleGuestExitToLogin = useCallback(() => {
    snapshotCurrentGame();
    endGame();
    setIsGuestMode(false);
    navigate(ROUTES.LOGIN, { replace: true });
  }, [endGame, navigate, setIsGuestMode, snapshotCurrentGame]);

  const handleGoToLogin = useCallback(() => {
    navigate(ROUTES.LOGIN);
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    snapshotCurrentGame();
    endGame();
    await baseHandleLogout();
  }, [endGame, baseHandleLogout, snapshotCurrentGame]);

  // === Render ===
  const routeToolbar = (isSetupRoute || isPlayRoute) ? (
    <div className="mac-floating-toolbar flex-wrap justify-end">
      <button type="button" onClick={handleExitToHome} className="mac-button mac-button-secondary">
        {isPlayRoute ? ui.app.endAndHome : ui.app.backHome}
      </button>
      {isSetupRoute && !isGuestMode && user && !usesServerSessionAI && (
        <>
          <button
            type="button"
            onClick={openTokenManager}
            className={`mac-button ${tokenStatus.hasToken ? 'mac-button-secondary' : 'mac-button-ghost'}`}
          >
            {tokenStatus.hasToken ? ui.app.tokenReady : ui.app.tokenNeeded}
          </button>
          <button type="button" onClick={openStats} className="mac-button mac-button-secondary">
            {ui.app.stats}
          </button>
          <button type="button" onClick={handleLogout} className="mac-button mac-button-secondary">
            {ui.app.logout}
          </button>
        </>
      )}
      {isSetupRoute && isGuestMode && (
        <button type="button" onClick={handleGuestExitToLogin} className="mac-button mac-button-secondary">
          {ui.app.login}
        </button>
      )}
      <LanguageToggle locale={locale} onChange={setLocale} label={ui.app.localeLabel} />
    </div>
  ) : null;

  if (isHubRoute) {
    return (
      <div className="mac-app-shell">
        <Suspense fallback={<FullPageLoader text={ui.common.loading} />}>
          <WolfgameHub
            locale={locale}
            onBackHome={() => navigate(ROUTES.HOME)}
            onEnterWolfgame={handleEnterWolfgameSetup}
            onGuestWolfgame={handleGuestWolfgame}
            onLogin={isGuestMode ? handleGuestExitToLogin : handleGoToLogin}
            isGuestMode={isGuestMode}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="mac-app-shell relative">
      {routeToolbar}

      <Suspense fallback={null}>
        {showStats && <UserStats onClose={closeStats} locale={locale} />}
        {showTokenManager && (
          <TokenManager
            locale={locale}
            onClose={closeTokenManager}
            onTokenSaved={() => {
              closeTokenManager();
              verifyModelscopeToken();
            }}
          />
        )}
      </Suspense>

      <main className="relative" aria-label={ui.app.defaultTitle}>
        {isSetupRoute && phase === 'setup' && !gameMode && (
          <Suspense fallback={<InlineLoader text={ui.app.loadingSetup} />}>
            <SetupScreen
              locale={locale}
              gameMode={gameMode}
              setGameMode={setGameMode}
              isLoggedIn={!!user}
              isGuestMode={isGuestMode}
              hasModelscopeToken={usesServerSessionAI || tokenStatus.hasToken}
              onConfigureToken={() => {
                if (isGuestMode) { handleGuestExitToLogin(); return; }
                openTokenManager();
              }}
              customRoleSelections={customRoleSelections}
              setCustomRoleSelections={setCustomRoleSelections}
              onBuildCustomSetup={setSelectedSetup}
              victoryMode={victoryMode}
              setVictoryMode={setVictoryMode}
              pendingSnapshot={pendingSnapshot}
              onResumeSnapshot={handleResumeSnapshot}
              onDiscardSnapshot={handleDiscardSnapshot}
              onStartNewGame={handleStartNewGame}
            />
          </Suspense>
        )}

        {isPlayRoute && (phase !== 'setup' || gameMode) && (
          <Suspense fallback={<InlineLoader text={ui.app.loadingGame} />}>
            <GameArena
              locale={locale}
              players={players} userPlayer={userPlayer}
              phase={phase} dayCount={dayCount} nightStep={nightStep}
              nightDecisions={nightDecisions} speechHistory={speechHistory}
              nightActionHistory={nightActionHistory} voteHistory={voteHistory}
              deathHistory={deathHistory} seerChecks={seerChecks}
              guardHistory={guardHistory} witchHistory={witchHistory}
              magicianHistory={magicianHistory} dreamweaverHistory={dreamweaverHistory}
              currentPhaseData={currentPhaseData} gameBackground={gameBackground}
              logs={logs} modelUsage={modelUsage}
              selectedTarget={selectedTarget} setSelectedTarget={setSelectedTarget}
              speakerIndex={speakerIndex} gameMode={gameMode}
              isThinking={isThinking} speakingOrder={speakingOrder}
              setSpeakingOrder={setSpeakingOrder} userInput={userInput}
              setUserInput={setUserInput} handleUserSpeak={handleUserSpeak}
              hunterShooting={hunterShooting} handleUserHunterShoot={handleUserHunterShoot}
              handleUserDuel={handleUserDuel} handleAIHunterShoot={handleAIHunterShoot}
              handleVote={handleVote} proceedNight={proceedNight}
              mergeNightDecisions={mergeNightDecisions}
              setPlayers={setPlayers} setUserPlayer={setUserPlayer}
              witchHistorySetter={setWitchHistory}
              magicianHistorySetter={setMagicianHistory}
              dreamweaverHistorySetter={setDreamweaverHistory}
              getPlayer={getPlayer} addLog={addLog}
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
