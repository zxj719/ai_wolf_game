import { useEffect, useRef, useState } from 'react';

/** 监听元素内容区尺寸（扣除 padding），返回 [ref, { width, height }] */
export function useElementSize(initial = { width: 0, height: 0 }) {
  const ref = useRef(null);
  const [size, setSize] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
