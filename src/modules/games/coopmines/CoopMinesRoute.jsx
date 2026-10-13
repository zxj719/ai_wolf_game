import { useMemo, useRef, useState } from 'react';
import { Flag, Pointer } from 'lucide-react';
import { buildNeighbors } from '../minesweeper/mineEngine';
import DuelRoute from '../duel/DuelRoute';
import { DockButton, Segmented } from '../shared/GameStage';
import { haptic } from '../shared/haptics';
import '../minesweeper/minesweeper.css';
import './coopmines.css';

const DIFFS = [
  { value: 'beginner', label: '初级', hint: '9×9' },
  { value: 'intermediate', label: '中级', hint: '16×16' },
  { value: 'expert', label: '高级', hint: '30×16' },
];

function FlagIcon({ mine }) {
  return (
    <svg viewBox="0 0 24 24" className={`ms-icon ms-flag${mine ? '' : ' is-partner'}`} aria-hidden="true">
      <path d="M7 3v18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M8 4h10l-2.6 4L18 12H8z" fill={mine ? 'var(--gs-red)' : 'var(--gs-orange)'} />
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
    </svg>
  );
}

function CoopBoard({ room, duel, width, height, flagMode }) {
  const s = room.state;
  const { rows, cols, cells, flags, lastI } = s;
  const neighbors = useMemo(() => buildNeighbors(rows, cols), [rows, cols]);
  const myTurn = room.status === 'playing' && s.turn === room.seat;
  const over = room.status === 'over';
  const mineSet = new Set(s.mineList || []);
  const longPress = useRef({ id: null, fired: false });

  const flag = (i) => {
    if (over || cells[i] !== -1 || !s.started) return;
    haptic('medium');
    duel.act({ type: 'flag', i });
  };
  const open = (i) => {
    if (over) return;
    if (!myTurn) { haptic('light'); duel.say('轮到队友了，等一下～'); return; }
    if (flags[i]) return;
    if (cells[i] >= 0) {
      // chord：本地先判，避免无效请求刷错误提示
      const n = cells[i];
      const around = neighbors[i];
      const f = around.filter((j) => flags[j]).length;
      if (n <= 0 || f !== n || !around.some((j) => cells[j] === -1 && !flags[j])) return;
    }
    haptic('light');
    duel.act({ type: 'reveal', i });
  };
  const primary = (i) => {
    if (longPress.current.fired) { longPress.current.fired = false; return; }
    if (flagMode && cells[i] === -1) flag(i); else open(i);
  };

  // 尺寸：与单人扫雷一致，竖屏放不下宽棋盘时转置
  const transpose = height > width && cols > rows;
  const vCols = transpose ? rows : cols;
  const vRows = transpose ? cols : rows;
  let gap = 3;
  let pad = 10;
  const fit = (avail, count) => (avail - pad * 2 - gap * (count - 1)) / count;
  let cell = Math.floor(Math.min(fit(width, vCols), fit(height, vRows)));
  if (cell < 30) { gap = 2; pad = 6; cell = Math.floor(Math.min(fit(width, vCols), fit(height, vRows))); }
  cell = Math.min(cell, 60);
  if (cell < 18) cell = Math.max(18, Math.floor(fit(width, vCols)));

  const or = lastI >= 0 ? Math.floor(lastI / cols) : 0;
  const oc = lastI >= 0 ? lastI % cols : 0;
  const ex = s.exploded;
  const er = ex >= 0 ? Math.floor(ex / cols) : 0;
  const ec = ex >= 0 ? ex % cols : 0;

  const out = [];
  for (let vr = 0; vr < vRows; vr++) {
    for (let vc = 0; vc < vCols; vc++) {
      const r = transpose ? vc : vr;
      const c = transpose ? vr : vc;
      const i = r * cols + c;
      const v = cells[i];
      const isOpen = v >= 0;
      const f = flags[i];
      const showMine = over && mineSet.has(i) && !f;
      const wrongFlag = over && f && s.mineList && !mineSet.has(i);
      let cls = 'ms-cell';
      if (isOpen) cls += ' is-open';
      if (showMine) cls += ' is-mine';
      if (i === ex) cls += ' is-exploded';
      if (room.result?.reason === 'coop-won') cls += ' is-won';
      const d = showMine ? Math.max(Math.abs(r - er), Math.abs(c - ec)) * 45
        : room.result?.reason === 'coop-won' ? (r + c) * 18
          : Math.min(Math.max(Math.abs(r - or), Math.abs(c - oc)) * 24, 520);
      out.push(
        <button
          key={i}
          type="button"
          className={cls}
          style={{ '--d': `${d}ms`, fontSize: cell * 0.5 }}
          onClick={() => primary(i)}
          onContextMenu={(e) => { e.preventDefault(); if (!longPress.current.fired) flag(i); }}
          onTouchStart={() => {
            clearTimeout(longPress.current.id);
            longPress.current.fired = false;
            longPress.current.id = setTimeout(() => { longPress.current.fired = true; if (flagMode) open(i); else flag(i); }, 360);
          }}
          onTouchEnd={() => clearTimeout(longPress.current.id)}
          onTouchMove={() => clearTimeout(longPress.current.id)}
          aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
        >
          {wrongFlag ? <span className="ms-wrong">×</span>
            : f ? <FlagIcon mine={f === room.seat} />
              : showMine ? <MineIcon />
                : v > 0 ? <span className={`ms-n ms-n${v}`}>{v}</span> : null}
        </button>,
      );
    }
  }

  return (
    <div className="ms-scroll" style={{ maxWidth: width, maxHeight: height }}>
      <div
        className={`ms-board${room.result?.reason === 'coop-lost' ? ' gs-shake' : ''}${myTurn ? ' cm-my-turn' : ' cm-wait'}`}
        style={{
          gridTemplateColumns: `repeat(${vCols}, ${cell}px)`,
          gridAutoRows: `${cell}px`,
          gap,
          padding: pad,
          width: cell * vCols + gap * (vCols - 1) + pad * 2,
          '--r': `${Math.max(4, Math.round(cell * 0.22))}px`,
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {out}
      </div>
    </div>
  );
}

const RULES = (
  <ul>
    <li>两人<b>轮流</b>行动：每回合翻开一个格子（或点数字快速翻开周围，旗数相符时）。</li>
    <li><b>插旗不占回合</b>：任何人任何时候都能插 / 拔旗，旗子双方共享——<span style={{ color: 'var(--gs-red)' }}>红旗</span>是你插的，<span style={{ color: 'var(--gs-orange)' }}>橙旗</span>是队友插的。</li>
    <li>雷区由无猜生成器生成：首击周围必空，全盘靠推理就能扫完，不需要猜。</li>
    <li><b>共同胜负</b>：翻开所有安全格一起通关；任何一人踩雷两人一起输。</li>
    <li>操作：点击翻开，右键 / 长按插旗；手机上也可以切到「插旗」模式。</li>
  </ul>
);

const DIFF_LABEL = { beginner: '初级', intermediate: '中级', expert: '高级' };

export default function CoopMinesRoute() {
  const [difficulty, setDifficulty] = useState('intermediate');
  const [flagMode, setFlagMode] = useState(false);

  const describe = (room) => {
    const s = room.state;
    const mate = room.seat === 1 ? 2 : 1;
    const flagsLeft = s.mineCount - s.flags.filter(Boolean).length;
    return {
      turnText: (mine) => `${mine ? '轮到你翻' : '队友翻格中…'} · 🚩${flagsLeft}`,
      myBadge: <span key={s.revealedBy[room.seat]} className="cm-count" title="你翻开的格子数">{s.revealedBy[room.seat]}</span>,
      oppBadge: <span key={`m${s.revealedBy[mate]}`} className="cm-count is-mate" title="队友翻开的格子数">{s.revealedBy[mate]}</span>,
    };
  };

  const extras = (room) => ({
    dock: (
      <DockButton
        icon={flagMode ? Flag : Pointer}
        label={flagMode ? '插旗' : '翻开'}
        on={flagMode}
        onClick={() => setFlagMode((v) => !v)}
        title="切换点击行为（手机上很方便）"
      />
    ),
    message: room.status === 'playing' && !room.state.started && room.state.turn === room.seat
      ? { text: `${DIFF_LABEL[room.state.difficulty]} · 你先手，点任意格开始（首击必空）` } : null,
  });

  const resultOverride = (room, duel) => {
    const s = room.state;
    const mate = room.seat === 1 ? 2 : 1;
    const mateId = room.players[mate - 1];
    const tally = `你翻开 ${s.revealedBy[room.seat]} 格 · ${duel.nameOf(mateId)} 翻开 ${s.revealedBy[mate]} 格`;
    switch (room.result.reason) {
      case 'coop-won': return { emoji: '🎉', title: '合作通关！', detail: `${DIFF_LABEL[s.difficulty]} · ${tally}` };
      case 'coop-lost': return {
        emoji: '💥',
        title: '踩雷了',
        detail: `${s.explodedBy === room.seat ? '你' : duel.nameOf(mateId)}踩到了雷 · ${tally}`,
      };
      case 'disconnect': return { emoji: '📡', title: '对局结束', detail: '有人掉线超时了' };
      case 'resign': return {
        emoji: '🏳️',
        title: '放弃了本局',
        detail: room.result.winner === room.seat ? `${duel.nameOf(mateId)}放弃了` : '你放弃了',
      };
      default: return null;
    }
  };

  return (
    <DuelRoute
      game="coopmines"
      rules={RULES}
      describe={describe}
      extras={extras}
      resultOverride={resultOverride}
      inviteOptions={{ difficulty }}
      lobbyTop={(
        <section className="du-card cm-setup">
          <div>
            <h3>双人合作扫雷</h3>
            <p>选好难度后邀请好友；你们轮流翻格子、共享旗子，一起扫完整个雷区。</p>
          </div>
          <Segmented options={DIFFS} value={difficulty} onChange={setDifficulty} />
        </section>
      )}
      renderBoard={(props) => <CoopBoard {...props} flagMode={flagMode} />}
    />
  );
}
