import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Bot, Flag, LogOut, Pause, Play, RotateCcw, Undo2 } from 'lucide-react';
import {
  GOMOKU_SIZE, UNDO_LIMIT, createGomoku, applyGomoku, takeBack, undoCount,
} from '../../../../server/games/gomoku.js';
import DuelRoute from '../duel/DuelRoute';
import GameStage, { DockButton, Segmented, useAutoPause } from '../shared/GameStage';
import { haptic } from '../shared/haptics';
import { LEVELS } from './gomokuAI';
import './gomoku.css';
import '../duel/duel.css';

const N = GOMOKU_SIZE;
const STARS = new Set([[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].map(([r, c]) => r * N + c));
const colorName = (seat) => (seat === 1 ? '黑' : '白');

function Stone({ seat }) {
  return <span className={`gk-stone ${seat === 1 ? 'is-black' : 'is-white'}`} />;
}

/** 棋盘（好友对战与单人模式共用） */
function GomokuBoard({ state, mySeat, canPlay, onPlace, width, height }) {
  const { board, moves, winLine } = state;
  const size = Math.floor(Math.min(width, height, 760));
  const cell = size / N;
  const lastMove = moves[moves.length - 1];
  const win = new Set(winLine || []);

  // 触屏上交叉点只有 ~24px：第一下预落子，再点同一点确认，防误触
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  const [pending, setPending] = useState(-1);
  useEffect(() => { setPending(-1); }, [moves.length, canPlay]);

  const place = (i) => {
    if (coarse && pending !== i) { haptic('light'); setPending(i); return; }
    haptic('medium');
    setPending(-1);
    onPlace(i);
  };

  return (
    <div
      className={`gk-board${canPlay ? ' is-my-turn' : ''}`}
      style={{ width: size, height: size, '--cell': `${cell}px`, '--ghost': mySeat === 1 ? '#1d1d1f' : '#ffffff' }}
    >
      <svg className="gk-grid" viewBox={`0 0 ${N} ${N}`} aria-hidden="true">
        {Array.from({ length: N }, (_, k) => (
          <g key={k}>
            <line x1={0.5} y1={k + 0.5} x2={N - 0.5} y2={k + 0.5} />
            <line x1={k + 0.5} y1={0.5} x2={k + 0.5} y2={N - 0.5} />
          </g>
        ))}
        {[...STARS].map((i) => <circle key={i} cx={(i % N) + 0.5} cy={Math.floor(i / N) + 0.5} r={0.11} />)}
      </svg>
      <div className="gk-points">
        {board.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`gk-point${v ? ' has-stone' : ''}${win.has(i) ? ' is-win' : ''}${pending === i ? ' is-pending' : ''}`}
            disabled={!canPlay || !!v}
            onClick={() => place(i)}
            aria-label={`第 ${Math.floor(i / N) + 1} 行第 ${(i % N) + 1} 列`}
          >
            {v ? <Stone seat={v} /> : null}
            {i === lastMove && <span className="gk-last" />}
          </button>
        ))}
      </div>
    </div>
  );
}

const badge = (seat) => <span className={`gk-badge ${seat === 1 ? 'is-black' : 'is-white'}`} title={`执${colorName(seat)}`} />;

const RULES = (
  <ul>
    <li>15×15 棋盘，<b>黑先</b>，双方轮流落子。</li>
    <li>横、竖、斜任意方向连成 <b>五子或以上</b> 即胜（自由规则，无禁手）。</li>
    <li>每人每局 <b>{UNDO_LIMIT} 次悔棋</b>：好友对战需对方同意（被拒绝不扣次数），单人模式立即生效。</li>
    <li>好友对战先后手随机，「再来一局」交换先后手；掉线 60 秒未回来判负。</li>
  </ul>
);

// ---------------- 好友对战：悔棋 ----------------

/** 悔棋结果提示：监听 undoEvent 序号变化 */
function UndoWatcher({ room, say }) {
  const ev = room.state.undoEvent;
  const seen = useRef(ev?.n ?? 0);
  useEffect(() => {
    if (!ev || ev.n === seen.current) return;
    seen.current = ev.n;
    if (ev.seat !== room.seat) return;
    say(ev.accepted ? '对方同意了悔棋' : '对方拒绝了悔棋', ev.accepted ? undefined : 'warn');
  }, [ev, room.seat, say]);
  return null;
}

