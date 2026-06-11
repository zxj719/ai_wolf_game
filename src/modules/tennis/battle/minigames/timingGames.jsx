/**
 * timingGames.jsx — 时机判定类小游戏：
 * ServeTiming（发球）/ PrecisionStop（切削）/ RhythmBar（上旋三连拍）/
 * DualTiming（穿越双判）/ ShrinkSmash（高压缩圈）
 */

import { useRef, useState } from 'react';
import { MinigameShell, useNow, useFinish, trianglePos } from './shared';
import {
  toMultiplier, timingAccuracy, serveResult, comboAccuracy, zoneAccuracy,
} from './minigameMath';

/** 水平滑条 + 甜区 + 游标 */
function Bar({ pos, zoneCenter = 0.5, zoneHalf = 0.08, fast = false }) {
  return (
    <div className={`mg-bar ${fast ? 'fast' : ''}`}>
      <div
        className="mg-zone"
        style={{ left: `${(zoneCenter - zoneHalf) * 100}%`, width: `${zoneHalf * 200}%` }}
      />
      <div className="mg-cursor" style={{ left: `${pos * 100}%` }} />
    </div>
  );
}

/** 发球：onServe('ace'|'good'|'fault')，与普通小游戏契约不同 */
export function ServeTiming({ onServe, timeScale = 1, windowBonus = 0 }) {
  const period = 1200 * timeScale;
  const t0 = useRef(performance.now());
  const [result, setResult] = useState(null);
  const timer = useRef(null);
  const now = useNow(!result);
  const pos = trianglePos(now, t0.current, period);

  const hit = () => {
    if (result) return;
    const deltaMs = Math.abs(pos - 0.5) * period / 2;
    const r = serveResult(deltaMs, 60, 220, windowBonus);
    const label = r === 'ace' ? 'ACE！🎾' : r === 'good' ? '好球！' : '二发……';
    setResult({ label });
    timer.current = setTimeout(() => onServe(r), 600);
  };

  return (
    <MinigameShell title="🎾 发球" hint="游标进入甜区瞬间点击！正中=ACE" result={null}>
      <button type="button" className="mg-tap-area" onPointerDown={hit}>
        <Bar pos={pos} />
        {result && <div className="mg-result"><span className="mg-verdict">{result.label}</span></div>}
      </button>
    </MinigameShell>
  );
}

/** 切削：高速游标急停窄甜区 */
export function PrecisionStop({ onDone, timeScale = 1, windowBonus = 0 }) {
  const period = 700 * timeScale;
  const t0 = useRef(performance.now());
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const pos = trianglePos(now, t0.current, period);

  const hit = () => {
    const deltaMs = Math.abs(pos - 0.5) * period / 2;
    finish(toMultiplier(timingAccuracy(deltaMs, 130, windowBonus)));
  };

  return (
    <MinigameShell title="🔪 切削放缓" hint="手腕一抖，停在甜区！" result={result}>
      <button type="button" className="mg-tap-area" onPointerDown={hit}>
        <Bar pos={pos} zoneHalf={0.06} fast />
      </button>
    </MinigameShell>
  );
}

/** 上旋三连拍：三次过线点击取平均 */
export function RhythmBar({ onDone, timeScale = 1, windowBonus = 0 }) {
  const period = 900 * timeScale;
  const t0 = useRef(performance.now());
  const [hits, setHits] = useState([]);
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const pos = trianglePos(now, t0.current, period);

  const hit = () => {
    if (result) return;
    const deltaMs = Math.abs(pos - 0.5) * period / 2;
    const acc = timingAccuracy(deltaMs, 160, windowBonus);
    const next = [...hits, acc];
    if (next.length >= 3) {
      finish(toMultiplier(comboAccuracy(next)));
    } else {
      setHits(next);
    }
  };

  return (
    <MinigameShell
      title={`🌀 上旋抽击 ${hits.length}/3`}
      hint="跟着节奏，三次甜区点击！"
      result={result}
    >
      <button type="button" className="mg-tap-area" onPointerDown={hit}>
        <Bar pos={pos} />
        <div className="mg-pips">{[0, 1, 2].map((i) => (
          <i key={i} className={i < hits.length ? 'on' : ''} />
        ))}</div>
      </button>
    </MinigameShell>
  );
}

/** 穿越球：两段连续判定，第二段更快 */
export function DualTiming({ onDone, timeScale = 1, windowBonus = 0 }) {
  const [stage, setStage] = useState(0);
  const [first, setFirst] = useState(0);
  const t0 = useRef(performance.now());
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const period = (stage === 0 ? 1000 : 650) * timeScale;
  const pos = trianglePos(now, t0.current, period);

  const hit = () => {
    if (result) return;
    const deltaMs = Math.abs(pos - 0.5) * period / 2;
    const acc = timingAccuracy(deltaMs, 150, windowBonus);
    if (stage === 0) {
      setFirst(acc);
      setStage(1);
      t0.current = performance.now();
    } else {
      finish(toMultiplier(comboAccuracy([first, acc])));
    }
  };

  return (
    <MinigameShell
      title={`⚡ 穿越球 第${stage + 1}拍`}
      hint="先压拍再出手——两次甜区！"
      result={result}
    >
      <button type="button" className="mg-tap-area" onPointerDown={hit}>
        <Bar pos={pos} zoneHalf={0.07} fast={stage === 1} />
      </button>
    </MinigameShell>
  );
}

/** 高压扣杀：圆圈收缩到目标环带时点击 */
export function ShrinkSmash({ onDone, timeScale = 1, windowBonus = 0 }) {
  const duration = 2000 * timeScale;
  const t0 = useRef(performance.now());
  const [result, finish] = useFinish(onDone);
  const now = useNow(!result);
  const progress = Math.min(1, (now - t0.current) / duration);
  const radius = 1 - progress;             // 1 → 0

  const hit = () => {
    finish(toMultiplier(zoneAccuracy(radius * 100, 37.5, 14, windowBonus)));
  };
  if (progress >= 1 && !result) {
    finish(0.5, '球落地了……');
  }

  return (
    <MinigameShell title="💥 高压扣杀" hint="圈缩到金环时砸下去！" result={result}>
      <button type="button" className="mg-tap-area mg-smash" onPointerDown={hit}>
        <div className="mg-ring target" style={{ width: '37.5%', height: '37.5%' }} />
        <div className="mg-ring live" style={{ width: `${radius * 100}%`, height: `${radius * 100}%` }} />
      </button>
    </MinigameShell>
  );
}
