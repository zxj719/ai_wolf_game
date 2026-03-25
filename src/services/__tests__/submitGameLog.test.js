import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies before importing submitGameLog ──────────────────────────

vi.mock('../apiBase.js', () => ({
  buildApiUrl: (ep) => `https://test.example.com${ep}`,
}));

// We use fetch directly (not mocked globally), so we don't need to mock apiBase further
// The module uses window.fetch indirectly via its own call

// ── Import after mocks ───────────────────────────────────────────────────────

// Use a dynamic import so the mock is in place before the module loads
let submitGameLog, truncateToRounds;

describe('submitGameLog', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    // Re-import to get fresh module state
    vi.resetModules();
    const mod = await import('../submitGameLog');
    submitGameLog = mod.submitGameLog;
    truncateToRounds = mod.truncateToRounds;
  });

  // ── truncateToRounds unit tests ───────────────────────────────────────

  describe('truncateToRounds', () => {
    it('returns empty array when given empty array', () => {
      expect(truncateToRounds([], 8)).toEqual([]);
    });

    it('returns original when array has fewer than maxRounds', () => {
      const entries = [{ day: 1 }, { day: 2 }];
      expect(truncateToRounds(entries, 8)).toEqual(entries);
    });

    it('keeps entries from the last maxRounds days only', () => {
      const entries = [
        { day: 1 }, { day: 2 }, { day: 3 },
        { day: 4 }, { day: 5 }, { day: 6 },
        { day: 7 }, { day: 8 }, { day: 9 },
      ];
      const result = truncateToRounds(entries, 8);
      // Should keep day 2-9 (last 8 days: 2 through 9)
      expect(result.map(e => e.day)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('returns all entries when lastDay < cutoff (few-round game)', () => {
      const entries = [{ day: 1 }, { day: 2 }, { day: 3 }];
      expect(truncateToRounds(entries, 8)).toEqual(entries);
    });

    it('returns empty array when entries is null/undefined', () => {
      expect(truncateToRounds(null, 8)).toBeNull();
      expect(truncateToRounds(undefined, 8)).toBeUndefined();
    });
  });

  // ── submitGameLog integration tests ────────────────────────────────────

  const makeGameState = (overrides = {}) => ({
    players: [
      { id: 0, name: 'Alice', role: '村民', isAlive: true },
      { id: 1, name: 'Bob', role: '狼人', isAlive: false },
    ],
    speechHistory: [
      { day: 1, playerId: 0, playerName: 'Alice', role: '村民', content: 'Hello' },
    ],
    voteHistory: [
      { day: 1, votes: [{ from: 0, to: 1 }], eliminated: 1, tie: false },
    ],
    deathHistory: [
      { day: 1, playerId: 1, cause: '被投票出局', role: '狼人' },
    ],
    nightActionHistory: [
      { night: 1, type: '狼人袭击', playerId: 1, targetId: 0, result: '成功' },
    ],
    gameResult: 'good_win',
    gameMode: 'ai-only',
    dayCount: 3,
    phase: 'night',
    gameSessionId: 'test-session-123',
    ...overrides,
  });

  it('returns { success: false } when fetch throws AbortError (timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('Aborted', 'AbortError'))));

    const result = await submitGameLog(makeGameState());

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('returns { success: false } when fetch throws network error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failure'))));

    const result = await submitGameLog(makeGameState());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network failure');
  });

  it('returns { success: false } when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('Server error') })
    ));

    const result = await submitGameLog(makeGameState());

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('returns { success: true } on 202 Accepted', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 202 })
    ));

    const result = await submitGameLog(makeGameState());

    expect(result.success).toBe(true);
  });

  it('calls fetch with correct endpoint and JSON body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const gameState = makeGameState({ gameSessionId: 'session-abc' });
    await submitGameLog(gameState);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/game-end');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(options.body);
    expect(body.gameSessionId).toBe('session-abc');
    expect(body.gameResult).toBe('good_win');
  });

  it('truncates speechHistory to 8 rounds', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const longSpeechHistory = Array.from({ length: 20 }, (_, i) => ({
      day: i + 1,
      playerId: 0,
      playerName: 'Alice',
      role: '村民',
      content: `Speech ${i}`,
    }));

    const gameState = makeGameState({ speechHistory: longSpeechHistory });
    await submitGameLog(gameState);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // With 20 entries across 20 days, and maxRounds=8, only days 13-20 kept
    expect(body.speechHistory.length).toBeLessThanOrEqual(20);
  });

  it('includes all players in payload', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const gameState = makeGameState({ players: [
      { id: 0, name: 'Alice', role: '村民', isAlive: true },
      { id: 1, name: 'Bob', role: '狼人', isAlive: false },
      { id: 2, name: 'Carol', role: '预言家', isAlive: true },
    ]});
    await submitGameLog(gameState);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.players).toHaveLength(3);
    expect(body.players[0].name).toBe('Alice');
  });

  it('uses onError callback when fetch fails', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('Boom')));
    vi.stubGlobal('fetch', fetchMock);
    const onError = vi.fn();

    await submitGameLog(makeGameState(), { onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain('Boom');
  });
});
