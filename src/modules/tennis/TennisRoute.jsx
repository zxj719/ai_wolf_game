import { useCallback, useEffect, useRef, useState } from 'react';
import { useShell } from '../../shell/ShellContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../shell/paths';
import { CHARS, rand } from './gameData';
import { useTennisGame } from './useTennisGame';
import { getTennisLeaderboard, sendMatchTelemetry, recordDailyCompletion, getDailyLeaderboard } from '../../services/tennisService';
import { loadLocalRecords, clearLocalRecords } from './localBoard';
import { SelectScreen } from './components/SelectScreen';
import { ReactTest } from './components/ReactTest';
import { PrepScreen } from './components/PrepScreen';
import { ResultScreen } from './components/ResultScreen';
import { BattleScreen } from './battle/BattleScreen';
import { CHAR_BUILDS, ULTIMATES } from './battle/moves';
import { applyEquipment, rollDrop, mergeDrop, RARITY_META, SLOT_META } from './meta/equipment';
import { loadProgress, persistProgress, EMPTY_PROGRESS } from './meta/progressStore';
import { ACHIEVEMENTS } from './meta/achievements';
import { ShopPanel } from './meta/ShopPanel';
import { LadderScreen } from './modes/LadderScreen';
import { AdventureScreen } from './modes/adventure/AdventureScreen';
import { OnboardingModal, checkOnboardingSeen } from './components/OnboardingModal';
import { isNovice, incrementNoviceGames, NOVICE_STAT_PENALTY } from './meta/noviceTracker';
import { getDailyChallenge, markDailyChallengeCompleted, saveDailyStats, DAILY_BONUS_COINS } from './meta/dailyChallenge';
import './tennis.css';

// 单局快打的体验牌库（4 张，B 段后牌库改为养成构建）
const STARTER_DECK = [
  { cardId: 'towelTime', upgraded: false },
  { cardId: 'newBalls', upgraded: false },
  { cardId: 'coachSign', upgraded: false },
  { cardId: 'deepBreath', upgraded: false },
];

const FONT_LINK_ID = 'tennis-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=JetBrains+Mono:wght@500;700&display=swap';

