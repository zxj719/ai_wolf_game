import { describe, expect, it, vi } from 'vitest';
import { requestWerewolfAI } from '../werewolfAITransport.js';

describe('requestWerewolfAI', () => {
  it('uses only the server session transport when session mode is enabled', async () => {
    const sessionRequest = vi.fn().mockResolvedValue({ speech: 'server result' });
    const legacyRequest = vi.fn().mockResolvedValue({ speech: 'legacy result' });

    const result = await requestWerewolfAI({
      sessionEnabled: true,
      sessionRequest,
      legacyRequest,
    });

    expect(result).toEqual({ speech: 'server result' });
    expect(sessionRequest).toHaveBeenCalledTimes(1);
    expect(legacyRequest).not.toHaveBeenCalled();
  });

  it('does not fall back to legacy transport when server session fails', async () => {
    const sessionError = new Error('session unavailable');
    const sessionRequest = vi.fn().mockRejectedValue(sessionError);
    const legacyRequest = vi.fn().mockResolvedValue({ speech: 'legacy result' });

    await expect(requestWerewolfAI({
      sessionEnabled: true,
      sessionRequest,
      legacyRequest,
    })).rejects.toThrow('session unavailable');

    expect(legacyRequest).not.toHaveBeenCalled();
  });

  it('uses legacy transport only when session mode is disabled', async () => {
    const sessionRequest = vi.fn().mockResolvedValue({ speech: 'server result' });
    const legacyRequest = vi.fn().mockResolvedValue({ speech: 'legacy result' });

    const result = await requestWerewolfAI({
      sessionEnabled: false,
      sessionRequest,
      legacyRequest,
    });

    expect(result).toEqual({ speech: 'legacy result' });
    expect(sessionRequest).not.toHaveBeenCalled();
    expect(legacyRequest).toHaveBeenCalledTimes(1);
  });
});

describe('askWerewolfSessionAI request payload', () => {
  it('forwards gameState, params, contractVersion, and capabilityMode to the server', async () => {
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: { ok: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { askWerewolfSessionAI } = await import('../werewolfSessionClient.js');

    const player = { id: 7, role: '村民', isAlive: true };
    const gameState = {
      players: [player, { id: 1, role: '狼人', isAlive: true }],
      deathHistory: [],
      voteHistory: [],
      dayCount: 2,
      phase: 'day_discussion',
      gameSetup: { STANDARD_ROLES: ['狼人', '村民'] },
    };
    const params = { validTargets: [1] };

    await askWerewolfSessionAI({
      gameSessionId: 'sess-1',
      player,
      actionType: 'DAY_VOTE',
      systemInstruction: 'sys',
      prompt: 'usr',
      gameStateMeta: { dayCount: 2, phase: 'day_vote', alivePlayerIds: [1, 7] },
      gameState,
      params,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.gameState).toEqual(gameState);
    expect(body.params).toEqual(params);
    expect(body.contractVersion).toBe('werewolf-agent-contract-v1');
    expect(body.capabilityMode).toBe('minimax-claude-code-v1');

    vi.unstubAllGlobals();
  });
});
