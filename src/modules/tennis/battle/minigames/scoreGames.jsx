/**
 * scoreGames.jsx — 刷分类小游戏（spec §7b）：15 秒内刷分，分数兑换数值。
 *
 * ⛏️ GoldMiner：摆动钩爪抓金球避炸弹
 * 🦘 JumpJump：蓄力跳台，正中连击翻倍
 *
 * 契约：onDone(multiplier, {score})。multiplier 由 scoreToMultiplier 归一，
 * score 原始分供消费方兑换（开盒=金币、闯关事件=属性）。
 */

import { useRef, useState } from 'react';
import { MinigameShell, useNow, verdictText } from './shared';
import { scoreToMultiplier } from './levels';

export const SCORE_MS = 15000;

function useScoreFinish(onDone) {
  const [result, setResult] = useState(null);
  const timer = useRef(null);
  const finish = (score) => {
    if (result) return;
    const m = scoreToMultiplier(score);
    setResult({ multiplier: m, label: `${verdictText(m)} ${score} 分` });
    timer.current = setTimeout(() => onDone(m, { score }), 800);
  };
  return [result, finish];
}

/** ⛏️ 黄金球工 */
export function GoldMiner({ onDone }) {
  const t0 = useRef(performance.now());
  const [score, setScore] = useState(0);
  const [result, finish] = useScoreFinish(onDone);
  const claw = useRef({ extending: false, startT: 0, angle: 0, hit: null });
  const items = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 0.12 + Math.random() * 0.76,
      y: 0.45 + Math.random() * 0.45,
      kind: i < 5 ? 'gold' : i < 7 ? 'big' : 'bomb',
      taken: false,
    }))
  );
  const now = useNow(!result);
  const elapsed = now - t0.current;
  if (elapsed >= SCORE_MS && !result) finish(score);

  const c = claw.current;
  // 钩爪角度：未发射时三角摆动 ±70°
  if (!c.extending) {
    const phase = ((now - t0.current) % 1600) / 1600;
    c.angle = (phase < 0.5 ? phase * 2 : 2 - phase * 2) * 140 - 70;
  }
  // 发射进度：0→1 伸出（600ms），1→2 收回
  const prog = c.extending ? Math.min(2, (now - c.startT) / 600) : 0;
  const reach = prog <= 1 ? prog : 2 - prog;
  if (c.extending) {
    if (prog <= 1 && !c.hit) {
      const rad = (c.angle + 90) * Math.PI / 180;
      const cx = 0.5 + Math.cos(rad) * reach * 0.48;
      const cy = 0.08 + Math.sin(rad) * reach * 0.85;
      const hit = items.current.find((it) => !it.taken
        && Math.abs(it.x - cx) < 0.07 && Math.abs(it.y - cy) < 0.09);
      if (hit) { hit.taken = true; c.hit = hit; }
    }
    if (prog >= 2) {
      if (c.hit) {
        const delta = c.hit.kind === 'gold' ? 10 : c.hit.kind === 'big' ? 25 : -15;
        setScore((s) => Math.max(0, s + delta));
      }
      c.extending = false;
      c.hit = null;
    }
  }

  const launch = () => {
    if (result || c.extending) return;
    c.extending = true;
    c.startT = performance.now();
  };

  const remain = Math.max(0, (SCORE_MS - elapsed) / 1000);
  const rad = (c.angle + 90) * Math.PI / 180;
  return (
    <MinigameShell
      title="⛏️ 黄金球工"
      hint={`点击放钩！金球+10 大金球+25 炸弹-15 · ${remain.toFixed(1)}s`}
      result={result}
    >
      <button type="button" className="mg-tap-area mg-mine" onPointerDown={launch}>
        <div className="mg-score-badge">{score} 分</div>
        {items.current.filter((it) => !it.taken).map((it) => (
          <span key={it.id} className="mg-mine-item"
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%` }}>
            {it.kind === 'gold' ? '🟡' : it.kind === 'big' ? '🌕' : '💣'}
          </span>
        ))}
        <div className="mg-claw-line" style={{
          transform: `rotate(${c.angle}deg) scaleY(${0.12 + reach * 0.88})`,
        }} />
        <span className="mg-claw-head" style={{
          left: `${(0.5 + Math.cos(rad) * reach * 0.48) * 100}%`,
          top: `${(0.08 + Math.sin(rad) * reach * 0.85) * 100}%`,
        }}>{c.hit ? (c.hit.kind === 'bomb' ? '💣' : '🟡') : '🪝'}</span>
        <div className="mg-survive-timer">{remain.toFixed(1)}s</div>
      </button>
    </MinigameShell>
  );
}

/** 🦘 跳一跳 */
export function JumpJump({ onDone }) {
  const t0 = useRef(performance.now());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [result, finish] = useScoreFinish(onDone);
  const world = useRef({
    holdStart: null,
    jumper: 0.18,                                 // 当前位置（屏宽比例）
    platform: 0.55 + Math.random() * 0.3,          // 下一台子中心
    platformW: 0.16,
    flying: null,                                  // {from, to, startT}
  });
  const now = useNow(!result);
  const elapsed = now - t0.current;
  if (elapsed >= SCORE_MS && !result) finish(score);

  const w = world.current;
  // 跳跃动画 400ms，落地判定
  if (w.flying && now - w.flying.startT > 400) {
    const landed = Math.abs(w.flying.to - w.platform) < w.platformW / 2;
    const perfect = Math.abs(w.flying.to - w.platform) < w.platformW / 6;
    if (landed) {
      const nextCombo = perfect ? combo + 1 : 0;
      setCombo(nextCombo);
      setScore((s) => s + 5 + (perfect ? 5 * (nextCombo + 1) : 0));
      w.jumper = 0.18;
      w.platform = 0.45 + Math.random() * 0.42;
      w.platformW = Math.max(0.10, 0.16 - elapsed / SCORE_MS * 0.05);
      w.flying = null;
    } else {
      finish(score);    // 摔下去：以当前分结算
    }
  }

  const press = () => { if (!result && !w.flying) w.holdStart = performance.now(); };
  const release = () => {
    if (result || !w.holdStart || w.flying) return;
    const power = Math.min(1, (performance.now() - w.holdStart) / 1100);
    w.flying = { from: w.jumper, to: w.jumper + power * 0.85, startT: performance.now() };
    w.holdStart = null;
  };

  const holdPower = w.holdStart ? Math.min(1, (now - w.holdStart) / 1100) : 0;
  const jumpProg = w.flying ? Math.min(1, (now - w.flying.startT) / 400) : 0;
  const jx = w.flying ? w.flying.from + (w.flying.to - w.flying.from) * jumpProg : w.jumper;
  const jy = w.flying ? Math.sin(jumpProg * Math.PI) * 0.4 : 0;
  const remain = Math.max(0, (SCORE_MS - elapsed) / 1000);

  return (
    <MinigameShell
      title={`🦘 跳一跳 ${combo > 0 ? `🔥连击×${combo + 1}` : ''}`}
      hint={`按住蓄力松手跳！正中连击翻倍 · ${remain.toFixed(1)}s`}
      result={result}
    >
      <button type="button" className="mg-tap-area mg-jump"
        onPointerDown={press} onPointerUp={release} onPointerLeave={release}>
        <div className="mg-score-badge">{score} 分</div>
        <div className="mg-platform start" style={{ left: '18%' }} />
        <div className="mg-platform" style={{ left: `${w.platform * 100}%`, width: `${w.platformW * 100}%` }} />
        <div className="mg-jumper" style={{ left: `${jx * 100}%`, bottom: `${18 + jy * 100}%` }}>🎾</div>
        {holdPower > 0 && (
          <div className="mg-bar mg-jump-power"><div className="mg-fill" style={{ width: `${holdPower * 100}%` }} /></div>
        )}
        <div className="mg-survive-timer">{remain.toFixed(1)}s</div>
      </button>
    </MinigameShell>
  );
}
