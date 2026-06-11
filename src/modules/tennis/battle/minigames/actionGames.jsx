/**
 * actionGames.jsx — 动作类小游戏：
 * RhythmMash（重炮连点）/ WhackVolley（截击打地鼠）/
 * DirectionReact（挑高球方向反应）/ GaugeDrop（放小球力度）
 */

import { useEffect, useRef, useState } from 'react';
import { MinigameShell, useNow, useFinish } from './shared';
import {
  toMultiplier, mashAccuracy, reactionAccuracy, zoneAccuracy, comboAccuracy,
} from './minigameMath';

/** 重炮平击：3 秒内疯狂连点，目标 18 次 */
export function RhythmMash({ onDone, timeScale = 1, windowBonus = 0 }) {
  const duration = 3000 * timeScale;
  const target = Math.max(8, Math.round(18 * (1 - windowBonus * 0.5)));
  const t0 = useRef(performance.now());
  const [clicks, setClicks] = useState(0);
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const remain = Math.max(0, duration - (now - t0.current));

  if (remain <= 0 && !result) {
    finish(toMultiplier(mashAccuracy(clicks, target)));
  }

  return (
    <MinigameShell
      title="🔨 重炮平击"
      hint={`${(remain / 1000).toFixed(1)}s 内疯狂点击蓄力！`}
      result={result}
    >
      <button
        type="button"
        className="mg-tap-area mg-mash"
        onPointerDown={() => { if (!result) setClicks((c) => c + 1); }}
      >
        <div className="mg-mash-count">{clicks}<small>/{target}</small></div>
        <div className="mg-bar"><div className="mg-fill" style={{ width: `${Math.min(100, (clicks / target) * 100)}%` }} /></div>
      </button>
    </MinigameShell>
  );
}

/** 网前截击：3 颗球先后闪现，点击越快越好 */
export function WhackVolley({ onDone, timeScale = 1, windowBonus = 0 }) {
  const [ball, setBall] = useState(null);          // {x, y, shownAt}
  const [accs, setAccs] = useState([]);
  const [result, finish] = useFinish(onDone);
  const timer = useRef(null);
  const round = accs.length;

  useEffect(() => {
    if (result || round >= 3) return undefined;
    timer.current = setTimeout(() => {
      setBall({
        x: 12 + ((round * 37 + 13) % 70),
        y: 15 + ((round * 53 + 29) % 60),
        shownAt: performance.now(),
      });
    }, (400 + round * 250) * timeScale);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, result]);

  const whack = () => {
    if (!ball || result) return;
    const ms = (performance.now() - ball.shownAt) / (1 + windowBonus);
    const next = [...accs, reactionAccuracy(ms, 220, 850)];
    setBall(null);
    if (next.length >= 3) {
      finish(toMultiplier(comboAccuracy(next)));
    } else {
      setAccs(next);
    }
  };

  return (
    <MinigameShell title={`🥅 网前截击 ${round}/3`} hint="球一闪现立刻拍掉！" result={result}>
      <div className="mg-tap-area mg-court">
        {ball && (
          <button
            type="button"
            className="mg-flyball"
            style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
            onPointerDown={whack}
            aria-label="截击！"
          >🎾</button>
        )}
      </div>
    </MinigameShell>
  );
}

const ARROWS = [
  { key: 'left', icon: '⬅️' },
  { key: 'up', icon: '⬆️' },
  { key: 'right', icon: '➡️' },
];

/** 挑高球：方向闪现，按对应方向键/按钮 */
export function DirectionReact({ onDone, timeScale = 1, windowBonus = 0 }) {
  const [target, setTarget] = useState(null);      // {dir, shownAt}
  const [result, finish] = useFinish(onDone);
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setTimeout(() => {
      const dir = ARROWS[Math.floor(Math.random() * 3)].key;
      setTarget({ dir, shownAt: performance.now() });
    }, (600 + Math.random() * 900) * timeScale);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (dir) => {
    if (result) return;
    if (!target) { finish(0.5, '抢拍了！'); return; }
    if (dir !== target.dir) { finish(0.5, '方向反了！'); return; }
    const ms = (performance.now() - target.shownAt) / (1 + windowBonus);
    finish(toMultiplier(reactionAccuracy(ms, 300, 1000)));
  };

  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right' };
      if (map[e.key]) { e.preventDefault(); pick(map[e.key]); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <MinigameShell title="🌙 挑高球" hint="方向一亮，立刻按对应方向！" result={result}>
      <div className="mg-tap-area mg-direction">
        <div className="mg-dir-target">{target ? ARROWS.find((a) => a.key === target.dir).icon : '…'}</div>
        <div className="mg-dir-buttons">
          {ARROWS.map((a) => (
            <button key={a.key} type="button" className="mg-dir-btn" onPointerDown={() => pick(a.key)}>
              {a.icon}
            </button>
          ))}
        </div>
      </div>
    </MinigameShell>
  );
}

/** 放小球：按住蓄力，在轻柔区（35±10）松手 */
export function GaugeDrop({ onDone, timeScale = 1, windowBonus = 0 }) {
  const duration = 1500 * timeScale;
  const [holdStart, setHoldStart] = useState(null);
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const value = holdStart ? Math.min(100, ((now - holdStart) / duration) * 100) : 0;

  if (value >= 100 && !result) {
    finish(0.5, '用力过猛，出界！');
  }

  const release = () => {
    if (!holdStart || result) return;
    finish(toMultiplier(zoneAccuracy(value, 35, 12, windowBonus)));
  };

  return (
    <MinigameShell title="🪶 放小球" hint="按住蓄力，在轻柔区松手！" result={result}>
      <button
        type="button"
        className="mg-tap-area"
        onPointerDown={() => setHoldStart(performance.now())}
        onPointerUp={release}
        onPointerLeave={release}
      >
        <div className="mg-bar vertical-feel">
          <div className="mg-zone" style={{ left: '23%', width: '24%' }} />
          <div className="mg-fill" style={{ width: `${value}%` }} />
        </div>
      </button>
    </MinigameShell>
  );
}