function duelExtras(room, duel) {
  const s = room.state;
  const left = s.undos?.[room.seat] ?? 0;
  const req = s.undoRequest;
  const canAsk = !req && left > 0 && undoCount(s, room.seat) > 0;
  const fromOpp = req && req.seat !== room.seat;
  return {
    dock: (
      <DockButton
        icon={Undo2}
        label={`悔棋 ${left}`}
        disabled={!canAsk}
        onClick={() => duel.act({ type: 'undo-request' })}
        title={`本局还剩 ${left} 次`}
      />
    ),
    message: req && !fromOpp ? { text: '已请求悔棋，等待对方同意…' } : null,
    banner: (
      <>
        <UndoWatcher room={room} say={duel.say} />
        {fromOpp && (
          <div className="du-banner" role="alertdialog">
            对方请求悔棋（退 {req.count} 手）
            <button type="button" className="du-pill gs-press" onClick={() => { haptic(); duel.act({ type: 'undo-respond', accept: false }); }}>拒绝</button>
            <button type="button" className="du-pill is-primary gs-press" onClick={() => { haptic(); duel.act({ type: 'undo-respond', accept: true }); }}>同意</button>
          </div>
        )}
      </>
    ),
  };
}

function describe(room) {
  return {
    turnText: (mine) => (mine ? `轮到你（${colorName(room.seat)}）` : '对方落子中…'),
    myBadge: badge(room.seat),
    oppBadge: badge(room.seat === 1 ? 2 : 1),
  };
}

// ---------------- 单人模式 ----------------

const LEVEL_OPTIONS = Object.entries(LEVELS).map(([value, l]) => ({ value, label: l.label }));
const SIDE_OPTIONS = [
  { value: 1, label: '执黑先手' },
  { value: 2, label: '执白后手' },
];

function SoloSetup({ onStart }) {
  const [level, setLevel] = useState('medium');
  const [side, setSide] = useState(1);
  return (
    <section className="du-card gk-solo-card">
      <div className="gk-solo-head">
        <Bot size={22} />
        <div>
          <h3>单人模式 · 人机对战</h3>
          <p>Alpha-Beta 搜索 + 棋型评估，困难档会算连续冲四的必胜手。无需登录。</p>
        </div>
      </div>
      <div className="gk-solo-row">
        <Segmented options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
        <Segmented options={SIDE_OPTIONS} value={side} onChange={setSide} />
      </div>
      <button type="button" className="gs-btn gs-btn-primary gs-press" onClick={() => { haptic(); onStart({ level, side }); }}>
        开始对局
      </button>
    </section>
  );
}

