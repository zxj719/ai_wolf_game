import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { BANQI_COLS, BANQI_ROWS, PIECE_NAMES, PIECE_SCORE, RANK, targetsFrom } from '../../../../server/games/banqi.js';
import DuelRoute from '../duel/DuelRoute';
import { DockButton } from '../shared/GameStage';
import { haptic } from '../shared/haptics';
import { isMuted, setMuted, sfxFanfare, sfxFlip, sfxHit, sfxOuch } from '../shared/sfx';
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

const SPARKS = Array.from({ length: 10 }, (_, k) => k * 36);

/** 吃子特效：被吃的子碎裂 + 冲击波 + 火花 + 飘分（挂在目标格内，按 ply 只播一次） */
function KillFx({ victim, kill }) {
  const big = kill.points >= 25 || kill.combo >= 2;
  return (
    <span className={`bq-fx${big ? ' is-big' : ''}${kill.own ? ' is-own' : ''}`} aria-hidden="true">
      <span className={`bq-ghost bq-piece ${victim.c === 'r' ? 'is-red' : 'is-black'}`}><b>{PIECE_NAMES[victim.c][victim.t]}</b></span>
      <span className="bq-wave" />
      {SPARKS.map((a) => <i key={a} className="bq-spark" style={{ '--a': `${a}deg` }} />)}
      <span className="bq-points">{kill.own ? '误伤' : `+${kill.points}`}</span>
    </span>
  );
}

/** 局面推进时的音效与触感：吃子方「重击」，被吃方「闷哼」 */
function useBanqiFeedback(room) {
  const { ply = 0, last, turn } = room.state;
  const seen = useRef(ply);
  useEffect(() => {
    if (ply === seen.current) return;
    seen.current = ply;
    if (!last) return;
    if (last.type === 'flip') { sfxFlip(); return; }
    if (!last.kill) return;
    const attacker = turn === 1 ? 2 : 1;
    const k = last.kill;
    if (k.own) { sfxOuch(); if (attacker === room.seat) haptic('error'); return; }
    if (attacker === room.seat) {
      sfxHit(Math.min(1, k.points / 60));
      haptic('heavy');
      if (k.combo >= 2 || last.victim?.t === 'K') sfxFanfare(Math.min(5, 2 + k.combo));
    } else {
      sfxHit(0.3);
      sfxOuch();
      haptic('medium');
    }
  }, [ply, last, turn, room.seat]);
}

const LADDER = ['K', 'A', 'E', 'R', 'N', 'C', 'P'];

/** 常驻的吃子顺序条：大吃小 + 两条例外 */
function RankLegend({ color }) {
  const c = color || 'r';
  return (
    <div className="bq-legend" aria-label="吃子顺序">
      <div className="bq-ladder">
        {LADDER.map((t, k) => (
          <span key={t} className="bq-ladder-item">
            <span className={`bq-mini ${c === 'r' ? 'is-red' : 'is-black'}`}>{PIECE_NAMES[c][t]}</span>
            {k < LADDER.length - 1 && <i>›</i>}
          </span>
        ))}
      </div>
      <div className="bq-legend-notes">
        <span>大吃小 · 同级互吃</span>
        <span><b>{PIECE_NAMES.r.P}{PIECE_NAMES.b.P}</b> 可吃 <b>{PIECE_NAMES.r.K}{PIECE_NAMES.b.K}</b>，反之不行</span>
        <span><b>炮</b> 隔一子打，任意距离、任意子，<b>暗子也能打</b></span>
      </div>
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
  useBanqiFeedback(room);
  const ply = room.state.ply ?? 0;
  const kill = last?.kill;

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
      // 已选中棋子时点到打不到的暗子：只取消选择，绝不顺手翻开（不能白白浪费一手）
      if (sel >= 0) { haptic('light'); setNudge((v) => ({ i, n: v.n + 1 })); setSel(-1); return; }
      haptic('medium');
      duel.act({ type: 'flip', i });
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
  const legendH = width < 560 ? 92 : 64;
  const gap = 6;
  const pad = 12;
  const cell = Math.floor(Math.min(
    (width - pad * 2 - gap * (vCols - 1)) / vCols,
    (height - trayH * 2 - legendH - pad * 2 - gap * (vRows - 1)) / vRows,
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
      <div className="bq-board-wrap">
      {kill && kill.labels.length > 0 && (
        <div key={`shout-${ply}`} className={`bq-shout${kill.own ? ' is-own' : ''}`} aria-live="polite">
          {kill.labels.map((l) => <span key={l}>{l}</span>)}
        </div>
      )}
      <div
        className={`bq-board${kill ? (ply % 2 ? ' is-shake-a' : ' is-shake-b') : ''}${kill && (kill.points >= 25 || kill.combo >= 2) ? ' is-heavy' : ''}`}
        style={{ gridTemplateColumns: `repeat(${vCols}, ${cell}px)`, gap, padding: pad }}
      >
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
              {kill && last.to === i && <KillFx key={`fx-${ply}`} victim={last.victim} kill={kill} />}
            </button>
          );
        })}
      </div>
      </div>
      {myColor ? <Tray color={myColor} types={captured[myColor]} /> : <div className="bq-tray is-empty" />}
      <RankLegend color={myColor} />
    </div>
  );
}

