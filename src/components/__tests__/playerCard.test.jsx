import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { PlayerCard } from '../PlayerCard.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const basePlayer = {
  id: 3,
  name: '阿强',
  role: '预言家',
  isAlive: true,
  isUser: true,
  avatarColor: '#abc',
  avatarUrl: null,
};

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    container,
    card: () => container.querySelector('div.rounded-2xl'),
    unmount() { act(() => root.unmount()); container.remove(); },
  };
}

describe('PlayerCard', () => {
  it('renders id, name and the user role tag', () => {
    const h = mount(<PlayerCard player={basePlayer} variant="circle" gameMode="human" phase="day_discussion" />);
    expect(h.container.textContent).toContain('阿强');
    expect(h.container.textContent).toContain('预言家');
    expect(h.container.textContent).toContain('3');
    h.unmount();
  });

  it('circle variant uses CSS-var sizing and touch-none (no visual regression)', () => {
    const h = mount(<PlayerCard player={basePlayer} variant="circle" />);
    const cls = h.card().className;
    expect(cls).toContain('w-[var(--card-width)]');
    expect(cls).toContain('touch-none');
    expect(cls).toContain('cursor-grab');
    h.unmount();
  });

  it('grid variant fills the cell, is tappable, and selects on click', () => {
    const onSelect = vi.fn();
    const h = mount(<PlayerCard player={basePlayer} variant="grid" onSelect={onSelect} />);
    const cls = h.card().className;
    expect(cls).toContain('w-full');
    expect(cls).not.toContain('touch-none');
    expect(cls).toContain('cursor-pointer');
    act(() => { h.card().click(); });
    expect(onSelect).toHaveBeenCalledWith(3);
    h.unmount();
  });

  it('dead players are not selectable on grid click', () => {
    const onSelect = vi.fn();
    const h = mount(<PlayerCard player={{ ...basePlayer, isAlive: false }} variant="grid" onSelect={onSelect} />);
    act(() => { h.card().click(); });
    expect(onSelect).not.toHaveBeenCalled();
    h.unmount();
  });

  it('shows selected state styling', () => {
    const h = mount(<PlayerCard player={basePlayer} variant="grid" selected />);
    expect(h.card().className).toContain('border-state-selected');
    h.unmount();
  });
});
