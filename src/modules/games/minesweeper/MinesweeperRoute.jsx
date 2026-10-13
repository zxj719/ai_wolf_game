import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Pointer, RotateCcw, Timer, Trophy } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { submitMinigameScore } from '../../../services/minigamesService';
import GameStage, { DockButton, Segmented, WinDialog } from '../shared/GameStage';
import Leaderboard, { formatClock, formatMs } from '../shared/Leaderboard';
import { useStopwatch } from '../shared/useStopwatch';
import { haptic } from '../shared/haptics';
import { DIFFICULTIES, buildNeighbors, computeNumbers, generateNoGuessBoard } from './mineEngine';
import './minesweeper.css';


function freshState(diff) {
  const n = diff.rows * diff.cols;
  return {
    mines: null,
    nums: null,
    revealed: new Uint8Array(n),
    flags: new Uint8Array(n),
    status: 'ready', // ready | playing | won | lost
    exploded: -1,
    origin: -1,      // 最近一次操作的格子：翻开动画从这里向外扩散
  };
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ms-icon ms-flag" aria-hidden="true">
      <path d="M7 3v18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 4h10l-2.6 4L18 12H8z" fill="var(--gs-red)" />
    </svg>
  );
}

function MineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ms-icon" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </g>
      <circle cx="12" cy="12" r="6.2" fill="currentColor" />
      <circle cx="10" cy="10" r="1.6" fill="#fff" opacity="0.8" />
    </svg>
  );
}

