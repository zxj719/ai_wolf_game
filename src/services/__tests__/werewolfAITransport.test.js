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
