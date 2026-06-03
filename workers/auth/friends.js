/**
 * friends.js — 好友系统 API（D1）
 *
 * 端点：
 *   GET  /api/users/search?q=     搜用户（脱敏，仅 id+username）
 *   POST /api/friends/request     发好友申请 { toUserId }
 *   GET  /api/friends/requests    我收到的 pending 申请
 *   POST /api/friends/respond     { requestId, action: 'accept'|'reject' }
 *   GET  /api/friends             我的好友列表
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { normalizeFriendship, sanitizeSearchQuery } from './friendsLib.js';

/** 取已认证用户的数字 id；未认证返回 null */
async function requireUserId(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user || user.sub == null) return null;
  return Number(user.sub);
}

/** GET /api/users/search?q= */
export async function handleUserSearch(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const url = new URL(request.url);
  const q = sanitizeSearchQuery(url.searchParams.get('q'));
  if (!q) return jsonResponse({ results: [] }, 200, env, request);

  const like = `%${q}%`;
  const rows = await env.DB.prepare(
    `SELECT id, username FROM users
     WHERE (username LIKE ? OR email LIKE ?) AND id != ?
     ORDER BY username LIMIT 20`
  ).bind(like, like, me).all();

  return jsonResponse({ results: rows.results || [] }, 200, env, request);
}

/** POST /api/friends/request  { toUserId } */
export async function handleFriendRequest(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const body = await request.json().catch(() => ({}));
  const toUserId = Number(body.toUserId);
  if (!Number.isFinite(toUserId)) return errorResponse('Invalid toUserId', 400, env, request);
  if (toUserId === me) return errorResponse('Cannot add yourself', 400, env, request);

  // 目标用户存在？
  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(toUserId).first();
  if (!target) return errorResponse('User not found', 404, env, request);

  // 已是好友？
  const { userA, userB } = normalizeFriendship(me, toUserId);
  const existing = await env.DB.prepare(
    'SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?'
  ).bind(userA, userB).first();
  if (existing) return jsonResponse({ status: 'already_friends' }, 200, env, request);

  // 反向已有 pending（对方先加了我）→ 直接成为好友
  const reverse = await env.DB.prepare(
    "SELECT id FROM friend_requests WHERE from_user = ? AND to_user = ? AND status = 'pending'"
  ).bind(toUserId, me).first();
  if (reverse) {
    const now = Date.now();
    await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(reverse.id).run();
    await env.DB.prepare(
      'INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)'
    ).bind(userA, userB, now).run();
    return jsonResponse({ status: 'accepted' }, 200, env, request);
  }

  // 新建 pending（幂等：UNIQUE 冲突视为已存在）
  const now = Date.now();
  try {
    await env.DB.prepare(
      "INSERT INTO friend_requests (from_user, to_user, status, created_at) VALUES (?, ?, 'pending', ?)"
    ).bind(me, toUserId, now).run();
  } catch (e) {
    return jsonResponse({ status: 'already_requested' }, 200, env, request);
  }
  return jsonResponse({ status: 'requested' }, 201, env, request);
}

/** GET /api/friends/requests — 我收到的 pending */
export async function handleFriendRequestsList(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const rows = await env.DB.prepare(
    `SELECT fr.id, fr.from_user AS fromUser, u.username AS fromUsername, fr.created_at AS createdAt
     FROM friend_requests fr
     JOIN users u ON u.id = fr.from_user
     WHERE fr.to_user = ? AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`
  ).bind(me).all();

  return jsonResponse({ requests: rows.results || [] }, 200, env, request);
}

/** POST /api/friends/respond  { requestId, action } */
export async function handleFriendRespond(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const body = await request.json().catch(() => ({}));
  const requestId = Number(body.requestId);
  const action = body.action;
  if (!Number.isFinite(requestId)) return errorResponse('Invalid requestId', 400, env, request);
  if (action !== 'accept' && action !== 'reject') return errorResponse('Invalid action', 400, env, request);

  // 申请存在且收件人是我且仍 pending
  const req = await env.DB.prepare(
    "SELECT id, from_user, to_user FROM friend_requests WHERE id = ? AND status = 'pending'"
  ).bind(requestId).first();
  if (!req) return errorResponse('Request not found', 404, env, request);
  if (Number(req.to_user) !== me) return errorResponse('Forbidden', 403, env, request);

  if (action === 'reject') {
    await env.DB.prepare("UPDATE friend_requests SET status = 'rejected' WHERE id = ?").bind(requestId).run();
    return jsonResponse({ status: 'rejected' }, 200, env, request);
  }

  // accept
  const { userA, userB } = normalizeFriendship(req.from_user, req.to_user);
  const now = Date.now();
  await env.DB.prepare("UPDATE friend_requests SET status = 'accepted' WHERE id = ?").bind(requestId).run();
  await env.DB.prepare(
    'INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)'
  ).bind(userA, userB, now).run();
  return jsonResponse({ status: 'accepted' }, 200, env, request);
}

/** GET /api/friends — 我的好友列表 */
export async function handleFriendsList(request, env) {
  const me = await requireUserId(request, env);
  if (me == null) return errorResponse('Not authenticated', 401, env, request);

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username FROM friendships f
     JOIN users u ON u.id = (CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END)
     WHERE f.user_a = ? OR f.user_b = ?
     ORDER BY u.username`
  ).bind(me, me, me).all();

  return jsonResponse({ friends: rows.results || [] }, 200, env, request);
}
