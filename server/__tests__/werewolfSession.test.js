import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  askWerewolfSession,
  generateWerewolfVisualAsset,
  getWerewolfSessionSnapshot,
  resetWerewolfSession,
} from '../werewolfSession.js';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  resetWerewolfSession('test-game');
});

function createMockChild({ stdout, stderr = '', code = 0 } = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    write: vi.fn(),
    end: vi.fn(() => {
      setTimeout(() => {
        if (stdout) child.stdout.emit('data', Buffer.from(stdout));
        if (stderr) child.stderr.emit('data', Buffer.from(stderr));
        child.emit('close', code);
      }, 0);
    }),
  };
  child.kill = vi.fn();
  return child;
}

function mockClaudeCode(response = {}) {
  spawnMock.mockImplementation(() => createMockChild(response));
}

function mockClaudeCodeSequence(responses) {
  const queue = [...responses];
  spawnMock.mockImplementation(() => createMockChild(queue.shift() || {}));
}

describe('werewolfSession', () => {
  it('invokes Claude Code CLI as the default session runtime', async () => {
    mockClaudeCode({
      stdout: JSON.stringify({
        type: 'result',
        session_id: 'claude-session-1',
        result: '{"speech":"from claude","voteIntention":null,"identity_table":{}}',
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
        CLAUDE_CODE_BIN: 'claude',
        CLAUDE_CODE_ARGS: '--print --output-format json',
        CLAUDE_CODE_SESSION_ROOT: '.tmp/test-claude-sessions',
        ANTHROPIC_AUTH_TOKEN: 'test-key',
        ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
        ANTHROPIC_MODEL: 'MiniMax-M2.7',
      },
    });

    expect(result).toMatchObject({
      speech: 'from claude',
      _modelInfo: { modelId: 'MiniMax-M2.7', provider: 'claude-code-minimax-codingplan' },
      _sessionInfo: {
        gameSessionId: 'test-game',
        mode: 'claude-code-single-match-multi-agent',
        runtimeSessionId: 'claude-session-1',
      },
    });
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['--print', '--output-format', 'json', '--model', 'MiniMax-M2.7'],
      expect.objectContaining({
        windowsHide: true,
        env: expect.objectContaining({
          ANTHROPIC_AUTH_TOKEN: 'test-key',
          ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
        }),
      }),
    );
    expect(getWerewolfSessionSnapshot('test-game')).toMatchObject({
      runtime: 'claude-code',
      runtimeSessionId: 'claude-session-1',
    });
  });

  it('resumes the prior Claude Code session for the same player', async () => {
    mockClaudeCode({
      stdout: JSON.stringify({
        type: 'result',
        session_id: 'claude-session-1',
        result: '{"speech":"from claude","voteIntention":null,"identity_table":{}}',
      }),
    });

    const env = {
      CLAUDE_CODE_BIN: 'claude',
      CLAUDE_CODE_ARGS: '--print --output-format json',
      CLAUDE_CODE_SESSION_ROOT: '.tmp/test-claude-sessions',
      ANTHROPIC_AUTH_TOKEN: 'test-key',
      ANTHROPIC_MODEL: 'MiniMax-M2.7',
    };

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '村民' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'system prompt',
      prompt: 'first prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
      env,
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '村民' },
      actionType: 'DAY_VOTE',
      systemInstruction: 'system prompt',
      prompt: 'second prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_vote' },
      env,
    });

    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'claude',
      ['--print', '--output-format', 'json', '--model', 'MiniMax-M2.7', '--resume', 'claude-session-1'],
      expect.any(Object),
    );
  });

  it('uses separate Claude Code resume sessions per player', async () => {
    mockClaudeCodeSequence([
      {
        stdout: JSON.stringify({
          type: 'result',
          session_id: 'player-1-session',
          result: '{"speech":"p1","voteIntention":null,"identity_table":{}}',
        }),
      },
      {
        stdout: JSON.stringify({
          type: 'result',
          session_id: 'player-2-session',
          result: '{"speech":"p2","voteIntention":null,"identity_table":{}}',
        }),
      },
      {
        stdout: JSON.stringify({
          type: 'result',
          session_id: 'player-1-session',
          result: '{"targetId":2,"reasoning":"vote","identity_table":{}}',
        }),
      },
    ]);

    const env = {
      CLAUDE_CODE_BIN: 'claude',
      CLAUDE_CODE_ARGS: '--print --output-format json',
      CLAUDE_CODE_SESSION_ROOT: '.tmp/test-claude-sessions',
      ANTHROPIC_AUTH_TOKEN: 'test-key',
      ANTHROPIC_MODEL: 'MiniMax-M2.7',
    };

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '狼人' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'system prompt',
      prompt: 'first prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
      env,
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 2, name: 'AI-2', role: '村民' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'system prompt',
      prompt: 'second prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
      env,
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '狼人' },
      actionType: 'DAY_VOTE',
      systemInstruction: 'system prompt',
      prompt: 'third prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_vote' },
      env,
    });

    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'claude',
      ['--print', '--output-format', 'json', '--model', 'MiniMax-M2.7'],
      expect.any(Object),
    );
    expect(spawn).toHaveBeenNthCalledWith(
      3,
      'claude',
      ['--print', '--output-format', 'json', '--model', 'MiniMax-M2.7', '--resume', 'player-1-session'],
      expect.any(Object),
    );
    expect(getWerewolfSessionSnapshot('test-game')).toMatchObject({
      runtimeSessionIds: {
        1: 'player-1-session',
        2: 'player-2-session',
      },
    });
  });

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
        WEREWOLF_SESSION_PROVIDER: 'minimax-api',
        MINIMAX_API_KEY: 'test-key',
        MINIMAX_API_URL: 'https://api.minimaxi.com/anthropic/v1/messages',
        MINIMAX_MODEL: 'MiniMax-M2.7',
      },
    });

    expect(result).toMatchObject({
      speech: 'hello',
      _modelInfo: { modelId: 'MiniMax-M2.7', provider: 'minimax-anthropic-api' },
      _sessionInfo: { gameSessionId: 'test-game', mode: 'single-match-multi-agent' },
    });
    expect(getWerewolfSessionSnapshot('test-game')).toMatchObject({
      id: 'test-game',
      publicTurnCount: 1,
      agentCount: 1,
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      model: 'MiniMax-M2.7',
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
      WEREWOLF_SESSION_PROVIDER: 'minimax-api',
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

  it('keeps private speech thoughts out of the public transcript', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            type: 'text',
            text: '{"speech":"我是村民，先观察。","voteIntention":-1,"thought":"我是狼人，队友是1号，准备倒钩","identity_table":{}}',
          }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '{"speech":"收到公开发言","voteIntention":null,"identity_table":{}}' }],
        }),
      });

    const env = {
      WEREWOLF_SESSION_PROVIDER: 'minimax-api',
      MINIMAX_API_KEY: 'test-key',
      MINIMAX_API_URL: 'https://api.minimaxi.com/anthropic/v1/messages',
    };

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, name: 'AI-1', role: '狼人' },
      actionType: 'DAY_SPEECH',
      systemInstruction: 'wolf system',
      prompt: 'wolf day prompt',
      gameStateMeta: { dayCount: 1, phase: 'day_discussion' },
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
    expect(secondBody.system).toContain('speech=我是村民，先观察。');
    expect(secondBody.system).not.toContain('我是狼人');
    expect(secondBody.system).not.toContain('队友是1号');
    expect(secondBody.system).not.toContain('准备倒钩');
  });
});

