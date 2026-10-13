import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 可暂停的秒表：start / pause / resume / stop / reset。
 * 计时 = 已累计的分段 + 当前分段，暂停期间不计入（排行榜公平）。
 * stop() 返回精确毫秒。
 */
export function useStopwatch() {
  const accRef = useRef(0);       // 已结束分段的累计毫秒
  const segRef = useRef(null);    // 当前分段开始时刻（null = 未在计时）
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  const now = () => accRef.current + (segRef.current == null ? 0 : performance.now() - segRef.current);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed(now()), 100);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    accRef.current = 0;
    segRef.current = performance.now();
    setElapsed(0);
    setPaused(false);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    if (segRef.current == null) return;
    accRef.current = now();
    segRef.current = null;
    setElapsed(accRef.current);
    setRunning(false);
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (segRef.current != null) return;
    segRef.current = performance.now();
    setPaused(false);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    const ms = now();
    accRef.current = ms;
    segRef.current = null;
    setElapsed(ms);
    setRunning(false);
    setPaused(false);
    return ms;
  }, []);

  const reset = useCallback(() => {
    accRef.current = 0;
    segRef.current = null;
    setElapsed(0);
    setRunning(false);
    setPaused(false);
  }, []);

  return { elapsed, running, paused, start, pause, resume, stop, reset };
}
