import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lightbulb, RotateCcw, ShieldCheck, Shuffle, Undo2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { submitMinigameScore } from '../../../services/minigamesService';
import GameFrame from '../shared/GameFrame';
import Leaderboard, { formatMs } from '../shared/Leaderboard';
import { useStopwatch } from '../shared/useStopwatch';
import { LAYOUTS, LAYOUT_MAP, buildGeometry, dealSolvable, findMoves, isFree, matchKey } from './mahjongEngine';
import TileFace, { faceLabel } from './TileFace';
import '../shared/minigames.css';

const TW = 44;      // 牌宽（含边框）
const TH = 58;      // 牌高
const DEPTH = 7;    // 每层错位像素
const HINT_PENALTY_MS = 30000;

function newDeal(layout) {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const { faces } = dealSolvable(layout, seed);
  return { faces, present: new Uint8Array(faces.length).fill(1) };
}

export default function MahjongRoute() {
  const { user } = useAuth();
  const { navigate } = useShell();
  const [layoutId, setLayoutId] = useState('turtle');
  const layout = LAYOUT_MAP[layoutId];
  const geo = useMemo(() => buildGeometry(layout.positions), [layout]);

  const [deal, setDeal] = useState(() => newDeal(layout));
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(-1);
  const [hint, setHint] = useState(null);
  const [hints, setHints] = useState(0);
  const [status, setStatus] = useState('ready'); // ready | playing | won
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timer = useStopwatch();

  const wrapRef = useRef(null);
  const [wrapW, setWrapW] = useState(800);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWrapW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const start = useCallback((id = layoutId) => {
    setLayoutId(id);
    setDeal(newDeal(LAYOUT_MAP[id]));
    setHistory([]);
    setSelected(-1);
    setHint(null);
    setHints(0);
    setStatus('ready');
    setResult(null);
    timer.reset();
  }, [layoutId, timer]);

  const { faces, present } = deal;
  const remaining = present.reduce((a, b) => a + b, 0);
  const moves = useMemo(() => findMoves(faces, present, geo), [faces, present, geo]);
  const stuck = status !== 'won' && remaining > 0 && moves.length === 0;

  // 棋盘尺寸
  const { boardW, boardH, maxZ } = useMemo(() => {
    let mx = 0; let my = 0; let mz = 0;
    for (const [x, y, z] of layout.positions) { mx = Math.max(mx, x); my = Math.max(my, y); mz = Math.max(mz, z); }
    return { boardW: (mx + 2) * (TW / 2) + mz * DEPTH + 6, boardH: (my + 2) * (TH / 2) + mz * DEPTH + 6, maxZ: mz };
  }, [layout]);
  const scale = Math.min(1.25, wrapW / boardW);

  const finishWin = async (penaltyHints) => {
    const ms = timer.stop() + penaltyHints * HINT_PENALTY_MS;
    setStatus('won');
    setResult({ timeMs: ms, uploading: !!user });
    if (!user) return;
    const res = await submitMinigameScore('mahjong', layoutId, ms);
    setResult({ timeMs: ms, ...res });
    setRefreshKey((k) => k + 1);
  };

  const clickTile = (i) => {
    if (status === 'won' || !isFree(i, present, geo)) return;
    if (status === 'ready') { setStatus('playing'); timer.start(); }
    setHint(null);
    if (selected === -1 || selected === i) { setSelected(selected === i ? -1 : i); return; }
    if (matchKey(faces[selected]) !== matchKey(faces[i])) { setSelected(i); return; }
    const next = present.slice();
    next[selected] = 0;
    next[i] = 0;
    setDeal({ faces, present: next });
    setHistory([...history, [selected, i]]);
    setSelected(-1);
    if (next.every((v) => v === 0)) finishWin(hints);
  };

  const undo = () => {
    if (!history.length || status === 'won') return;
    const [a, b] = history[history.length - 1];
    const next = present.slice();
    next[a] = 1;
    next[b] = 1;
    setDeal({ faces, present: next });
    setHistory(history.slice(0, -1));
    setSelected(-1);
    setHint(null);
  };

  const restartSame = () => {
    if (status === 'won') return;
    setDeal({ faces, present: new Uint8Array(faces.length).fill(1) });
    setHistory([]);
    setSelected(-1);
    setHint(null);
  };

  const showHint = () => {
    if (!moves.length || status === 'won') return;
    if (status === 'ready') { setStatus('playing'); timer.start(); }
    setHint(moves[Math.floor(Math.random() * moves.length)]);
    setHints((h) => h + 1);
  };

  // 渲染顺序：高层在上；同层里越靠下、越靠左的越在上（遮住邻牌的侧面阴影）
  const order = useMemo(() => layout.positions.map((p, i) => i)
    .sort((a, b) => {
      const [ax, ay, az] = layout.positions[a];
      const [bx, by, bz] = layout.positions[b];
      return az - bz || ay - by || bx - ax;
    }), [layout]);

  const displayMs = timer.elapsed + hints * HINT_PENALTY_MS;

  return (
    <GameFrame
      eyebrow="Mahjong Solitaire"
      title="麻将消除"
      status={(
        <span className="hidden items-center gap-1 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider sm:inline-flex"
          style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
          <ShieldCheck size={12} /> 每局必有解
        </span>
      )}
    >
      <main className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {LAYOUTS.map((l) => (
              <button key={l.id} type="button" onClick={() => start(l.id)}
                className={`mg-pill ${l.id === layoutId ? 'is-active' : ''}`}>
                {l.name}<span className="text-ink-muted">{l.positions.length}</span>
              </button>
            ))}
          </div>

          <div className="mac-panel p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <span className="mg-lcd" title="用时（含提示罚时）">{formatMs(displayMs)}</span>
                <span>剩 <b className="text-ink">{remaining}</b> 张</span>
                <span>可消 <b className="text-ink">{moves.length}</b> 对</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={undo} disabled={!history.length || status === 'won'} className="mg-pill">
                  <Undo2 size={14} /> 撤销
                </button>
                <button type="button" onClick={showHint} disabled={!moves.length || status === 'won'} className="mg-pill" title="每次提示罚时 30 秒">
                  <Lightbulb size={14} /> 提示 +30s
                </button>
                <button type="button" onClick={restartSame} disabled={status === 'won' || !history.length} className="mg-pill" title="同一副牌从头来（计时继续）">
                  <RotateCcw size={14} /> 重来本局
                </button>
                <button type="button" onClick={() => start()} className="mg-pill">
                  <Shuffle size={14} /> 新一局
                </button>
              </div>
            </div>

            <div ref={wrapRef} className="w-full">
              <div style={{ width: boardW * scale, height: boardH * scale }} className="mx-auto">
                <div className="mg-mj-board" style={{ width: boardW, height: boardH, transform: `scale(${scale})` }}>
                  {order.map((i) => {
                    if (!present[i]) return null;
                    const [x, y, z] = layout.positions[i];
                    const free = isFree(i, present, geo);
                    let cls = 'mg-tile';
                    if (free) cls += ' is-free';
                    if (selected === i) cls += ' is-selected';
                    if (hint && (hint[0] === i || hint[1] === i)) cls += ' is-hint';
                    return (
                      <button
                        key={i}
                        type="button"
                        className={cls}
                        style={{
                          left: x * (TW / 2) + z * DEPTH + 3,
                          top: y * (TH / 2) + (maxZ - z) * DEPTH + 3,
                          width: TW - 2,
                          height: TH - 2,
                        }}
                        onClick={() => clickTile(i)}
                        aria-label={`${faceLabel(faces[i])}${free ? '' : '（被压住）'}`}
                      >
                        <TileFace face={faces[i]} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-3 min-h-[1.5rem] text-center text-sm">
              {status === 'ready' && <span className="text-ink-muted">点击两张相同且「自由」的牌消除（左右至少一侧空、上方无牌压住）。花牌、季牌同类互消。</span>}
              {stuck && (
                <span style={{ color: 'var(--warning)' }}>
                  没有可消的对子了 —— 本局一定有解，撤销几步换条路试试
                </span>
              )}
              {status === 'won' && result && (
                <span style={{ color: 'var(--success)' }}>
                  全部消除！用时 <b className="font-mono">{formatMs(result.timeMs)}</b>
                  {hints > 0 && `（含 ${hints} 次提示罚时）`}
                  {result.uploading && ' · 上传中…'}
                  {result.success && ` · 全网第 ${result.rank} 名${result.personalBest ? ' · 个人新纪录 🎉' : ''}`}
                  {result.success === false && user && ' · 上传失败'}
                  {!user && ' · 登录后成绩可上榜'}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs leading-6 text-ink-muted">
            每副牌都是先确定一条完整消除路线再填牌面生成的，所以一定能一次清空，不需要洗牌；
            但选错对子仍可能把自己堵死，这时用「撤销」回退即可。
          </p>
        </section>

        <aside className="space-y-4">
          <Leaderboard
            game="mahjong"
            variant={layoutId}
            title={`${layout.name}排行榜`}
            refreshKey={refreshKey}
            user={user}
            onLogin={() => navigate(ROUTES.LOGIN)}
          />
        </aside>
      </main>
    </GameFrame>
  );
}
