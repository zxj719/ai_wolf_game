import React, { useCallback, useEffect, useState } from 'react';
import { clampPiP } from '../pipUtils';

const vw = () => (typeof window !== 'undefined' ? window.innerWidth : 1280);
const vh = () => (typeof window !== 'undefined' ? window.innerHeight : 720);

/**
 * DraggablePiP — 可拖动 + 右下角可缩放的画中画容器（鼠标/触摸统一 Pointer Events）。
 * 自管位置/尺寸；首挂载移到右下；全程 clampPiP 夹在视口内。
 */
export function DraggablePiP({ children, initialW = 176 }) {
  const [box, setBox] = useState(() => ({ x: 16, y: 16, w: initialW, h: Math.round(initialW * 9 / 16) }));

  // 挂载后移到右下（SSR 时无 window，保持初始左上）
  useEffect(() => {
    setBox((b) => clampPiP({ x: vw() - b.w - 16, y: vh() - b.h - 96, w: b.w, vw: vw(), vh: vh() }));
  }, []);

  const startGesture = useCallback((onMove) => {
    const move = (ev) => onMove(ev);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const onDragDown = useCallback((e) => {
    if (e.target?.dataset?.resize) return;            // resize handle 自己处理
    const sx = e.clientX, sy = e.clientY, orig = box;
    startGesture((ev) => setBox(clampPiP({ x: orig.x + (ev.clientX - sx), y: orig.y + (ev.clientY - sy), w: orig.w, vw: vw(), vh: vh() })));
  }, [box, startGesture]);

  const onResizeDown = useCallback((e) => {
    e.stopPropagation();
    const sx = e.clientX, orig = box;
    startGesture((ev) => setBox(clampPiP({ x: orig.x, y: orig.y, w: orig.w + (ev.clientX - sx), vw: vw(), vh: vh() })));
  }, [box, startGesture]);

  return (
    <div
      className="absolute z-10 touch-none cursor-move select-none"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerDown={onDragDown}
    >
      {children}
      <div
        data-resize="1"
        onPointerDown={onResizeDown}
        className="absolute bottom-0 right-0 w-4 h-4 bg-white/70 rounded-tl cursor-se-resize"
        title="拖动缩放"
      />
    </div>
  );
}

export default DraggablePiP;