describe('werewolfSession adapter (contract v1)', () => {
  const adapterEnv = {
    WEREWOLF_SESSION_PROVIDER: 'minimax-api',
    MINIMAX_API_KEY: 'test-key',
    MINIMAX_API_URL: 'https://api.minimaxi.com/anthropic/v1/messages',
  };

  function adapterPlayers() {
    return [
      { id: 1, role: '狼人',  isAlive: true },
      { id: 2, role: '狼人',  isAlive: true },
      { id: 3, role: '预言家', isAlive: true },
      { id: 4, role: '女巫',  isAlive: true,  hasWitchSave: true,  hasWitchPoison: true },
      { id: 5, role: '守卫',  isAlive: true },
      { id: 6, role: '猎人',  isAlive: true },
      { id: 7, role: '村民',  isAlive: true },
    ];
  }

  function adapterGameState() {
    return {
      players: adapterPlayers(),
      deathHistory: [],
      voteHistory: [],
      seerChecks: [{ seerId: 3, night: 1, targetId: 1, isWolf: true }],
      nightDecisions: { lastGuardTarget: 4 },
      dayCount: 2,
      phase: 'day_discussion',
      gameSetup: { STANDARD_ROLES: ['狼人', '狼人', '预言家', '女巫', '守卫', '猎人', '村民'] },
    };
  }

  it('prompts include contract version, capability mode, legal targets, and the current role skill', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ targetId: 1, reasoning: 'ok' }) }],
      }),
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 3, role: '预言家' },
      actionType: 'NIGHT_SEER',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: { validTargets: [1, 2, 4, 5, 6, 7] },
      gameStateMeta: { dayCount: 2, phase: 'night' },
      env: adapterEnv,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toContain('werewolf-agent-contract-v1');
    expect(body.system).toContain('minimax-claude-code-v1');

    const userText = body.messages[0].content;
    expect(userText).toContain('LEGAL ACTIONS');
    expect(userText).toContain('legalTargets: [1, 2, 4, 5, 6, 7]');
    expect(userText).toContain('your seer checks');
    expect(userText).toMatch(/role skill: 预言家查验/);
  });

  it('does not leak other agents\' private memory into adapter prompts', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ targetId: 7, reasoning: 'kill villager' }) }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ targetId: 2, reasoning: 'inspect' }) }],
        }),
      });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, role: '狼人' },
      actionType: 'NIGHT_WOLF',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: {},
      gameStateMeta: { dayCount: 2, phase: 'night' },
      env: adapterEnv,
    });

    await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 3, role: '预言家' },
      actionType: 'NIGHT_SEER',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: { validTargets: [1, 2, 4, 5, 6, 7] },
      gameStateMeta: { dayCount: 2, phase: 'night' },
      env: adapterEnv,
    });

    const seerBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(seerBody.system).not.toContain('kill villager');
    expect(seerBody.messages[0].content).not.toContain('wolf teammates');
    expect(seerBody.messages[0].content).not.toMatch(/target=7/);
  });

  it('repairs invalid output once and returns the corrected action with diagnostics', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ targetId: 99, reasoning: 'illegal' }) }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ targetId: 3, reasoning: 'legal' }) }],
        }),
      });

    const result = await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, role: '狼人' },
      actionType: 'NIGHT_WOLF',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: {},
      gameStateMeta: { dayCount: 2, phase: 'night' },
      env: adapterEnv,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.targetId).toBe(3);
    expect(result._diagnostics).toMatchObject({
      validationAttempts: 2,
      repairAttempts: 1,
      fallbackUsed: false,
    });
    const repairBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(repairBody.messages[0].content).toContain('CORRECTION REQUIRED');
  });

  it('falls back to deterministic action after repair budget exhausts', async () => {
    const invalid = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ targetId: 99, reasoning: 'still illegal' }) }],
      }),
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(invalid);

    const result = await askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, role: '狼人' },
      actionType: 'NIGHT_WOLF',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: {},
      gameStateMeta: { dayCount: 2, phase: 'night' },
      env: adapterEnv,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result._diagnostics.fallbackUsed).toBe(true);
    expect(result._diagnostics.repairAttempts).toBe(2);
    expect([3, 4, 5, 6, 7]).toContain(result.targetId); // first legal alive non-wolf
    expect(result._sessionInfo.contractVersion).toBe('werewolf-agent-contract-v1');
    expect(result._sessionInfo.capabilityMode).toBe('minimax-claude-code-v1');
  });

  it('rejects mismatched contract version requests', async () => {
    await expect(askWerewolfSession({
      gameSessionId: 'test-game',
      player: { id: 1, role: '狼人' },
      actionType: 'NIGHT_WOLF',
      systemInstruction: '',
      prompt: '',
      gameState: adapterGameState(),
      params: {},
      contractVersion: 'werewolf-agent-contract-v999',
      env: adapterEnv,
    })).rejects.toThrow(/Unsupported contractVersion/);
  });
});

