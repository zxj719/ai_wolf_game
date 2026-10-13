import { useEffect, useState } from 'react';
import { GOMOKU_SIZE } from '../../../../server/games/gomoku.js';
import DuelRoute from '../duel/DuelRoute';
import { haptic } from '../shared/haptics';
import './gomoku.css';

const N = GOMOKU_SIZE;
const STARS = new Set([[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].map(([r, c]) => r * N + c));

function Stone({ seat }) {
  return <span className={`gk-stone ${seat === 1 ? 'is-black' : 'is-white'}`} />;
}

function GomokuBoard({ room, duel, width, height }) {
  const { board, moves, winLine } = room.state;
  const myTurn = room.status === 'playing' && room.state.turn === room.seat;
  const size = Math.floor(Math.min(width, height, 760));
  const cell = size / N;
  const lastMove = moves[moves.length - 1];
  const win = new Set(winLine || []);

  // 触屏上交叉点只有 ~24px：第一下预落子，再点同一点确认，防误触
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  const [pending, setPending] = useState(-1);
  useEffect(() => { setPending(-1); }, [moves.length, myTurn]);

  const place = (i) => {
    if (coarse && pending !== i) { haptic('light'); setPending(i); return; }
    haptic('medium');
    setPending(-1);
    duel.act({ type: 'place', i });
  };

  return (
    <div
      className={`gk-board${myTurn ? ' is-my-turn' : ''}`}
      style={{ width: size, height: size, '--cell': `${cell}px`, '--ghost': room.seat === 1 ? '#1d1d1f' : '#ffffff' }}
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
            disabled={!myTurn || !!v}
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

function describe(room) {
  const color = (seat) => (seat === 1 ? '黑' : '白');
  return {
    turnText: (mine) => (mine ? `轮到你（${color(room.seat)}）` : '对方落子中…'),
    myBadge: <span className={`gk-badge ${room.seat === 1 ? 'is-black' : 'is-white'}`} title={`执${color(room.seat)}`} />,
    oppBadge: <span className={`gk-badge ${room.seat === 1 ? 'is-white' : 'is-black'}`} />,
  };
}

const RULES = (
  <ul>
    <li>15×15 棋盘，<b>黑先</b>，双方轮流落子。</li>
    <li>横、竖、斜任意方向连成 <b>五子或以上</b> 即胜（自由规则，无禁手）。</li>
    <li>先后手随机分配；「再来一局」会交换先后手。</li>
    <li>对局中掉线 60 秒未回来判负。</li>
  </ul>
);

export default function GomokuRoute() {
  return (
    <DuelRoute
      game="gomoku"
      rules={RULES}
      describe={describe}
      resultText={(room) => (room.result.reason === 'win' ? '五子连珠 · ' : room.result.reason === 'draw' ? '棋盘下满 · ' : '')}
      renderBoard={(props) => <GomokuBoard {...props} />}
    />
  );
}
