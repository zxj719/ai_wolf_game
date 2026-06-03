/**
 * friendsLib — 好友系统纯函数（无 D1、无副作用，便于单测）
 */

/**
 * 规范化好友关系：较小 id 进 userA，较大进 userB。
 * @returns {{ userA: number, userB: number }}
 */
export function normalizeFriendship(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    throw new Error('normalizeFriendship: ids must be numeric');
  }
  if (na === nb) {
    throw new Error('normalizeFriendship: cannot befriend self');
  }
  return { userA: Math.min(na, nb), userB: Math.max(na, nb) };
}

/**
 * 清洗搜索词：去空白；少于 2 字符返回 null（避免拉全表）。
 * @returns {string|null}
 */
export function sanitizeSearchQuery(q) {
  if (typeof q !== 'string') return null;
  const trimmed = q.trim();
  return trimmed.length >= 2 ? trimmed : null;
}
