import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWerewolfGameSnapshot,
  createWerewolfGameSnapshot,
  getWerewolfSnapshotKey,
  loadWerewolfGameSnapshot,
  saveWerewolfGameSnapshot,
} from '../werewolfGameSnapshot.js';

const activeState = {
  phase: 'day_discussion',
  dayCount: 2,
  players: [{ id: 0, name: 'You', role: '村民', isAlive: true, isUser: true }],
  logs: [{ id: 'log-1', text: '第一天发言', type: 'info' }],
  modelUsage: { gameSessionId: 'game-123', playerModels: {} },
};

describe('werewolf game snapshot', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses a stable per-user storage key', () => {
    expect(getWerewolfSnapshotKey({ id: 42 })).toBe('wolfgame:snapshot:user:42');
    expect(getWerewolfSnapshotKey(null, true)).toBe('wolfgame:snapshot:guest');
  });

  it('creates a resumable snapshot for an active game', () => {
    const snapshot = createWerewolfGameSnapshot({
      state: activeState,
      moduleState: {
        gameMode: 'player',
        selectedSetup: { id: 'standard', name: '标准局' },
        gameStartTime: 1700000000000,
        victoryMode: 'edge',
      },
    });

    expect(snapshot).toMatchObject({
      version: 1,
      state: activeState,
      moduleState: {
        gameMode: 'player',
        gameStartTime: 1700000000000,
      },
    });
    expect(snapshot.savedAt).toEqual(expect.any(Number));
  });

  it('does not create a snapshot for an idle setup screen', () => {
    expect(createWerewolfGameSnapshot({
      state: { phase: 'setup', players: [] },
      moduleState: { gameMode: null },
    })).toBeNull();
  });

  it('saves, loads, and clears the latest snapshot', () => {
    const snapshot = createWerewolfGameSnapshot({
      state: activeState,
      moduleState: { gameMode: 'ai-only' },
    });

    expect(saveWerewolfGameSnapshot({ user: { id: 42 }, snapshot })).toBe(true);
    expect(loadWerewolfGameSnapshot({ user: { id: 42 } })).toMatchObject({
      state: activeState,
      moduleState: { gameMode: 'ai-only' },
    });

    clearWerewolfGameSnapshot({ user: { id: 42 } });
    expect(loadWerewolfGameSnapshot({ user: { id: 42 } })).toBeNull();
  });
});
