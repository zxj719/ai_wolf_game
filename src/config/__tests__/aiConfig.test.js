import { describe, expect, it } from 'vitest';
import { AI_MODELS, AI_PROVIDER, WEREWOLF_AI_MODE } from '../aiConfig.js';

describe('aiConfig werewolf session defaults', () => {
  it('exposes the server Claude Code runtime in default session mode', () => {
    expect(AI_PROVIDER).toBe('ecs-session');
    expect(WEREWOLF_AI_MODE).toBe('session');
    expect(AI_MODELS).toEqual([
      expect.objectContaining({
        id: 'server-claude-code',
        name: 'Server Claude Code · MiniMax-M2.7',
        provider: 'claude-code-minimax-codingplan',
        runtimeModel: 'MiniMax-M2.7',
      }),
    ]);
  });
});
