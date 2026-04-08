import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Dashboard } from '../Dashboard.jsx';
import { SetupScreen } from '../SetupScreen.jsx';
import { DEFAULT_CUSTOM_SELECTIONS } from '../../config/roles.js';

vi.mock('../../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { username: 'Alex' },
    tokenStatus: { hasToken: true, isValid: true },
    verifyModelscopeToken: vi.fn(),
  }),
}));

vi.mock('../../services/authService.js', () => ({
  authService: {
    submitFeedback: vi.fn(),
  },
}));

vi.mock('../ModelLeaderboard.jsx', () => ({
  ModelLeaderboard: () => React.createElement('div', { 'data-testid': 'leaderboard' }, 'leaderboard'),
}));

vi.mock('../TokenManager.jsx', () => ({
  TokenManager: () => React.createElement('div', { 'data-testid': 'token-manager' }, 'token manager'),
}));

vi.mock('../UserStats.jsx', () => ({
  UserStats: () => React.createElement('div', { 'data-testid': 'user-stats' }, 'user stats'),
}));

const noop = () => {};

describe('localized screens', () => {
  it('renders the dashboard in English when locale is en', () => {
    const html = renderToStaticMarkup(
      <Dashboard
        locale="en"
        onEnterWolfgame={noop}
        onEnterSites={noop}
        onLogout={noop}
      />
    );

    expect(html).toContain('Workspace');
    expect(html).toContain('Start your first match');
    expect(html).toContain('Send feedback');
  });

  it('renders the setup screen in English when locale is en', () => {
    const html = renderToStaticMarkup(
      <SetupScreen
        locale="en"
        setGameMode={noop}
        customRoleSelections={DEFAULT_CUSTOM_SELECTIONS}
        setCustomRoleSelections={noop}
        setVictoryMode={noop}
      />
    );

    expect(html).toContain('Choose how to play');
    expect(html).toContain('Player Mode');
    expect(html).toContain('Custom Roles');
    expect(html).toContain('Victory Rule');
  });
});