export default function TennisRoute() {
  const { navigate } = useShell();
  const { user } = useAuth();
  const [state, dispatch] = useTennisGame();

  const [showOnboarding, setShowOnboarding] = useState(() => !checkOnboardingSeen());
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const isDailyRef = useRef(false);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const [globalBoard, setGlobalBoard] = useState(undefined);
  const [localRecords, setLocalRecords] = useState(loadLocalRecords);
  const [dailyBoard, setDailyBoard] = useState(null);

  const refreshDailyBoard = useCallback(() => {
    getDailyLeaderboard().then(setDailyBoard);
  }, []);

  // 永久养成层（装备/金币/图鉴/成就），登录走 D1 双写、游客 localStorage
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const updateProgress = useCallback((next) => {
    setProgress(next);
    persistProgress(next);
  }, []);
  useEffect(() => {
    loadProgress().then(setProgress);
  }, [user?.id]);

  // 出战绝技（备战阶段可换装图鉴里的绝技）
  const [equippedUltimate, setEquippedUltimate] = useState(null);

  // S 级天赋成就
  useEffect(() => {
    if (state.player?.grade === 'S' && !progress.achievements.includes('sGrade')) {
      updateProgress({ ...progress, achievements: [...progress.achievements, 'sGrade'] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.player?.grade]);

  const refreshBoards = useCallback(() => {
    setLocalRecords(loadLocalRecords());
    getTennisLeaderboard().then(setGlobalBoard);
  }, []);

  const onFamilyChamp = useCallback((ts) => {
    updateProgress({ ...progress, allFamilyChampAt: ts });
  }, [progress, updateProgress]);

  useEffect(() => {
    // 字体注入幂等：离开页面不移除（浏览器缓存，无副作用）
    if (!document.getElementById(FONT_LINK_ID)) {
      const link = document.createElement('link');
      link.id = FONT_LINK_ID;
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    getTennisLeaderboard().then(setGlobalBoard);
    getDailyLeaderboard().then(setDailyBoard);
    return () => clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.screen]);

  const onStart = useCallback((playerName) => {
    isDailyRef.current = false;
    const pool = CHARS.filter((c) => c.n !== playerName);
    const foe = pool[rand(0, pool.length - 1)];
    const novicePenalty = isNovice() ? NOVICE_STAT_PENALTY : 0;
    dispatch({
      type: 'START',
      playerName,
      oppName: foe.n,
      oppStats: {
        sta: Math.max(20, rand(40, 90) - novicePenalty),
        skill: Math.max(20, rand(40, 90) - novicePenalty),
        mind: Math.max(20, rand(40, 90) - novicePenalty),
      },
    });
    if (novicePenalty > 0) toast(`新手保护中！对手属性 -${novicePenalty} 🛡️`);
    else toast(`宿敌已抽出：${foe.f} ${foe.n}！`);
  }, [dispatch, toast]);

  const onStartDaily = useCallback((playerName) => {
    if (!playerName) { toast('裁判：请先选好你是谁再上场！'); return; }
    const dc = getDailyChallenge(playerName);
    const novicePenalty = isNovice() ? NOVICE_STAT_PENALTY : 0;
    isDailyRef.current = true;
    dispatch({
      type: 'START',
      playerName,
      oppName: dc.foe.n,
      oppStats: {
        sta: Math.max(20, dc.stats.sta - novicePenalty),
        skill: Math.max(20, dc.stats.skill - novicePenalty),
        mind: Math.max(20, dc.stats.mind - novicePenalty),
      },
    });
    toast(`⚡ 今日一战！宿敌：${dc.foe.f} ${dc.foe.n}　胜利可得 +${DAILY_BONUS_COINS}💰！`);
  }, [dispatch, toast]);

  const onLogin = useCallback(() => navigate(ROUTES.LOGIN), [navigate]);

  const onClearLocal = useCallback(() => {
    if (window.confirm('确定清空本机的历史战绩吗？这可是要负历史责任的！')) {
      clearLocalRecords();
      setLocalRecords([]);
      toast('本地榜已清空，历史重新开始 📜');
    }
  }, [toast]);

  const boardProps = {
    global: globalBoard,
    localRecords,
    isLoggedIn: !!user,
    onLogin,
    onClearLocal,
    onRetry: refreshBoards,
  };

  // 绝技选项：本命 + 图鉴已解锁
  const ownUltimate = state.player
    ? Object.entries(ULTIMATES).find(([, u]) => u.owner === state.player.name)?.[0]
    : null;
  const activeUltimate = equippedUltimate ?? ownUltimate;
  const ultimateOptions = state.player
    ? [...new Set([ownUltimate, ...progress.unlockedMoves])].filter(Boolean)
        .map((name) => ({ name, ...ULTIMATES[name] }))
    : [];

  const equipBonus = applyEquipment(progress.equipment);
  // 已解锁绝技名称集合（本命 + 图鉴）
  const unlockedUltNames = new Set([ownUltimate, ...progress.unlockedMoves].filter(Boolean));

  // 单局快打结束：盘分回填 + 掉落/金币入永久层 + 遥测上报
  const onSingleMatchOver = useCallback(({ score, matchStats, rallyCount, durationS }) => {
    setLastMatchStats({ ...matchStats, rallyCount, durationS });
    incrementNoviceGames();
    sendMatchTelemetry({
      mode: 'single', character: state.player.name, opponent: state.opp.name,
      score, matchStats, durationS,
    });
    const win = score.winner === 0;
    const drop = rollDrop(win ? 'win' : 'loss', Math.random);
    const coins = win ? 25 : 10;
    const { equipped, soldFor } = mergeDrop(progress.equipment, drop);
    const achievements = new Set(progress.achievements);
    if (win) achievements.add('firstWin');
    if (drop.rarity === 'legendary') achievements.add('firstLegendary');
    if (matchStats.aces >= 3) achievements.add('aceMaster');
    if (matchStats.clutchWins > 0) achievements.add('clutchMaster');
    const dailyBonus = (isDailyRef.current && win) ? DAILY_BONUS_COINS : 0;
    if (isDailyRef.current) {
      recordDailyCompletion({
        playerName: state.player.name,
        foeName: state.opp.name,
        won: win,
        durationS: durationS ?? null,
      });
      saveDailyStats({
        playerName: state.player.name,
        won: win,
        setsP: score.sets[0],
        setsO: score.sets[1],
        aces: matchStats.aces ?? 0,
        avgMultiplier: matchStats.mgCount > 0
          ? +((matchStats.mgSum / matchStats.mgCount).toFixed(2))
          : null,
        clutchWins: matchStats.clutchWins ?? 0,
        countersWon: matchStats.countersWon ?? 0,
      });
      if (win) markDailyChallengeCompleted();
      isDailyRef.current = false;
      setTimeout(refreshDailyBoard, 800);
    }
    updateProgress({
      ...progress,
      coins: progress.coins + coins + soldFor + dailyBonus,
      equipment: equipped,
      achievements: [...achievements],
    });
    const dailyTag = dailyBonus > 0 ? `　⚡今日一战 +${dailyBonus}💰` : '';
    toast(`🎁 掉落：${RARITY_META[drop.rarity].name}${SLOT_META[drop.slot].name} +${coins + soldFor}💰${dailyTag}`);
    dispatch({
      type: 'MATCH_OVER',
      setsP: score.sets[0],
      setsO: score.sets[1],
      setHistory: score.setHistory,
    });
  }, [progress, updateProgress, toast, dispatch, state.player, state.opp, refreshDailyBoard]);

  // 结算屏统计摘要（单局快打结束后由 onSingleMatchOver 存入）
  const [lastMatchStats, setLastMatchStats] = useState(null);

  // 模式页商店（永久收藏购卡/购装/开盒，金币消费出口）
  const [showMetaShop, setShowMetaShop] = useState(false);
  // 绝技图鉴：当前展开的芯片名（null = 全收起）
  const [expandedUlt, setExpandedUlt] = useState(null);

  // 出战牌库 = 基础牌 + 永久收藏（用户反馈：买的卡要能长期用）
  const fightingDeck = [...STARTER_DECK, ...(progress.ownedCards ?? [])];

  return (
    <div className="tennis-scope">
      <div className="wrap">
        <div className="back-row">
          <button type="button" className="back-link" onClick={() => navigate(ROUTES.HOME)}>
            ← 返回主页
          </button>
        </div>

        <header className="masthead">
          <span className="eyebrow">🎾 FAMILY OPEN 2026</span>
          <h1>家庭网球公开赛<br /><span className="hl">相爱相杀前传</span></h1>
          <p className="sub">一块场地，七个亲人，零点友谊 —— 输的人请客。</p>
        </header>

        {state.screen === 'select' && (
          <SelectScreen
            onStart={onStart}
            onStartDaily={onStartDaily}
            toast={toast}
            boardProps={boardProps}
            equipment={progress.equipment}
            dailyBoard={dailyBoard}
            familyChampAt={progress.allFamilyChampAt ?? null}
            onFamilyChamp={onFamilyChamp}
          />
        )}
        {state.screen === 'mode' && (
          <section className="screen">
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>② 赛事报名 · 今天打哪种比赛？</h2>
                <button type="button" className="ob-help-btn" onClick={() => setShowOnboarding(true)} title="游戏指南">?</button>
              </div>
              <p className="hint">
                💰 {progress.coins} 金币 · 👑 球王 ×{progress.championships} · 📖 绝技图鉴 {ultimateOptions.length}/7
              </p>
              {progress.achievements.length > 0 && (
                <div className="rule-strip" style={{ marginTop: 0, marginBottom: 14 }}>
                  {ACHIEVEMENTS.filter((a) => progress.achievements.includes(a.id)).map((a) => (
                    <span key={a.id} title={a.desc}>{a.icon} {a.name}</span>
                  ))}
                </div>
              )}
              {/* 绝技图鉴：全 7 枚芯片，解锁彩色可点击展开描述，未解锁灰显 */}
              <div className="ult-gallery">
                <span className="ult-gallery-label">📖 绝技图鉴（点击已解锁绝技查看说明）</span>
                <div className="ult-chips">
                  {Object.entries(ULTIMATES).map(([name, u]) => {
                    const unlocked = unlockedUltNames.has(name);
                    const expanded = expandedUlt === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`ult-chip${unlocked ? ' unlocked' : ' locked'}${expanded ? ' expanded' : ''}`}
                        onClick={() => setExpandedUlt(expanded ? null : name)}
                        disabled={!unlocked}
                        title={unlocked ? u.desc : `击败 ${u.owner} 解锁`}
                      >
                        <span className="ult-chip-face">{u.face}</span>
                        <span className="ult-chip-name">{name}</span>
                        {!unlocked && <span className="ult-chip-hint">击败{u.face}{u.owner}</span>}
                        {expanded && <span className="ult-chip-desc">{u.desc}</span>}
                      </button>
                    );
                  })}
                </div>
                {unlockedUltNames.size === Object.keys(ULTIMATES).length && (
                  <div className="rule-strip" style={{ marginTop: 12, marginBottom: 0 }}>
                    🏆 绝技图鉴已完成收集！七大绝技尽在掌握！
                  </div>
                )}
              </div>

              <div className="opts">
                <button type="button" className="opt" onClick={() => dispatch({ type: 'SET_MODE', mode: 'single' })}>
                  <span className="key">🎾</span>
                  <span>单局快打<span className="fx"><em>对阵 {state.opp?.face} {state.opp?.name}</em><em>三盘两胜 · 战绩上榜</em></span></span>
                </button>
                <button type="button" className="opt" onClick={() => dispatch({ type: 'SET_MODE', mode: 'ladder' })}>
                  <span className="key">🏆</span>
                  <span>家族挑战<span className="fx"><em>6 站梯度连战 · 输一场即止步</em><em>击败家人解锁绝技 · 6 连胜加冕球王</em></span></span>
                </button>
                <button type="button" className="opt" onClick={() => dispatch({ type: 'SET_MODE', mode: 'adventure' })}>
                  <span className="key">🗺️</span>
                  <span>奇幻闯关<span className="fx"><em>家族奖杯被偷了！穿越菜市场/修仙界/太空站夺回</em><em>离谱对手 · 奇遇小游戏 · 装备金币失败也保留</em></span></span>
                </button>
                <button type="button" className="opt" onClick={() => setShowMetaShop(true)}>
                  <span className="key">🛒</span>
                  <span>网球用品店<span className="fx"><em>花掉比赛赚的金币：购卡入永久收藏（组进每局牌库）· 购装 · 升装 · 开盲盒</em></span></span>
                </button>
              </div>
            </div>
            {showMetaShop && (
              <ShopPanel
                progress={progress}
                onUpdateProgress={updateProgress}
                deck={progress.ownedCards ?? []}
                onDeckChange={(cards) => updateProgress({ ...progress, ownedCards: cards.slice(0, 10) })}
                deckCap={10}
                deckLabel="永久收藏"
                onClose={() => setShowMetaShop(false)}
                toast={toast}
              />
            )}
          </section>
        )}
        {state.screen === 'react' && <ReactTest dispatch={dispatch} toast={toast} />}
        {state.screen === 'prep' && (
          <PrepScreen
            state={state}
            dispatch={dispatch}
            toast={toast}
            ultimateOptions={ultimateOptions}
            equippedUltimate={activeUltimate}
            onUltimateChange={setEquippedUltimate}
            equipBonus={equipBonus}
          />
        )}
        {state.screen === 'match' && state.mode === 'single' && (
          <section className="screen">
            <BattleScreen
              player={state.player}
              opponent={state.opp}
              playerMoves={CHAR_BUILDS[state.player.name].moves}
              deckInstances={fightingDeck}
              ultimate={activeUltimate}
              equip={equipBonus}
              onMatchOver={onSingleMatchOver}
            />
          </section>
        )}
        {state.screen === 'match' && state.mode === 'ladder' && (
          <LadderScreen
            basePlayer={state.player}
            progress={progress}
            onUpdateProgress={updateProgress}
            equippedUltimate={activeUltimate}
            onExit={() => { dispatch({ type: 'REPLAY' }); refreshBoards(); }}
            toast={toast}
          />
        )}
        {state.screen === 'match' && state.mode === 'adventure' && (
          <AdventureScreen
            basePlayer={state.player}
            progress={progress}
            onUpdateProgress={updateProgress}
            equippedUltimate={activeUltimate}
            onExit={() => { dispatch({ type: 'REPLAY' }); refreshBoards(); }}
            toast={toast}
          />
        )}
        {state.screen === 'result' && (
          <ResultScreen
            state={state}
            dispatch={dispatch}
            user={user}
            toast={toast}
            onRecorded={refreshBoards}
            boardProps={boardProps}
            matchStats={lastMatchStats}
          />
        )}

        <footer className="note">
          {user
            ? <>已登录 <b>{user.username}</b> · 战绩自动上传全网榜 · 球品即人品 🎾</>
            : <>游客模式 · 战绩仅保存在 <b>本机浏览器</b> · 登录后可上全网榜 🎾</>}
        </footer>
      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
    </div>
  );
}
