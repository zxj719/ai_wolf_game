import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askWerewolfSession,
  getWerewolfSessionSnapshot,
  resetWerewolfSession,
} from '../werewolfSession.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetWerewolfSession('test-game');
});

describe('werewolfSession', () => {
  it('calls MiniMax Anthropic endpoint and returns parsed JSON with session metadata', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'text', text: '{"speech":"hello","voteIntention":null,"identity_table":{}}' },
        ],
      }),
    });

    const result = await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '村民' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'system prompt',
      prompt: 'user prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
      env: {
        MINIMAX_API_KEY: 'test-key',
        MINIMAX_API_URL: 'https://api.minimaxi.com/anthropic/v1/messages',
        MINIMAX_MODEL: 'MiniMax-M2',
      },
    });

    expect(result).toMatchObject({
      speech: 'hello',
      _modelInfo: { modelId: 'MiniMax-M2', provider: 'minimax-anthropic' },
      _sessionInfo: { gameSessionId: 'test-game', mode: 'single-match-multi-agent' },
    });
    expect(getWerewolfSessionSnapshot('test-game')).toMatchObject({
      id: 'test-game',
      publicTurnCount: 1,
      agentCount: 1,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      model: 'MiniMax-M2',
      max_tokens: 4096,
    });
    expect(requestBody.system).toContain('Single-match multi-agent session context');
    expect(requestBody.messages[0].content).toContain('user prompt');
  });

  it('keeps private night actions out of the public transcript', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"targetId":2,"thought":"private night action","identity_table":{}}' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"speech":"day speech","voteIntention":null,"identity_table":{}}' }],
        }),
      });

    const env = {
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_API_URL: 'https://api.minimaxi.com/anthropic/v1/messages',
    };

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '狼人' },
      actionType: 'NIGHT_WOLF',
      systemInstruction: 'wolf system',
      prompt: 'wolf night prompt',
      gameStateMeta: { dayCount: 1, phase: 'night' },
      env,
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 2, name: 'AI-2', role: '村民' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'villager system',
      prompt: 'villager day prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
      env,
    });

    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(secondBody.system).not.toContain('private night action');
    expect(secondBody.system).not.toContain('target=2');
  });
});