export default function MinesweeperRoute() {
  const { user } = useAuth();
  const { navigate } = useShell();
  const [diffKey, setDiffKey] = useState('beginner');
  const diff = DIFFICULTIES[diffKey];
  const neighbors = useMemo(() => buildNeighbors(diff.rows, diff.cols), [diff]);
  const [game, setGame] = useState(() => freshState(diff));
  const [flagMode, setFlagMode] = useState(false);
  const [result, setResult] = useState(null);
  const [showWin, setShowWin] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const timer = useStopwatch();
  const longPressRef = useRef({ id: null, fired: false });
  const winTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(winTimerRef.current), []);

  const reset = useCallback((key = diffKey) => {
    setDiffKey(key);
    setGame(freshState(DIFFICULTIES[key]));
    setResult(null);
    setShowWin(false);
    clearTimeout(winTimerRef.current);
    timer.reset();
  }, [diffKey, timer]);

  const finishWin = useCallback(async () => {
    const ms = timer.stop();
    haptic('success');
    setResult({ timeMs: ms, uploading: !!user });
    // 先让棋盘的庆祝波纹播完，再弹结算
    winTimerRef.current = setTimeout(() => setShowWin(true), 750);
    if (!user) return;
    const res = await submitMinigameScore('minesweeper', diffKey, ms);
    setResult({ timeMs: ms, ...res });
    setRefreshKey((k) => k + 1);
  }, [timer, user, diffKey]);

  // 在 g（新对象）上翻开 i，返回是否踩雷
  const revealInto = (g, i) => {
    if (g.revealed[i] || g.flags[i]) return false;
    if (g.mines[i]) { g.exploded = i; return true; }
    const stack = [i];
    g.revealed[i] = 1;
    while (stack.length) {
      const k = stack.pop();
      if (g.nums[k] !== 0) continue;
      for (const j of neighbors[k]) {
        if (!g.revealed[j] && !g.flags[j]) { g.revealed[j] = 1; stack.push(j); }
      }
    }
    return false;
  };

  const afterMove = (g, boom) => {
    if (boom) {
      g.status = 'lost';
      timer.stop();
      haptic('error');
      return g;
    }
    let hidden = 0;
    for (let i = 0; i < g.revealed.length; i++) if (!g.revealed[i]) hidden++;
    if (hidden === diff.mines) {
      g.status = 'won';
      for (let i = 0; i < g.mines.length; i++) if (g.mines[i]) g.flags[i] = 1;
      finishWin();
    } else {
      haptic('light');
    }
    return g;
  };

  const toggleFlag = (i) => {
    if (game.status !== 'playing' || game.revealed[i]) return;
    const flags = game.flags.slice();
    flags[i] = flags[i] ? 0 : 1;
    haptic('medium');
    setGame({ ...game, flags, origin: i });
  };

  const openCell = (i) => {
    if (game.status === 'won' || game.status === 'lost') return;
    if (game.status === 'ready') {
      const { mines } = generateNoGuessBoard({
        rows: diff.rows, cols: diff.cols, mines: diff.mines, start: i,
        seed: (Math.random() * 2 ** 32) >>> 0,
      });
      const g = { ...freshState(diff), mines, nums: computeNumbers(mines, neighbors), status: 'playing', origin: i };
      timer.start();
      setGame(afterMove(g, revealInto(g, i)));
      return;
    }
    if (game.flags[i]) return;
    const g = { ...game, revealed: game.revealed.slice(), flags: game.flags.slice(), origin: i };
    let boom = false;
    if (g.revealed[i]) {
      // chord：周围旗数 = 数字时翻开其余邻格
      const n = g.nums[i];
      if (n <= 0) return;
      const flagged = neighbors[i].filter((j) => g.flags[j]).length;
      if (flagged !== n || neighbors[i].every((j) => g.revealed[j] || g.flags[j])) return;
      for (const j of neighbors[i]) boom = revealInto(g, j) || boom;
    } else {
      boom = revealInto(g, i);
    }
    setGame(afterMove(g, boom));
  };

  const onPrimary = (i) => {
    if (longPressRef.current.fired) { longPressRef.current.fired = false; return; }
    if (flagMode && !game.revealed[i]) toggleFlag(i);
    else openCell(i);
  };

  const onTouchStart = (i) => {
    clearTimeout(longPressRef.current.id);
    longPressRef.current.fired = false;
    longPressRef.current.id = setTimeout(() => {
      longPressRef.current.fired = true;
      if (flagMode) openCell(i); else toggleFlag(i);
    }, 360);
  };
  const cancelTouch = () => clearTimeout(longPressRef.current.id);

  const flagsUsed = game.flags.reduce((a, b) => a + b, 0);

  // ---- 布局：按舞台尺寸算格子大小；竖屏放不下宽棋盘时转置 ----
  const renderBoard = ({ width, height }) => {
    const transpose = height > width && diff.cols > diff.rows;
    const vCols = transpose ? diff.rows : diff.cols;
    const vRows = transpose ? diff.cols : diff.rows;
    // 先按宽松间距试算，格子太小时收紧间距和内边距，把空间让给格子
    let gap = 3;
    let pad = 10;
    const fit = (avail, count) => (avail - pad * 2 - gap * (count - 1)) / count;
    let cell = Math.floor(Math.min(fit(width, vCols), fit(height, vRows)));
    if (cell < 30) {
      gap = 2;
      pad = 6;
      cell = Math.floor(Math.min(fit(width, vCols), fit(height, vRows)));
    }
    // 下限 18px（再小手指点不准）：高度放不下时纵向滚动，但宽度尽量贴合
    cell = Math.min(cell, 60);
    if (cell < 18) cell = Math.max(18, Math.floor(fit(width, vCols)));
    const boardW = cell * vCols + gap * (vCols - 1) + pad * 2;

    const o = game.origin;
    const or = o >= 0 ? Math.floor(o / diff.cols) : 0;
    const oc = o >= 0 ? o % diff.cols : 0;
    const ex = game.exploded;
    const er = ex >= 0 ? Math.floor(ex / diff.cols) : 0;
    const ec = ex >= 0 ? ex % diff.cols : 0;

    const cells = [];
    for (let vr = 0; vr < vRows; vr++) {
      for (let vc = 0; vc < vCols; vc++) {
        const r = transpose ? vc : vr;
        const c = transpose ? vr : vc;
        const i = r * diff.cols + c;
        const open = game.revealed[i];
        const flagged = game.flags[i];
        const lost = game.status === 'lost';
        const showMine = lost && game.mines?.[i] && !flagged;
        const wrongFlag = lost && flagged && !game.mines?.[i];
        const n = open ? game.nums[i] : 0;
        let cls = 'ms-cell';
        if (open) cls += ' is-open';
        if (showMine) cls += ' is-mine';
        if (i === ex) cls += ' is-exploded';
        if (game.status === 'won') cls += ' is-won';
        const dist = showMine
          ? Math.max(Math.abs(r - er), Math.abs(c - ec)) * 45
          : game.status === 'won'
            ? (r + c) * 18
            : Math.min(Math.max(Math.abs(r - or), Math.abs(c - oc)) * 24, 520);
        cells.push(
          <button
            key={i}
            type="button"
            className={cls}
            style={{ '--d': `${dist}ms`, fontSize: cell * 0.5 }}
            onClick={() => onPrimary(i)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!longPressRef.current.fired) toggleFlag(i);
            }}
            onTouchStart={() => onTouchStart(i)}
            onTouchEnd={cancelTouch}
            onTouchMove={cancelTouch}
            aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
          >
            {wrongFlag ? <span className="ms-wrong">×</span>
              : flagged ? <FlagIcon />
              : showMine ? <MineIcon />
              : n > 0 ? <span className={`ms-n ms-n${n}`}>{n}</span> : null}
          </button>,
        );
      }
    }

    return (
      <div className="ms-scroll" style={{ maxWidth: width, maxHeight: height }}>
        <div
          className={`ms-board${game.status === 'lost' ? ' gs-shake' : ''}`}
          style={{
            gridTemplateColumns: `repeat(${vCols}, ${cell}px)`,
            gridAutoRows: `${cell}px`,
            gap,
            padding: pad,
            width: boardW,
            '--r': `${Math.max(4, Math.round(cell * 0.22))}px`,
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells}
        </div>
      </div>
    );
  };

  const message = game.status === 'ready'
    ? { text: '点任意格开始 · 本局全程可推理，无需猜测' }
    : game.status === 'lost'
      ? { text: '踩雷了 —— 点「新局」再来', tone: 'bad' }
      : flagMode ? { text: '插旗模式 · 长按翻开' } : null;

  const winDetail = !result ? '' : result.uploading ? '正在上传成绩…'
    : result.success ? `全网第 ${result.rank} 名${result.personalBest ? ' · 个人新纪录' : ''}`
    : user ? '成绩上传失败' : '登录后成绩可上榜';

  return (
    <GameStage
      title="扫雷"
      onOpenSheet={() => setSheetOpen(true)}
      controls={(
        <>
          <Segmented
            value={diffKey}
            onChange={(k) => reset(k)}
            options={Object.values(DIFFICULTIES).map((d) => ({ value: d.key, label: d.label, hint: `${d.cols}×${d.rows}` }))}
          />
          <div className="gs-hud">
            <span className="gs-stat" title="剩余雷数"><Flag size={18} />{diff.mines - flagsUsed}</span>
            <span className="gs-stat" title="用时"><Timer size={18} />{formatClock(timer.elapsed)}</span>
          </div>
        </>
      )}
      message={message}
      dock={(
        <>
          <DockButton icon={RotateCcw} label="新局" onClick={() => reset()} />
          <DockButton
            icon={flagMode ? Flag : Pointer}
            label={flagMode ? '插旗' : '翻开'}
            on={flagMode}
            onClick={() => setFlagMode((v) => !v)}
            title="切换点击行为（手机上很方便）"
          />
          <DockButton icon={Trophy} label="排行榜" onClick={() => setSheetOpen(true)} />
        </>
      )}
      sheet={{
        open: sheetOpen,
        onClose: () => setSheetOpen(false),
        title: `${diff.label}排行榜`,
        content: (
          <Leaderboard game="minesweeper" variant={diffKey} refreshKey={refreshKey}
            user={user} onLogin={() => navigate(ROUTES.LOGIN)} />
        ),
      }}
      overlay={showWin && result && (
        <WinDialog
          emoji="🏆"
          title="扫雷成功"
          timeText={formatMs(result.timeMs)}
          detail={winDetail}
          onAgain={() => reset()}
          onBoard={() => { setShowWin(false); setSheetOpen(true); }}
        />
      )}
    >
      {renderBoard}
    </GameStage>
  );
}