describe('werewolf visual assets', () => {
  it('generates visual assets through Claude Code and returns an SVG data URI', async () => {
    mockClaudeCode({
      stdout: JSON.stringify({
        type: 'result',
        session_id: 'visual-session-1',
        result: JSON.stringify({
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111827"/></svg>',
          alt: 'hooded villager portrait',
        }),
      }),
    });

    const result = await generateWerewolfVisualAsset({
      gameSessionId: 'test-game',
      assetType: 'avatar',
      visualPrompt: 'A hooded villager portrait',
      player: { id: 2, name: 'AI-2', role: '村民' },
      env: {
        CLAUDE_CODE_BIN: 'claude',
        CLAUDE_CODE_ARGS: '--print --output-format json',
        CLAUDE_CODE_SESSION_ROOT: '.tmp/test-claude-sessions',
        ANTHROPIC_AUTH_TOKEN: 'test-key',
        ANTHROPIC_MODEL: 'MiniMax-M2.7',
      },
    });

    expect(result).toMatchObject({
      assetType: 'avatar',
      alt: 'hooded villager portrait',
      _modelInfo: {
        modelId: 'MiniMax-M2.7',
        modelName: 'Server Claude Code · MiniMax-M2.7',
        provider: 'claude-code-minimax-codingplan',
      },
    });
    expect(result.imageUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(result.imageUrl.split(',')[1])).toContain('<svg');
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      ['--print', '--output-format', 'json', '--model', 'MiniMax-M2.7'],
      expect.objectContaining({ windowsHide: true }),
    );
  });
});
