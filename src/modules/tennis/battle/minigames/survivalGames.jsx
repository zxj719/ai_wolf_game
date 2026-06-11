/**
 * survivalGames.jsx — 坚持类小游戏（spec §7b）：撑过 10 秒即过关，难度随等级递增。
 *
 * 🐦 FlappyBall：点击扇翅穿过球拍缝隙
 * 🛸 DodgeRain：左右拖动躲网球弹幕
 *
 * 契约：onDone(multiplier, {passed, level})，过关 1.5 / 失败 0.5。
 * 挂载即 bumpLevel（每玩一次难度上升）。物理全部基于时间戳，与帧率无关。
 */

import { useEffect, useRef, useState } from 'react';
import { MinigameShell, useNow, useFinish } from './shared';
import { getLevel, bumpLevel, flappyParams, dodgeParams } from './levels';

export const SURVIVAL_MS = 10000;

function useSurvival(gameKey, onDone, levelBonus = 0) {
  const levelRef = useRef(null);
  if (levelRef.current === null) {
    levelRef.current = getLevel(gameKey) + levelBonus;
    bumpLevel(gameKey);
  }
  const [result, rawFinish] = useFinish(onDone);
  const level = levelRef.current;
  const finish = (passed) =>
    rawFinish(passed ? 1.5 : 0.5, passed ? '撑住了！CLUTCH！' : '差一点……', { passed, level });
  return { level, result, finish };
}

/** 🐦 飞翔的网球（Flappy） */
export function FlappyBall({ onDone, levelBonus = 0 }) {
  const { level, result, finish } = useSurvival('flappy', onDone, levelBonus);
  const p = flappyParams(level);
  const t0 = useRef(performance.now());
  const phys = useRef({ y: 0.5, vy: 0, lastT: performance.now(), pipes: [], nextSpawn: 600 });
  const now = useNow(!result);

  // 时间步进物理（refs 内推进，渲染读取）
  if (!result) {
    const s = phys.current;
    const dt = Math.min(50, now - s.lastT) / 1000;
    s.lastT = now;
    s.vy += 1.6 * dt;                       // 重力（屏/秒²）
    s.y += s.vy * dt;
    const elapsed = now - t0.current;
    if (elapsed > s.nextSpawn) {
      s.pipes.push({ x: 1.05, gapY: 0.18 + Math.random() * (0.64 - p.gapRatio) });
      s.nextSpawn = elapsed + p.spawnMs;
    }
    s.pipes.forEach((pipe) => { pipe.x -= p.speed * dt; });
    s.pipes = s.pipes.filter((pipe) => pipe.x > -0.15);

    const hitWall = s.y < 0.02 || s.y > 0.95;
    const hitPipe = s.pipes.some((pipe) =>
      pipe.x < 0.24 && pipe.x > 0.10 &&
      (s.y < pipe.gapY || s.y > pipe.gapY + p.gapRatio));
    if (hitWall || hitPipe) finish(false);
    else if (elapsed >= SURVIVAL_MS) finish(true);
  }

  const flap = () => {
    if (!result) phys.current.vy = -0.62;
  };
  const remain = Math.max(0, (SURVIVAL_MS - (now - t0.current)) / 1000);
  const s = phys.current;

  return (
    <MinigameShell
      title={`🐦 飞翔的网球 LV.${level + 1}`}
      hint={`点击扇翅！撑过 ${remain.toFixed(1)}s 就赢`}
      result={result}
    >
      <button type="button" className="mg-tap-area mg-sky" onPointerDown={flap}>
        <div className="mg-flap-ball" style={{ top: `${s.y * 100}%` }}>🎾</div>
        {s.pipes.map((pipe, i) => (
          <div key={i}>
            <div className="mg-pipe top" style={{ left: `${pipe.x * 100}%`, height: `${pipe.gapY * 100}%` }} />
            <div className="mg-pipe bottom" style={{ left: `${pipe.x * 100}%`, top: `${(pipe.gapY + p.gapRatio) * 100}%` }} />
          </div>
        ))}
        <div className="mg-survive-timer">{remain.toFixed(1)}s</div>
      </button>
    </MinigameShell>
  );
}

/** 🛸 躲避发球机（弹幕） */
export function DodgeRain({ onDone, levelBonus = 0 }) {
  const { level, result, finish } = useSurvival('dodge', onDone, levelBonus);
  const p = dodgeParams(level);
  const t0 = useRef(performance.now());
  const phys = useRef({ px: 0.5, balls: [], nextWave: 500 });
  const areaRef = useRef(null);
  const now = useNow(!result);

  if (!result) {
    const s = phys.current;
    const elapsed = now - t0.current;
    if (elapsed > s.nextWave) {
      for (let i = 0; i < p.ballsPerWave; i++) {
        s.balls.push({ x: 0.06 + Math.random() * 0.88, born: now });
      }
      s.nextWave = elapsed + p.waveMs;
    }
    s.balls = s.balls.filter((b) => now - b.born < p.fallMs + 200);
    const hit = s.balls.some((b) => {
      const fy = (now - b.born) / p.fallMs;          // 0→1 落到底
      return fy > 0.88 && fy < 1.0 && Math.abs(b.x - s.px) < 0.07;
    });
    if (hit) finish(false);
    else if (elapsed >= SURVIVAL_MS) finish(true);
  }

  const move = (e) => {
    if (result || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    phys.current.px = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
  };
  const remain = Math.max(0, (SURVIVAL_MS - (now - t0.current)) / 1000);
  const s = phys.current;

  return (
    <MinigameShell
      title={`🛸 躲避发球机 LV.${level + 1}`}
      hint={`左右拖动躲球！撑过 ${remain.toFixed(1)}s`}
      result={result}
    >
      <div
        ref={areaRef}
        className="mg-tap-area mg-sky"
        onPointerMove={move}
        onPointerDown={move}
      >
        {s.balls.map((b, i) => (
          <div key={i} className="mg-rain-ball"
            style={{ left: `${b.x * 100}%`, top: `${Math.min(0.92, (now - b.born) / p.fallMs) * 100}%` }}>🎾</div>
        ))}
        <div className="mg-paddle" style={{ left: `${s.px * 100}%` }}>🏃</div>
        <div className="mg-survive-timer">{remain.toFixed(1)}s</div>
      </div>
    </MinigameShell>
  );
}
