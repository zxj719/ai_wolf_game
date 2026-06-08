import React, { act } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { CirclePlayerLayout } from '../CirclePlayerLayout.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom 无 matchMedia / ResizeObserver —— 注入以驱动 useIsMobile 与布局 effect。
function installMatchMedia(matches) {
  window.matchMedia = vi.fn(() => ({
    matches,
    media: '(max-width: 639px)',
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
}

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const noop = () => {};
const players = [
  { id: 0, name: '你', role: '预言家', isAlive: true, isUser: true, avatarColor: '#123' },
  { id: 1, name: 'AI甲', role: '狼人', isAlive: true, isUser: false, avatarColor: '#456' },
  { id: 2, name: 'AI乙', role: '村民', isAlive: true, isUser: false, avatarColor: '#789' },
];

function baseProps() {
  return {
    players,
    userPlayer: players[0],
    nightDecisions: {},
    selectedTarget: null,
    setSelectedTarget: noop,
    speakerIndex: -1,
    phase: 'day_discussion',
    gameMode: 'ai-only',
    seerChecks: [],
    dayCount: 1,
    nightStep: 0,
    AI_MODELS: [],
    isThinking: false,
    getCurrentNightRole: () => '',
    speakingOrder: 'left',
    setSpeakingOrder: noop,
    userInput: '',
    setUserInput: noop,
    handleUserSpeak: noop,
    handleVote: noop,
    voteHistory: [],
    mergeNightDecisions: noop,
    proceedNight: noop,
    setPlayers: noop,
    setUserPlayer: noop,
    witchHistory: { savedIds: [], poisonedIds: [] },
    setWitchHistory: noop,
    magicianHistory: {},
    setMagicianHistory: noop,
    dreamweaverHistory: {},
    setDreamweaverHistory: noop,
    guardHistory: [],
    nightActionHistory: [],
    modelUsage: null,
    getPlayer: (id) => players.find((p) => p.id === id),
    addLog: noop,
    setSeerChecks: noop,
    isUserTurn: () => false,
    hunterShooting: null,
    handleUserHunterShoot: noop,
    handleUserDuel: noop,
    exportGameLog: noop,
    restartGame: noop,
    onReplay: null,
  };
}

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return { container, unmount() { act(() => root.unmount()); container.remove(); } };
}

afterEach(() => { delete window.matchMedia; });

describe('CirclePlayerLayout responsive split', () => {
  it('desktop (>=640px) renders the circle (aspect-square container)', () => {
    installMatchMedia(false);
    const h = mount(<CirclePlayerLayout {...baseProps()} />);
    expect(h.container.querySelector('.aspect-square')).not.toBeNull();
    expect(h.container.querySelector('.grid-cols-2')).toBeNull();
    h.unmount();
  });

  it('mobile (<640px) renders the card grid, not the circle', () => {
    installMatchMedia(true);
    const h = mount(<CirclePlayerLayout {...baseProps()} />);
    expect(h.container.querySelector('.grid-cols-2')).not.toBeNull();
    expect(h.container.querySelector('.aspect-square')).toBeNull();
    // 网格渲染了全部玩家
    expect(h.container.textContent).toContain('AI甲');
    h.unmount();
  });

  it('mobile drawer appears when it is the user night turn', () => {
    installMatchMedia(true);
    const props = baseProps();
    props.phase = 'night';
    props.gameMode = 'human';
    props.isUserTurn = () => true;
    const h = mount(<CirclePlayerLayout {...props} />);
    // 抽屉固定在底部
    expect(h.container.querySelector('.fixed.bottom-0')).not.toBeNull();
    expect(h.container.textContent).toContain('行动');
    h.unmount();
  });

  it('mobile drawer is hidden when the user has no action', () => {
    installMatchMedia(true);
    const props = baseProps();
    props.phase = 'night';
    props.isUserTurn = () => false;
    const h = mount(<CirclePlayerLayout {...props} />);
    expect(h.container.querySelector('.fixed.bottom-0')).toBeNull();
    h.unmount();
  });
});
