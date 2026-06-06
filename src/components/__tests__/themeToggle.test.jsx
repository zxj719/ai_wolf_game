import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ThemeToggle } from '../ThemeToggle.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    button: () => container.querySelector('button'),
    unmount() { act(() => root.unmount()); container.remove(); },
  };
}

describe('ThemeToggle', () => {
  it('reflects current pref via data-pref', () => {
    const h = mount(<ThemeToggle pref="dark" onChange={() => {}} />);
    expect(h.button().getAttribute('data-pref')).toBe('dark');
    h.unmount();
  });

  it('cycles system -> light -> dark -> system on click', () => {
    for (const [pref, next] of [['system', 'light'], ['light', 'dark'], ['dark', 'system']]) {
      const onChange = vi.fn();
      const h = mount(<ThemeToggle pref={pref} onChange={onChange} />);
      act(() => { h.button().click(); });
      expect(onChange).toHaveBeenCalledWith(next);
      h.unmount();
    }
  });
});
