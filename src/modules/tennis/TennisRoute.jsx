import { useCallback, useEffect, useRef, useState } from 'react';
import { useShell } from '../../shell/ShellContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../shell/paths';
import { CHARS, rand } from './gameData';
import { useTennisGame } from './useTennisGame';
import { getTennisLeaderboard } from '../../services/tennisService';
import { loadLocalRecords, clearLocalRecords } from './localBoard';
import { SelectScreen } from './components/SelectScreen';
import { ReactTest } from './components/ReactTest';
import { PrepScreen } from './components/PrepScreen';
import { MatchScreen } from './components/MatchScreen';
import { ResultScreen } from './components/ResultScreen';
import './tennis.css';

const FONT_LINK_ID = 'tennis-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=JetBrains+Mono:wght@500;700&display=swap';

export default function TennisRoute() {
  const { navigate } = useShell();
  const { user } = useAuth();
  const [state, dispatch] = useTennisGame();

  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const toast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const [globalBoard, setGlobalBoard] = useState(undefined);
  const [localRecords, setLocalRecords] = useState(loadLocalRecords);

  const refreshBoards = useCallback(() => {
    setLocalRecords(loadLocalRecords());
    getTennisLeaderboard().then(setGlobalBoard);
  }, []);

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
    return () => clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.screen]);

  const onStart = useCallback((playerName) => {
    const pool = CHARS.filter((c) => c.n !== playerName);
    const foe = pool[rand(0, pool.length - 1)];
    dispatch({
      type: 'START',
      playerName,
      oppName: foe.n,
      oppStats: { sta: rand(40, 90), skill: rand(40, 90), mind: rand(40, 90) },
    });
    toast(`宿敌已抽出：${foe.f} ${foe.n}！`);
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
          <SelectScreen onStart={onStart} toast={toast} boardProps={boardProps} />
        )}
        {state.screen === 'react' && <ReactTest dispatch={dispatch} toast={toast} />}
        {state.screen === 'prep' && <PrepScreen state={state} dispatch={dispatch} toast={toast} />}
        {state.screen === 'match' && <MatchScreen state={state} dispatch={dispatch} toast={toast} />}
        {state.screen === 'result' && (
          <ResultScreen
            state={state}
            dispatch={dispatch}
            user={user}
            toast={toast}
            onRecorded={refreshBoards}
            boardProps={boardProps}
          />
        )}

        <footer className="note">
          {user
            ? <>已登录 <b>{user.username}</b> · 战绩自动上传全网榜 · 球品即人品 🎾</>
            : <>游客模式 · 战绩仅保存在 <b>本机浏览器</b> · 登录后可上全网榜 🎾</>}
        </footer>
      </div>

      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
