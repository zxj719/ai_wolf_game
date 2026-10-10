import { useCallback, useEffect, useRef, useState } from 'react';

/** 简单秒表：start/stop/reset，elapsed 每 100ms 刷新；stop() 返回精确毫秒 */
export function useStopwatch() {
  const startRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed(performance.now() - startRef.current), 100);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    startRef.current = performance.now();
    setElapsed(0);
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    const ms = startRef.current == null ? 0 : performance.now() - startRef.current;
    setElapsed(ms);
    setRunning(false);
    return ms;
  }, []);

  const reset = useCallback(() => {
    startRef.current = null;
    setElapsed(0);
    setRunning(false);
  }, []);

  return { elapsed, running, start, stop, reset };
}
