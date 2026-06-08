import { useEffect, useState } from 'react';

// 手机端断点：<640px（Tailwind sm 以下）。与圆桌/网格分流一致。
export const MOBILE_QUERY = '(max-width: 639px)';

/**
 * 返回当前视口是否为手机端（<640px）。
 * - SSR / 无 matchMedia 环境安全（默认 false）。
 * - 监听 matchMedia change（含旧浏览器 addListener 回退）。
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (event) => setIsMobile(event.matches);

    // 同步一次，防止 render 与 effect 之间断点变化
    setIsMobile(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }

    // 旧浏览器回退
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return isMobile;
}
