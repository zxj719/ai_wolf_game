import { describe, expect, it } from 'vitest';
import { buildProviderOrder } from '../imageGenerator.js';

describe('buildProviderOrder', () => {
  it('uses only Claude Code when server session visuals are enabled', () => {
    expect(buildProviderOrder({
      useClaudeCode: true,
      hasMiniMaxKey: true,
      allowModelScope: true,
    })).toEqual(['claude-code']);
  });

  it('excludes ModelScope unless it is explicitly enabled', () => {
    expect(buildProviderOrder({ useClaudeCode: false, hasMiniMaxKey: false, allowModelScope: false }))
      .toEqual(['siliconflow']);
    expect(buildProviderOrder({ useClaudeCode: false, hasMiniMaxKey: true, allowModelScope: false }))
      .toEqual(['minimax', 'siliconflow']);
  });

  it('can include ModelScope only when explicitly enabled', () => {
    expect(buildProviderOrder({ useClaudeCode: false, hasMiniMaxKey: true, allowModelScope: true }))
      .toEqual(['minimax', 'siliconflow', 'modelscope']);
  });
});
