import { useEffect, useState } from 'react';
import { BANQI_COLS, BANQI_ROWS, PIECE_NAMES, RANK, targetsFrom } from '../../../../server/games/banqi.js';
import DuelRoute from '../duel/DuelRoute';
import { haptic } from '../shared/haptics';
import './banqi.css';

const COLOR_NAME = { r: '红', b: '黑' };

function Piece({ p, flipping, arrived }) {
  if (!p.up) return <span className="bq-piece is-down"><i /></span>;
  return (
    <span className={`bq-piece ${p.c === 'r' ? 'is-red' : 'is-black'}${flipping ? ' is-flipping' : ''}${arrived ? ' is-arrived' : ''}`}>
      <b>{PIECE_NAMES[p.c][p.t]}</b>
    </span>
  );
}

function Tray({ color, types }) {
  if (!types.length) return <div className="bq-tray is-empty" />;
  const sorted = [...types].sort((a, b) => RANK[b] - RANK[a]);
  return (
    <div className="bq-tray">
      {sorted.map((t, k) => (
        <span key={k} className={`bq-mini ${color === 'r' ? 'is-red' : 'is-black'}`}>{PIECE_NAMES[color][t]}</span>
      ))}
    </div>
  );
}

function BanqiBoard({ room, duel, width, height }) {
  const { cells, colors, last, captured } = room.state;
  const myColor = colors[room.seat];
  const oppColor = myColor === 'r' ? 'b' : myColor === 'b' ? 'r' : null;
  const myTurn = room.status === 'playing' && room.state.turn === room.seat;
  const [sel, setSel] = useState(-1);
  const [nudge, setNudge] = useState({ i: -1, n: 0 });

  // 每次局面推进都清掉选择
  useEffect(() => { setSel(-1); }, [room.state]);

  const targets = new Set(sel >= 0 ? targetsFrom(cells, sel) : []);

  const tap = (i) => {
    const p = cells[i];
    if (!myTurn) { haptic('light'); setNudge((v) => ({ i, n: v.n + 1 })); return; }
    if (sel >= 0 && targets.has(i)) {
      haptic(p ? 'heavy' : 'medium');
      duel.act({ type: 'move', from: sel, to: i });
      setSel(-1);
      return;
    }
    if (p && !p.up) {
      haptic('medium');
      duel.act({ type: 'flip', i });
      setSel(-1);
      return;
    }
    if (p && p.up && p.c === myColor) {
      haptic('light');
      setSel(sel === i ? -1 : i);
      return;
    }
    if (p) { haptic('light'); setNudge((v) => ({ i, n: v.n + 1 })); }
    setSel(-1);
  };

  // 竖屏转成 8 行 × 4 列
  const transpose = height > width * 1.05;
  const vRows = transpose ? BANQI_COLS : BANQI_ROWS;
  const vCols = transpose ? BANQI_ROWS : BANQI_COLS;
  const trayH = 40;
  const gap = 6;
  const pad = 12;
  const cell = Math.floor(Math.min(
    (width - pad * 2 - gap * (vCols - 1)) / vCols,
    (height - trayH * 2 - pad * 2 - gap * (vRows - 1)) / vRows,
    110,
  ));

  const order = [];
  for (let vr = 0; vr < vRows; vr++) {
    for (let vc = 0; vc < vCols; vc++) order.push(transpose ? vc * BANQI_COLS + vr : vr * BANQI_COLS + vc);
  }
  const lastCells = new Set(last ? (last.type === 'flip' ? [last.i] : [last.from, last.to]) : []);

  return (
    <div className="bq-wrap" style={{ '--cell': `${cell}px` }}>
      {oppColor ? <Tray color={oppColor} types={captured[oppColor]} /> : <div className="bq-tray is-empty" />}
      <div className="bq-board" style={{ gridTemplateColumns: `repeat(${vCols}, ${cell}px)`, gap, padding: pad }}>
        {order.map((i) => {
          const p = cells[i];
          let cls = 'bq-cell';
          if (sel === i) cls += ' is-selected';
          if (targets.has(i)) cls += p ? ' is-capture' : ' is-target';
          if (lastCells.has(i)) cls += ' is-last';
          if (nudge.i === i) cls += nudge.n % 2 ? ' is-nudge-a' : ' is-nudge-b';
          return (
            <button key={i} type="button" className={cls} onClick={() => tap(i)} aria-label={p ? (p.up ? PIECE_NAMES[p.c][p.t] : '暗子') : '空格'}>
              {p && (
                <Piece
                  p={p}
                  flipping={last?.type === 'flip' && last.i === i}
                  arrived={last?.type === 'move' && last.to === i}
                />
              )}
            </button>
          );
        })}
      </div>
      {myColor ? <Tray color={myColor} types={captured[myColor]} /> : <div className="bq-tray is-empty" />}
    </div>
  );
}

function badge(color) {
  if (!color) return <span className="bq-badge">?</span>;
  return <span className={`bq-badge ${color === 'r' ? 'is-red' : 'is-black'}`}>{COLOR_NAME[color]}</span>;
}

function describe(room) {
  const { colors } = room.state;
  const mine = colors[room.seat];
  const opp = colors[room.seat === 1 ? 2 : 1];
  return {
    turnText: (myTurn) => {
      if (!mine) return myTurn ? '翻一枚棋子定颜色' : '等对方翻第一枚…';
      return myTurn ? '轮到你' : '对方思考中…';
    },
    myBadge: badge(mine),
    oppBadge: badge(opp),
  };
}

const RULES = (
  <ul>
    <li>4×8 棋盘，32 枚棋子<b>背面朝上</b>随机摆放；先手随机。</li>
    <li>每回合三选一：<b>翻开</b>一枚暗子、己方明子<b>走一步</b>（上下左右）、或<b>吃子</b>。首个翻子的人执所翻棋子的颜色。</li>
    <li>大小：<b>帅将 &gt; 仕士 &gt; 相象 &gt; 车 &gt; 马 &gt; 炮 &gt; 兵卒</b>，大吃小、同级互吃；兵卒可吃帅将，帅将不能吃兵卒。</li>
    <li><b>炮</b>平时走一步；吃子须隔且只隔一枚棋子（明暗都能当炮架），可打任意距离、任意大小的对方明子。</li>
    <li>暗子不能被吃。吃光对方或让对方无路可走即胜；连续 50 步无翻无吃判和。</li>
  </ul>
);

export default function BanqiRoute() {
  return (
    <DuelRoute
      game="banqi"
      rules={RULES}
      describe={describe}
      resultText={(room) => (room.result.reason === 'win' ? '对方无子可走 · ' : room.result.reason === 'draw' ? '50 步无翻无吃 · ' : '')}
      renderBoard={(props) => <BanqiBoard {...props} />}
    />
  );
}
