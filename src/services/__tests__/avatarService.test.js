import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAvatarsBatchMock = vi.fn();
const generatePlayerAvatarMock = vi.fn();
const getPlaceholderAvatarMock = vi.fn((role) => `placeholder:${role}`);

vi.mock('../imageGenerator.js', () => ({
  generatePlayerAvatar: (...args) => generatePlayerAvatarMock(...args),
  getPlaceholderAvatar: (...args) => getPlaceholderAvatarMock(...args),
}));

vi.mock('../apiBase.js', () => ({
  buildApiUrl: (path) => `https://example.test${path}`,
}));

describe('assignPlayerAvatars', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    globalThis.fetch = fetchAvatarsBatchMock;
  });

  it('uses Claude Code generated avatars when database avatars are missing and current avatar is a placeholder', async () => {
    fetchAvatarsBatchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, avatars: {}, count: 0 }),
    });
    generatePlayerAvatarMock.mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E');
    const { assignPlayerAvatars } = await import('../avatarService.js');

    const players = [
      { id: 1, name: 'AI-1', role: '村民', avatarUrl: 'data:image/svg+xml,%3Csvg%3Eplaceholder%3C/svg%3E' },
    ];

    const result = await assignPlayerAvatars(players, 'ai-only');

    expect(generatePlayerAvatarMock).toHaveBeenCalledWith(players[0], false, 'ai-only');
    expect(result[0].avatarUrl).toContain('data:image/svg+xml;charset=utf-8');
  });
});
