import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { Dashboard } from '../Dashboard.jsx';
import { SetupScreen } from '../SetupScreen.jsx';
import { DEFAULT_CUSTOM_SELECTIONS } from '../../config/roles.js';

const mockUseAuth = vi.fn();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../services/authService.js', () => ({
  authService: {
    submitFeedback: vi.fn(),
  },
}));

vi.mock('../../config/aiConfig.js', async (importOriginal) => ({
  ...(await importOriginal()),
  API_KEY: '',
}));

vi.mock('../TokenManager.jsx', () => ({
  TokenManager: () => React.createElement('div', { 'data-testid': 'token-manager' }, 'token manager'),
}));

vi.mock('../UserStats.jsx', () => ({
  UserStats: () => React.createElement('div', { 'data-testid': 'user-stats' }, 'user stats'),
}));

function findButton(container, text) {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    candidate.textContent.includes(text)
  );
  expect(button).toBeTruthy();
  return button;
}

describe('start flow', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    mockUseAuth.mockReset();
  });

  it('keeps the dashboard start action pointed at the game setup even without a token', () => {
    const onEnterWolfgame = vi.fn();

    mockUseAuth.mockReturnValue({
      user: { username: 'Alex' },
      tokenStatus: { hasToken: false, isValid: false },
      verifyModelscopeToken: vi.fn(),
    });

    act(() => {
      root.render(
        <Dashboard
          locale="en"
          onEnterWolfgame={onEnterWolfgame}
          onEnterSites={vi.fn()}
          onLogout={vi.fn()}
        />
      );
    });

    act(() => {
      findButton(container, 'Start your first match').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEnterWolfgame).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="token-manager"]')).toBeNull();
  });

  it('uses mode selection before start and opens token configuration on start without API access', () => {
    const onConfigureToken = vi.fn();
    const setGameMode = vi.fn();

    act(() => {
      root.render(
        <SetupScreen
          locale="en"
          setGameMode={setGameMode}
          isLoggedIn
          hasModelscopeToken={false}
          onConfigureToken={onConfigureToken}
          customRoleSelections={DEFAULT_CUSTOM_SELECTIONS}
          setCustomRoleSelections={vi.fn()}
          setVictoryMode={vi.fn()}
        />
      );
    });

    expect(findButton(container, 'Start Game').disabled).toBe(true);

    act(() => {
      findButton(container, 'All-AI Mode').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onConfigureToken).not.toHaveBeenCalled();
    expect(setGameMode).not.toHaveBeenCalled();
    expect(findButton(container, 'Start Game').disabled).toBe(false);

    act(() => {
      findButton(container, 'Start Game').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onConfigureToken).toHaveBeenCalledTimes(1);
    expect(setGameMode).not.toHaveBeenCalled();
  });

  it('starts the selected player mode only after the start button is pressed', () => {
    const setGameMode = vi.fn();

    act(() => {
      root.render(
        <SetupScreen
          locale="en"
          setGameMode={setGameMode}
          isLoggedIn
          hasModelscopeToken
          customRoleSelections={DEFAULT_CUSTOM_SELECTIONS}
          setCustomRoleSelections={vi.fn()}
          setVictoryMode={vi.fn()}
        />
      );
    });

    act(() => {
      findButton(container, 'Player Mode').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setGameMode).not.toHaveBeenCalled();

    act(() => {
      findButton(container, 'Start Game').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setGameMode).toHaveBeenCalledWith('player');
  });
});
