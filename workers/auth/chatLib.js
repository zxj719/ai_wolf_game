/**
 * chatLib — 私聊纯函数（无 D1、无副作用）
 */

/** 1 对 1 会话键："minId:maxId" */
export function conversationKey(a, b) {
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) throw new Error('conversationKey: ids must be numeric');
  if (na === nb) throw new Error('conversationKey: ids must differ');
  return `${Math.min(na, nb)}:${Math.max(na, nb)}`;
}

/**
 * 解析 history 查询参数。
 * - friendId 非法 → null
 * - before 是**消息 id 游标**（取严格小于该 id 的更早消息）；空/0/非数 → null
 * - limit 夹到 1..100，默认 30
 */
export function parseHistoryParams({ friendId, before, limit } = {}) {
  const fid = Number(friendId);
  const validFid = Number.isFinite(fid) ? fid : null;

  const beforeNum = before == null || before === '' ? null : Number(before);
  const validBefore = Number.isFinite(beforeNum) && beforeNum > 0 ? Math.trunc(beforeNum) : null;

  let lim = limit == null || limit === '' ? 30 : Number(limit);
  if (!Number.isFinite(lim)) lim = 30;
  lim = Math.max(1, Math.min(100, Math.trunc(lim)));

  return { friendId: validFid, before: validBefore, limit: lim };
}
