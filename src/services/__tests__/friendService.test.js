import { describe, expect, it, vi } from 'vitest';
import { friendService } from '../friendService.js';

// 模拟 useShell().api('cf-workers') 返回的客户端：{ get, post, put, delete }
function makeApi() {
  return {
    get: vi.fn(() => Promise.resolve({ results: [] })),
    post: vi.fn(() => Promise.resolve({ status: 'ok' })),
  };
}

describe('friendService', () => {
  it('searchUsers GETs /api/users/search with an encoded query', async () => {
    const api = makeApi();
    await friendService.searchUsers(api, 'bo b');
    expect(api.get).toHaveBeenCalledWith('/api/users/search?q=bo%20b');
  });

  it('sendRequest POSTs toUserId', async () => {
    const api = makeApi();
    api.post.mockResolvedValueOnce({ status: 'requested' });
    const res = await friendService.sendRequest(api, 42);
    expect(api.post).toHaveBeenCalledWith('/api/friends/request', { toUserId: 42 });
    expect(res).toEqual({ status: 'requested' });
  });

  it('listRequests GETs /api/friends/requests', async () => {
    const api = makeApi();
    await friendService.listRequests(api);
    expect(api.get).toHaveBeenCalledWith('/api/friends/requests');
  });

  it('respond POSTs requestId + action', async () => {
    const api = makeApi();
    await friendService.respond(api, 7, 'accept');
    expect(api.post).toHaveBeenCalledWith('/api/friends/respond', { requestId: 7, action: 'accept' });
  });

  it('listFriends GETs /api/friends', async () => {
    const api = makeApi();
    await friendService.listFriends(api);
    expect(api.get).toHaveBeenCalledWith('/api/friends');
  });

  it('getHistory GETs /api/chat/history with friendId', async () => {
    const api = makeApi();
    await friendService.getHistory(api, 5);
    expect(api.get).toHaveBeenCalledWith('/api/chat/history?friendId=5');
  });

  it('getHistory includes before + limit when provided', async () => {
    const api = makeApi();
    await friendService.getHistory(api, 5, 1000, 20);
    expect(api.get).toHaveBeenCalledWith('/api/chat/history?friendId=5&before=1000&limit=20');
  });
});
