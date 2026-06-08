import React, { act } from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ThemeScope } from '../ThemeScope.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    scope: () => container.querySelector('[data-theme]'),
    unmount() { act(() => root.unmount()); container.remove(); },
  };
}

describe('ThemeScope', () => {
  it('sets data-theme on the scope element', () => {
    const h = mount(<ThemeScope theme="dark"><span>hi</span></ThemeScope>);
    expect(h.scope().getAttribute('data-theme')).toBe('dark');
    h.unmount();
  });

  it('re-establishes the theme foreground color so inherited text follows the scope', () => {
    // Regression: data-theme swaps CSS *variables* but not the inherited `color`.
    // A dark module under a light document inherited the light body ink (dark) →
    // dark-on-dark text. The scope element must re-declare color so inherited text
    // resolves within the scope's theme.
    const h = mount(<ThemeScope theme="dark"><span>hi</span></ThemeScope>);
    expect(h.scope().style.color).toBe('var(--mac-ink)');
    h.unmount();
  });

  it('preserves caller-provided inline styles alongside the foreground color', () => {
    const h = mount(<ThemeScope theme="light" style={{ width: '10px' }}><span>hi</span></ThemeScope>);
    expect(h.scope().style.width).toBe('10px');
    expect(h.scope().style.color).toBe('var(--mac-ink)');
    h.unmount();
  });
});
