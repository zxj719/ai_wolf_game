import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { submitMinigameScore } from '../../../services/minigamesService';
import GameFrame from '../shared/GameFrame';
import Leaderboard, { formatMs } from '../shared/Leaderboard';
import { useStopwatch } from '../shared/useStopwatch';
import { DIFFICULTIES, buildNeighbors, computeNumbers, generateNoGuessBoard } from './mineEngine';
import '../shared/minigames.css';

const CELL_SIZE = { beginner: 34, intermediate: 28, expert: 26 };

function freshState(diff) {
  const n = diff.rows * diff.cols;
  return {
    mines: null,
    nums: null,
    revealed: new Uint8Array(n),
    flags: new Uint8Array(n),
    status: 'ready', // ready | playing | won | lost
    exploded: -1,
  };
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
  const [refreshKey, setRefreshKey] = useState(0);
  const timer = useStopwatch();
  const longPressRef = useRef({ id: null, fired: false });

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(900);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWrapW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const reset = useCallback((key = diffKey) => {
    setDiffKey(key);
    setGame(freshState(DIFFICULTIES[key]));
    setResult(null);
    timer.reset();
  }, [diffKey, timer]);

  const finishWin = useCallback(async () => {
    const ms = timer.stop();
    setResult({ timeMs: ms, uploading: !!user });
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
      return g;
    }
    let hidden = 0;
    for (let i = 0; i < g.revealed.length; i++) if (!g.revealed[i]) hidden++;
    if (hidden === diff.mines) {
      g.status = 'won';
      for (let i = 0; i < g.mines.length; i++) if (g.mines[i]) g.flags[i] = 1;
      finishWin();
    }
    return g;
  };

  const toggleFlag = (i) => {
    if (game.status !== 'playing' || game.revealed[i]) return;
    const flags = game.flags.slice();
    flags[i] = flags[i] ? 0 : 1;
    setGame({ ...game, flags });
  };

  const openCell = (i) => {
    if (game.status === 'won' || game.status === 'lost') return;
    if (game.status === 'ready') {
      const { mines } = generateNoGuessBoard({
        rows: diff.rows, cols: diff.cols, mines: diff.mines, start: i,
        seed: (Math.random() * 2 ** 32) >>> 0,
      });
      const g = { ...freshState(diff), mines, nums: computeNumbers(mines, neighbors), status: 'playing' };
      timer.start();
      setGame(afterMove(g, revealInto(g, i)));
      return;
    }
    if (game.flags[i]) return;
    const g = { ...game, revealed: game.revealed.slice(), flags: game.flags.slice() };
    let boom = false;
    if (g.revealed[i]) {
      // 双击语义（chord）：周围旗数 = 数字时翻开其余邻格
      const n = g.nums[i];
      if (n <= 0) return;
      const flagged = neighbors[i].filter((j) => g.flags[j]).length;
      if (flagged !== n) return;
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
      toggleFlag(i);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 380);
  };
  const cancelTouch = () => clearTimeout(longPressRef.current.id);

  const flagsUsed = game.flags.reduce((a, b) => a + b, 0);
  // 格子随容器缩放；手机上不低于 22px（再小就点不准了），超出则横向滚动
  const size = Math.max(22, Math.min(CELL_SIZE[diffKey], Math.floor((wrapW - 4) / diff.cols)));
  const face = game.status === 'won' ? '😎' : game.status === 'lost' ? '😵' : '🙂';

  const statusBadge = (
    <span className="hidden items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider sm:inline-flex"
      style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
      <ShieldCheck size={12} /> 无猜保证
    </span>
  );

  return (
    <GameFrame eyebrow="No-Guess Minesweeper" title="扫雷" status={statusBadge}>
      <main className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(DIFFICULTIES).map((d) => (
              <button key={d.key} type="button" onClick={() => reset(d.key)}
                className={`mg-pill ${d.key === diffKey ? 'is-active' : ''}`}>
                {d.label}
                <span className="text-ink-muted">{d.cols}×{d.rows} · {d.mines}雷</span>
              </button>
            ))}
          </div>

          <div className="mac-panel p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="mg-lcd" title="剩余雷数">{String(diff.mines - flagsUsed).padStart(3, '0')}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => reset()} className="mg-face" aria-label="重新开始">{face}</button>
                <button type="button" onClick={() => setFlagMode((v) => !v)}
                  className={`mg-pill ${flagMode ? 'is-active' : ''}`} title="插旗模式（手机用）">
                  <Flag size={14} /> 插旗
                </button>
              </div>
              <div className="mg-lcd" title="用时">{formatMs(timer.elapsed).replace('s', '')}</div>
            </div>

            <div ref={wrapRef} className="overflow-x-auto pb-1">
              <div
                className="mg-mine-board mx-auto"
                style={{ gridTemplateColumns: `repeat(${diff.cols}, ${size}px)`, width: diff.cols * size }}
                onContextMenu={(e) => e.preventDefault()}
              >
                {Array.from({ length: diff.rows * diff.cols }, (_, i) => {
                  const open = game.revealed[i];
                  const flagged = game.flags[i];
                  const showMine = game.status === 'lost' && game.mines?.[i];
                  const wrongFlag = game.status === 'lost' && flagged && !game.mines?.[i];
                  const n = open ? game.nums[i] : 0;
                  let cls = 'mg-cell';
                  if (open) cls += ' is-open';
                  if (i === game.exploded) cls += ' is-exploded';
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cls}
                      style={{ width: size, height: size, fontSize: size * 0.55 }}
                      onClick={() => onPrimary(i)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        // 安卓长按也会触发 contextmenu：长按已插过旗就别再切回去
                        if (!longPressRef.current.fired) toggleFlag(i);
                      }}
                      onTouchStart={() => onTouchStart(i)}
                      onTouchEnd={cancelTouch}
                      onTouchMove={cancelTouch}
                      aria-label={`第 ${Math.floor(i / diff.cols) + 1} 行第 ${(i % diff.cols) + 1} 列`}
                    >
                      {wrongFlag ? '❌' : flagged ? '🚩' : showMine ? '💣' : n > 0 ? <span className={`mg-n${n}`}>{n}</span> : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 min-h-[1.5rem] text-center text-sm">
              {game.status === 'ready' && <span className="text-ink-muted">点任意格开始 —— 本局保证全程靠推理可解，无需猜测</span>}
              {game.status === 'lost' && <span style={{ color: 'var(--danger)' }}>踩雷了！点笑脸再来一局</span>}
              {game.status === 'won' && result && (
                <span style={{ color: 'var(--success)' }}>
                  通关！用时 <b className="font-mono">{formatMs(result.timeMs)}</b>
                  {result.uploading && ' · 上传中…'}
                  {result.success && ` · 全网第 ${result.rank} 名${result.personalBest ? ' · 个人新纪录 🎉' : ''}`}
                  {result.success === false && user && ' · 上传失败'}
                  {!user && ' · 登录后成绩可上榜'}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs leading-6 text-ink-muted">
            左键翻开 · 右键 / 长按插旗 · 点已翻开的数字快速翻开周围（旗数相符时）。
            首次点击后才布雷：首击周围 3×3 必空，且生成器会用逻辑求解器验证整盘可推理，
            不会出现被雷完全隔断、只能二选一的死局。
          </p>
        </section>

        <aside className="space-y-4">
          <Leaderboard
            game="minesweeper"
            variant={diffKey}
            title={`${diff.label}排行榜`}
            refreshKey={refreshKey}
            user={user}
            onLogin={() => navigate(ROUTES.LOGIN)}
          />
        </aside>
      </main>
    </GameFrame>
  );
}
