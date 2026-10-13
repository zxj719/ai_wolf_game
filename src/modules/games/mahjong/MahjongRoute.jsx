import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Lightbulb, RotateCcw, Shuffle, Timer, Trophy, Undo2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { submitMinigameScore } from '../../../services/minigamesService';
import GameStage, { DockButton, Segmented, WinDialog } from '../shared/GameStage';
import Leaderboard, { formatClock, formatMs } from '../shared/Leaderboard';
import { useStopwatch } from '../shared/useStopwatch';
import { haptic } from '../shared/haptics';
import { LAYOUTS, LAYOUT_MAP, buildGeometry, dealSolvable, findMoves, isFree, matchKey } from './mahjongEngine';
import TileFace, { faceLabel } from './TileFace';
import './mahjong.css';

const TW = 44;      // 牌宽（含边框）
const TH = 58;      // 牌高
const DEPTH = 6;    // 每层错位像素
const HINT_PENALTY_MS = 30000;
const LEAVE_MS = 320;

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
  const [showWin, setShowWin] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [leaving, setLeaving] = useState([]);   // 正在播放消除动画的牌
  const [nudge, setNudge] = useState({ i: -1, n: 0 });
  const timer = useStopwatch();
  const timersRef = useRef([]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timersRef.current.push(setTimeout(fn, ms)); };

  const start = useCallback((id = layoutId) => {
    setLayoutId(id);
    setDeal(newDeal(LAYOUT_MAP[id]));
    setHistory([]);
    setSelected(-1);
    setHint(null);
    setHints(0);
    setStatus('ready');
    setResult(null);
    setShowWin(false);
    setLeaving([]);
    timer.reset();
  }, [layoutId, timer]);

  const { faces, present } = deal;
  const remaining = present.reduce((a, b) => a + b, 0);
  const moves = useMemo(() => findMoves(faces, present, geo), [faces, present, geo]);
  const stuck = status !== 'won' && remaining > 0 && moves.length === 0;

  const { boardW, boardH, maxZ } = useMemo(() => {
    let mx = 0; let my = 0; let mz = 0;
    for (const [x, y, z] of layout.positions) { mx = Math.max(mx, x); my = Math.max(my, y); mz = Math.max(mz, z); }
    return { boardW: (mx + 2) * (TW / 2) + mz * DEPTH + 8, boardH: (my + 2) * (TH / 2) + mz * DEPTH + 8, maxZ: mz };
  }, [layout]);

  const finishWin = async (penaltyHints) => {
    const ms = timer.stop() + penaltyHints * HINT_PENALTY_MS;
    setStatus('won');
    haptic('success');
    setResult({ timeMs: ms, uploading: !!user });
    later(() => setShowWin(true), LEAVE_MS + 150);
    if (!user) return;
    const res = await submitMinigameScore('mahjong', layoutId, ms);
    setResult({ timeMs: ms, ...res });
    setRefreshKey((k) => k + 1);
  };

  const ensureStarted = () => {
    if (status === 'ready') { setStatus('playing'); timer.start(); }
  };

  const clickTile = (i) => {
    if (status === 'won') return;
    if (!isFree(i, present, geo)) {
      haptic('medium');
      setNudge((v) => ({ i, n: v.n + 1 }));
      return;
    }
    ensureStarted();
    setHint(null);
    if (selected === -1 || selected === i) {
      haptic('light');
      setSelected(selected === i ? -1 : i);
      return;
    }
    if (matchKey(faces[selected]) !== matchKey(faces[i])) {
      haptic('light');
      setSelected(i);
      return;
    }
    const pair = [selected, i];
    const next = present.slice();
    next[pair[0]] = 0;
    next[pair[1]] = 0;
    haptic('medium');
    setDeal({ faces, present: next });
    setHistory([...history, pair]);
    setSelected(-1);
    setLeaving((l) => [...l, ...pair]);
    later(() => setLeaving((l) => l.filter((x) => !pair.includes(x))), LEAVE_MS);
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
    setLeaving((l) => l.filter((x) => x !== a && x !== b));
    setSelected(-1);
    setHint(null);
  };

  const restartSame = () => {
    if (status === 'won') return;
    setDeal({ faces, present: new Uint8Array(faces.length).fill(1) });
    setHistory([]);
    setSelected(-1);
    setHint(null);
    setLeaving([]);
  };

  const showHint = () => {
    if (!moves.length || status === 'won') return;
    ensureStarted();
    setSelected(-1);
    setHint(moves[Math.floor(Math.random() * moves.length)]);
    setHints((h) => h + 1);
  };

  // 渲染顺序：高层在上；同层里越靠下、越靠左的越在上（遮住邻牌的侧面）
  const order = useMemo(() => layout.positions.map((p, i) => i)
    .sort((a, b) => {
      const [ax, ay, az] = layout.positions[a];
      const [bx, by, bz] = layout.positions[b];
      return az - bz || ay - by || bx - ax;
    }), [layout]);

  const renderBoard = ({ width, height }) => {
    const scale = Math.min(width / boardW, height / boardH, 1.7);
    return (
      <div style={{ width: boardW * scale, height: boardH * scale }}>
        <div className="mj-board" style={{ width: boardW, height: boardH, transform: `scale(${scale})` }}>
          {order.map((i) => {
            const isLeaving = !present[i] && leaving.includes(i);
            if (!present[i] && !isLeaving) return null;
            const [x, y, z] = layout.positions[i];
            const free = present[i] && isFree(i, present, geo);
            let cls = 'mj-tile';
            if (free) cls += ' is-free';
            if (selected === i) cls += ' is-selected';
            if (hint && (hint[0] === i || hint[1] === i)) cls += ' is-hint';
            if (isLeaving) cls += ' is-leaving';
            if (nudge.i === i) cls += nudge.n % 2 ? ' is-nudge-a' : ' is-nudge-b';
            return (
              <button
                key={i}
                type="button"
                className={cls}
                style={{
                  left: x * (TW / 2) + z * DEPTH + 4,
                  top: y * (TH / 2) + (maxZ - z) * DEPTH + 4,
                  width: TW - 2,
                  height: TH - 2,
                }}
                onClick={() => !isLeaving && clickTile(i)}
                aria-label={`${faceLabel(faces[i])}${free ? '' : '（被压住）'}`}
              >
                <TileFace face={faces[i]} />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const displayMs = timer.elapsed + hints * HINT_PENALTY_MS;
  const message = stuck
    ? { text: '没有可消的对子了 · 本局必有解，撤销几步换条路', tone: 'warn' }
    : status === 'ready'
      ? { text: '点两张相同的「自由」牌消除 · 花、季同类互消' }
      : null;

  const winDetail = !result ? '' : result.uploading ? '正在上传成绩…'
    : result.success ? `全网第 ${result.rank} 名${result.personalBest ? ' · 个人新纪录' : ''}${hints ? ` · 含 ${hints} 次提示罚时` : ''}`
    : user ? '成绩上传失败' : '登录后成绩可上榜';

  return (
    <GameStage
      title="麻将消除"
      onOpenSheet={() => setSheetOpen(true)}
      controls={(
        <>
          <Segmented
            value={layoutId}
            onChange={(id) => start(id)}
            options={LAYOUTS.map((l) => ({ value: l.id, label: l.name }))}
          />
          <div className="gs-hud">
            <span className="gs-stat" title="用时（含提示罚时）"><Timer size={18} />{formatClock(displayMs)}</span>
            <span className="gs-stat" title="剩余牌数"><Layers size={18} />{remaining}</span>
            <span className="gs-stat" title="当前可消对数"><small>可消</small>{moves.length}</span>
          </div>
        </>
      )}
      message={message}
      dock={(
        <>
          <DockButton icon={Undo2} label="撤销" onClick={undo} disabled={!history.length || status === 'won'} />
          <DockButton icon={Lightbulb} label="提示" onClick={showHint} disabled={!moves.length || status === 'won'} title="每次提示罚时 30 秒" />
          <DockButton icon={RotateCcw} label="重来" onClick={restartSame} disabled={status === 'won' || !history.length} title="同一副牌从头来（计时继续）" />
          <DockButton icon={Shuffle} label="新局" onClick={() => start()} />
          <DockButton icon={Trophy} label="排行榜" onClick={() => setSheetOpen(true)} />
        </>
      )}
      sheet={{
        open: sheetOpen,
        onClose: () => setSheetOpen(false),
        title: `${layout.name} · 排行榜`,
        content: (
          <Leaderboard game="mahjong" variant={layoutId} refreshKey={refreshKey}
            user={user} onLogin={() => navigate(ROUTES.LOGIN)} />
        ),
      }}
      overlay={showWin && result && (
        <WinDialog
          emoji="🎉"
          title="全部消除"
          timeText={formatMs(result.timeMs)}
          detail={winDetail}
          onAgain={() => start()}
          onBoard={() => { setShowWin(false); setSheetOpen(true); }}
        />
      )}
    >
      {renderBoard}
    </GameStage>
  );
}
