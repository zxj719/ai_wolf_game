/**
 * friendService — 好友系统前端调用封装。
 *
 * 每个方法第一个参数是 useShell().api('cf-workers') 返回的 api 客户端，
 * 它已自动注入 base URL + Authorization（token 取自 localStorage），并统一
 * 解析错误。复用现有 createApiClient，避免重复实现 fetch / 错误处理。
 */
export const friendService = {
  /** 搜索用户（按用户名/邮箱），返回 { results: [{id, username}] } */
  searchUsers(api, q) {
    return api.get(`/api/users/search?q=${encodeURIComponent(q)}`);
  },
  /** 发好友申请，返回 { status } */
  sendRequest(api, toUserId) {
    return api.post('/api/friends/request', { toUserId });
  },
  /** 我收到的待处理申请，返回 { requests: [...] } */
  listRequests(api) {
    return api.get('/api/friends/requests');
  },
  /** 同意/拒绝申请，返回 { status } */
  respond(api, requestId, action) {
    return api.post('/api/friends/respond', { requestId, action });
  },
  /** 我的好友列表，返回 { friends: [{id, username}] } */
  listFriends(api) {
    return api.get('/api/friends');
  },
  /**
   * 拉历史消息，返回 { messages: [{id, fromUser, body, createdAt}] }（时间升序）。
   * before 是「消息 id 游标」（取更早的消息）；limit 默认 30，封顶 100。
   */
  getHistory(api, friendId, before, limit) {
    const q = new URLSearchParams({ friendId: String(friendId) });
    if (before != null) q.set('before', String(before));
    if (limit != null) q.set('limit', String(limit));
    return api.get(`/api/chat/history?${q.toString()}`);
  },
};