/** 音效开关 + 炮打暗子时提示打掉的是什么（可能是自己的子） */
function extras(room, duel) {
  const muted = isMuted();
  const dock = (
    <DockButton
      icon={muted ? VolumeX : Volume2}
      label={muted ? '静音' : '音效'}
      onClick={() => { setMuted(!muted); duel.say(muted ? '音效已开启' : '音效已关闭'); }}
    />
  );
  const last = room.state.last;
  if (!last?.hidden) return { dock };
  const { c, t } = last.hidden;
  const mine = c === room.state.colors[room.seat];
  return { dock, message: { text: `炮打暗子：打掉了${mine ? '你' : '对方'}的${PIECE_NAMES[c][t]}`, tone: mine ? 'bad' : undefined } };
}

function badge(color, score) {
  return (
    <>
      {color
        ? <span className={`bq-badge ${color === 'r' ? 'is-red' : 'is-black'}`}>{COLOR_NAME[color]}</span>
        : <span className="bq-badge">?</span>}
      <span key={score} className="bq-score" title="得分">{score}</span>
    </>
  );
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
    myBadge: badge(mine, room.state.scores?.[room.seat] ?? 0),
    oppBadge: badge(opp, room.state.scores?.[room.seat === 1 ? 2 : 1] ?? 0),
  };
}

const RULES = (
  <ul>
    <li>4×8 棋盘，32 枚棋子<b>背面朝上</b>随机摆放；先手随机。</li>
    <li>每回合三选一：<b>翻开</b>一枚暗子、己方明子<b>走一步</b>（上下左右）、或<b>吃子</b>。首个翻子的人执所翻棋子的颜色。</li>
    <li>大小：<b>帅将 &gt; 仕士 &gt; 相象 &gt; 车 &gt; 马 &gt; 炮 &gt; 兵卒</b>，大吃小、同级互吃；兵卒可吃帅将，帅将不能吃兵卒。</li>
    <li><b>炮</b>平时走一步；吃子须<b>隔且只隔一枚</b>棋子（明暗都能当炮架），沿直线打任意距离的目标：对方任意大小的明子，或<b>任意暗子</b>——翻开若是自己的子，照样被打掉。</li>
    <li>除炮以外，只能吃对方明子。吃光对方或让对方无路可走即胜；连续 50 步无翻无吃判和。</li>
    <li><b>得分</b>（荣誉用，不影响胜负）：帅将 {PIECE_SCORE.K}、仕士 {PIECE_SCORE.A}、相象 {PIECE_SCORE.E}、炮 {PIECE_SCORE.C}、车 {PIECE_SCORE.R}、马 {PIECE_SCORE.N}、兵卒 {PIECE_SCORE.P}；以小博大 +10、炮轰暗子 +5、连杀每多一杀 +5；炮打到自己的暗子算误伤，不得分。</li>
  </ul>
);

export default function BanqiRoute() {
  return (
    <DuelRoute
      game="banqi"
      rules={RULES}
      describe={describe}
      extras={extras}
      resultText={(room) => {
        const sc = room.state.scores ?? { 1: 0, 2: 0 };
        const why = room.result.reason === 'win' ? '对方无子可走 · ' : room.result.reason === 'draw' ? '50 步无翻无吃 · ' : '';
        return `${why}得分 ${sc[room.seat]} : ${sc[room.seat === 1 ? 2 : 1]} · `;
      }}
      renderBoard={(props) => <BanqiBoard {...props} />}
    />
  );
}
