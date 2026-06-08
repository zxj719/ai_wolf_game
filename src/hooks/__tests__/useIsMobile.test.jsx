import React, { act } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { useIsMobile } from '../useIsMobile.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// 构造一个可控的 matchMedia mock，返回 { setMatches } 以驱动 change 事件
function installMatchMedia(initialMatches) {
  let matches = initialMatches;
  const listeners = new Set();
  const mql = {
    get matches() { return matches; },
    media: '(max-width: 639px)',
    addEventListener: (_type, cb) => listeners.add(cb),
    removeEventListener: (_type, cb) => listeners.delete(cb),
    // 旧 API（不被新代码使用，但保留以防回退分支）
    addListener: (cb) => listeners.add(cb),
    removeListener: (cb) => listeners.delete(cb),
  };
  window.matchMedia = vi.fn(() => mql);
  return {
    setMatches(next) {
      matches = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };
}

function Probe({ onValue }) {
  const isMobile = useIsMobile();
  onValue(isMobile);
  return null;
}

function mount(onValue) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<Probe onValue={onValue} />); });
  return { unmount() { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => {
  delete window.matchMedia;
});

describe('useIsMobile', () => {
  it('returns false when matchMedia is unavailable (SSR-safe)', () => {
    const values = [];
    const h = mount((v) => values.push(v));
    expect(values.at(-1)).toBe(false);
    h.unmount();
  });

  it('returns true when the mobile query matches initially', () => {
    installMatchMedia(true);
    const values = [];
    const h = mount((v) => values.push(v));
    expect(values.at(-1)).toBe(true);
    h.unmount();
  });

  it('updates when the media query change event fires', () => {
    const control = installMatchMedia(false);
    const values = [];
    const h = mount((v) => values.push(v));
    expect(values.at(-1)).toBe(false);
    act(() => { control.setMatches(true); });
    expect(values.at(-1)).toBe(true);
    h.unmount();
  });
});
