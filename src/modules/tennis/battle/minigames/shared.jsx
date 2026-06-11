/**
 * shared.jsx — 小游戏公共设施：rAF 时钟、外壳、结果反馈
 *
 * 统一契约：<Game onDone={(multiplier 0.5–1.5)=>{}} timeScale windowBonus />
 * 判定全部基于 performance.now()，低帧率设备不吃亏；
 * prefers-reduced-motion 用户由调用方传入 windowBonus 补偿（+0.3）。
 */

import { useEffect, useReducer, useRef, useState } from 'react';

/** rAF 驱动的重渲染时钟；返回当前 performance.now() */
export function useNow(active) {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (!active) return undefined;
    let id;
    const loop = () => { force(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return performance.now();
}

export function verdictText(m) {
  if (m >= 1.35) return '完美！';
  if (m >= 1.05) return '漂亮！';
  if (m >= 0.8) return '一般';
  return '失误……';
}

/**
 * 结果反馈管理：调 finish(multiplier) → 显示判定文案 600ms → onDone。
 * 卸载时清理计时器。
 */
export function useFinish(onDone) {
  const [result, setResult] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const finish = (multiplier, label, extra) => {
    if (result) return;
    setResult({ multiplier, label: label ?? verdictText(multiplier) });
    timer.current = setTimeout(() => onDone(multiplier, extra), 600);
  };
  return [result, finish];
}

export function MinigameShell({ title, hint, result, children }) {
  return (
    <div className="mg-shell">
      <div className="mg-title">{title}</div>
      <div className="mg-stage">
        {children}
        {result && (
          <div className="mg-result">
            <span className="mg-verdict">{result.label}</span>
            <span className="mg-mult">×{result.multiplier.toFixed(2)}</span>
          </div>
        )}
      </div>
      <div className="mg-hint">{hint}</div>
    </div>
  );
}

/** 三角波：0→1→0，周期 period ms */
export function trianglePos(now, t0, period) {
  const phase = ((now - t0) % period) / period;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}