function SoloGame({ level, side, onExit }) {
  const ai = side === 1 ? 2 : 1;
  const [state, setState] = useState(createGomoku);
  const [thinking, setThinking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [resigned, setResigned] = useState(false);
  const [paused, setPaused] = useState(false);
  const workerRef = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL('./gomokuAI.worker.js', import.meta.url), { type: 'module' });
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  const over = !!state.winner || state.draw || resigned;

  // 轮到电脑就让 Worker 算；悔棋 / 重开会让 reqId 失效，旧结果直接丢弃
  useEffect(() => {
    if (over || paused || state.turn !== ai || !workerRef.current) return undefined;
    const id = ++reqId.current;
    const started = Date.now();
    setThinking(true);
    const w = workerRef.current;
    const onMsg = (e) => {
      if (e.data.id !== id) return;
      // 至少「想」350ms，落子节奏更自然
      const wait = Math.max(0, 350 - (Date.now() - started));
      setTimeout(() => {
        if (reqId.current !== id) return;
        setThinking(false);
        haptic('light');
        setState((s) => {
          const r = applyGomoku(s, ai, { type: 'place', i: e.data.move });
          return r.ok ? r.state : s;
        });
      }, wait);
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ id, board: state.board, color: ai, level });
    return () => w.removeEventListener('message', onMsg);
  }, [state, ai, level, over, paused]);

  const place = (i) => {
    const r = applyGomoku(state, side, { type: 'place', i });
    if (r.ok) setState(r.state);
  };

  const undo = () => {
    reqId.current++;
    setThinking(false);
    const r = takeBack(state, side);
    if (r.ok) { haptic('medium'); setState(r.state); }
  };

  const restart = useCallback(() => {
    reqId.current++;
    setThinking(false);
    setResigned(false);
    setPaused(false);
    setShowResult(true);
    setState(createGomoku());
  }, []);

  const myTurn = !over && !paused && state.turn === side && !thinking;
  const pause = () => {
    if (over) return;
    reqId.current++; // 正在算的那一手作废，继续后重新算
    setThinking(false);
    setPaused(true);
  };
  useAutoPause(!over && !paused, pause);
  const left = state.undos[side];
  const canUndo = !over && left > 0 && undoCount(state, side) > 0;
  const iWon = !resigned && state.winner === side;
  const levelLabel = LEVELS[level].label;

  return (
    <GameStage
      title="五子棋 · 人机"
      controls={(
        <div className="du-players">
          <div className={`du-chip${myTurn ? ' is-turn' : ''}`}>
            <span className="du-avatar">我</span>
            <span className="du-chip-name">我</span>
            {badge(side)}
          </div>
          <div className="du-turn">{over ? '对局结束' : thinking ? '电脑思考中…' : '轮到你'}</div>
          <div className={`du-chip${thinking ? ' is-turn' : ''}`}>
            <span className="du-avatar gk-bot"><Bot size={16} /></span>
            <span className="du-chip-name">电脑 · {levelLabel}</span>
            {badge(ai)}
          </div>
        </div>
      )}
      paused={paused && !over}
      onResume={() => setPaused(false)}
      dock={(
        <>
          <DockButton
            icon={paused ? Play : Pause}
            label={paused ? '继续' : '暂停'}
            disabled={over}
            on={paused}
            onClick={() => (paused ? setPaused(false) : pause())}
          />
          <DockButton icon={Undo2} label={`悔棋 ${left}`} disabled={!canUndo} onClick={undo} title={`本局还剩 ${left} 次`} />
          {over
            ? <DockButton icon={RotateCcw} label="再来一局" onClick={restart} />
            : <DockButton icon={Flag} label="认输" onClick={() => { if (window.confirm('确定认输吗？')) { reqId.current++; setThinking(false); setResigned(true); } }} />}
          <DockButton icon={BookOpen} label="规则" onClick={() => setRulesOpen(true)} />
          <DockButton icon={LogOut} label="退出" onClick={onExit} />
        </>
      )}
      sheet={{ open: rulesOpen, onClose: () => setRulesOpen(false), title: '五子棋规则', content: <div className="du-card du-rules">{RULES}</div> }}
      overlay={over && showResult && (
        <div className="gs-dialog-wrap du-result-wrap">
          <div className="gs-dialog" role="dialog">
            <div className="gs-dialog-emoji">{state.draw ? '🤝' : iWon ? '🏆' : '🤖'}</div>
            <h3>{state.draw ? '和棋' : iWon ? '你赢了' : '电脑赢了'}</h3>
            <p>{resigned ? '你认输了' : `${levelLabel}难度 · 共 ${state.moves.length} 手 · 用了 ${UNDO_LIMIT - left} 次悔棋`}</p>
            <div className="gs-dialog-actions">
              <button type="button" className="gs-btn gs-btn-primary gs-press" onClick={() => { haptic(); restart(); }}>再来一局</button>
              <button type="button" className="gs-btn gs-btn-tinted gs-press" onClick={() => { haptic(); setShowResult(false); }}>查看棋盘</button>
              <button type="button" className="gs-btn gs-btn-tinted gs-press" onClick={() => { haptic(); onExit(); }}>返回</button>
            </div>
          </div>
        </div>
      )}
    >
      {(size) => <GomokuBoard state={state} mySeat={side} canPlay={myTurn} onPlace={place} {...size} />}
    </GameStage>
  );
}

// ---------------- 页面 ----------------

export default function GomokuRoute() {
  const [solo, setSolo] = useState(null);
  if (solo) return <SoloGame key={`${solo.level}-${solo.side}-${solo.n}`} {...solo} onExit={() => setSolo(null)} />;

  return (
    <DuelRoute
      game="gomoku"
      rules={RULES}
      describe={describe}
      extras={duelExtras}
      lobbyTop={<SoloSetup onStart={(cfg) => setSolo({ ...cfg, n: Date.now() })} />}
      resultText={(room) => (room.result.reason === 'win' ? '五子连珠 · ' : room.result.reason === 'draw' ? '棋盘下满 · ' : '')}
      renderBoard={({ room, duel, width, height }) => (
        <GomokuBoard
          state={room.state}
          mySeat={room.seat}
          canPlay={room.status === 'playing' && room.state.turn === room.seat}
          onPlace={(i) => duel.act({ type: 'place', i })}
          width={width}
          height={height}
        />
      )}
    />
  );
}
