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
