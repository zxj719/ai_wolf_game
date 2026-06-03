import { describe, expect, it } from 'vitest';
import { clampPiP } from '../pipUtils.js';

describe('clampPiP', () => {
  it('clamps width to [minW, maxW] and derives 16:9 height', () => {
    expect(clampPiP({ x: 0, y: 0, w: 50, vw: 1000, vh: 800 }).w).toBe(120);   // below minW
    expect(clampPiP({ x: 0, y: 0, w: 9999, vw: 4000, vh: 4000 }).w).toBe(480); // above maxW
    const b = clampPiP({ x: 0, y: 0, w: 160, vw: 1000, vh: 800 });
    expect(b.w).toBe(160); expect(b.h).toBe(90);
  });
  it('keeps the whole box inside the viewport', () => {
    const b = clampPiP({ x: 9999, y: 9999, w: 200, vw: 1000, vh: 800 });
    expect(b.x).toBe(1000 - b.w);
    expect(b.y).toBe(800 - b.h);
  });
  it('clamps negative position to 0', () => {
    const b = clampPiP({ x: -50, y: -30, w: 200, vw: 1000, vh: 800 });
    expect(b.x).toBe(0); expect(b.y).toBe(0);
  });
  it('handles a viewport smaller than the box (x/y floor at 0)', () => {
    const b = clampPiP({ x: 10, y: 10, w: 200, vw: 100, vh: 50 });
    expect(b.x).toBe(0); expect(b.y).toBe(0);
  });
});
