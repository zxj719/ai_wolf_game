import React, { act } from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { RoleSelector } from '../RoleSelector.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const validation = { total: 9, isValid: true, errors: [], warnings: [], description: '测试' };

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return { container, unmount() { act(() => root.unmount()); container.remove(); } };
}

describe('RoleSelector dark-theme tokenization', () => {
  it('renders theme tokens (text-ink / bg-bg-raised) and no hardcoded slate text', () => {
    const h = mount(
      <RoleSelector selections={{}} onChange={() => {}} validation={validation} locale="zh" />
    );
    const html = h.container.innerHTML;
    // Tokenized: must use theme-aware ink/surface so dark module is readable.
    expect(html).toContain('text-ink');
    expect(html).toContain('bg-bg-raised');
    // Regression guard: no light-only slate text/surface that goes dark-on-dark.
    expect(html).not.toMatch(/text-slate-\d/);
    expect(html).not.toMatch(/bg-white\/7\d/);
    h.unmount();
  });
});
