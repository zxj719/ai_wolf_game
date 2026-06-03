/**
 * pipUtils — 画中画拖拽/缩放的纯计算（无 DOM，便于单测）。
 */

/**
 * 把画中画框夹在视口内：宽夹到 [minW,maxW]，按 16:9 算高，x/y 保证整框可见。
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function clampPiP({ x, y, w, vw, vh, minW = 120, maxW = 480, ratio = 9 / 16 }) {
  const cw = Math.round(Math.max(minW, Math.min(maxW, w)));
  const ch = Math.round(cw * ratio);
  const cx = Math.round(Math.max(0, Math.min(Math.max(0, vw - cw), x)));
  const cy = Math.round(Math.max(0, Math.min(Math.max(0, vh - ch), y)));
  return { x: cx, y: cy, w: cw, h: ch };
}
