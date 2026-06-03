/**
 * chat.js — 私聊 REST（D1）
 *   GET  /api/chat/history?friendId=&before=&limit=   历史消息（JWT）
 *   POST /api/internal/chat/persist                   WS 服务回调写库（service token + 好友校验）
 */
import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { conversationKey, parseHistoryParams } from './chatLib.js';
import { normalizeFriendship } from './friendsLib.js';

const MAX_BODY_CHARS = 4000;
const MAX_BODY_BYTES = 8192;

function bodyTooLong(text) {
  if (text.length > MAX_BODY_CHARS) return true;
  // TextEncoder is available in Workers runtime
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES;
}

async function areFriends(env, a, b) {
  const { userA, userB } = normalizeFriendship(a, b);
  const row = await env.DB.prepare(
    'SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?'
  ).bind(userA, userB).first();
  return !!row;
}

/**
 * GET /api/chat/history — 按唯一 id 游标倒序取，反转为时间升序返回。
 * 用 id（而非 created_at）分页，避免同毫秒消息被跳过/乱序。
 */
export async function handleChatHistory(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user || user.sub == null) return errorResponse('Not authenticated', 401, env, request);
  const me = Number(user.sub);

  const url = new URL(request.url);
  const { friendId, before, limit } = parseHistoryParams({
    friendId: url.searchParams.get('friendId'),
    before: url.searchParams.get('before'),
    limit: url.searchParams.get('limit'),
  });
  if (friendId == null || friendId === me) return errorResponse('Invalid friendId', 400, env, request);

  const key = conversationKey(me, friendId);
  const beforeClause = before != null ? 'AND id < ?' : '';
  const binds = before != null ? [key, before, limit] : [key, limit];
  const rows = await env.DB.prepare(
    `SELECT id, from_user AS fromUser, body, created_at AS createdAt
     FROM chat_messages
     WHERE conversation_key = ? ${beforeClause}
     ORDER BY id DESC
     LIMIT ?`
  ).bind(...binds).all();

  const messages = (rows.results || []).slice().reverse();   // 时间升序
  return jsonResponse({ messages }, 200, env, request);
}

/**
 * POST /api/internal/chat/persist — WS 服务回调。
 * 只认 X-Service-Token（绝不接受 JWT）；并校验 (fromUser,toUser) 确为好友，
 * 这样即便 service token 泄露也无法向任意会话伪造写入。
 */
export async function handleInternalChatPersist(request, env) {
  const token = request.headers.get('X-Service-Token');
  if (!env.CHAT_SERVICE_TOKEN || token !== env.CHAT_SERVICE_TOKEN) {
    return errorResponse('Forbidden', 403, env, request);
  }
  const body = await request.json().catch(() => ({}));
  const fromUser = Number(body.fromUser);
  const toUser = Number(body.toUser);
  const text = typeof body.body === 'string' ? body.body : '';
  const createdAt = Number(body.createdAt) || Date.now();
  if (!Number.isFinite(fromUser) || !Number.isFinite(toUser) || fromUser === toUser) {
    return errorResponse('Invalid users', 400, env, request);
  }
  if (!text || bodyTooLong(text)) return errorResponse('Invalid body', 400, env, request);

  if (!(await areFriends(env, fromUser, toUser))) {
    return errorResponse('Not friends', 403, env, request);
  }

  const key = conversationKey(fromUser, toUser);
  const res = await env.DB.prepare(
    'INSERT INTO chat_messages (conversation_key, from_user, body, created_at) VALUES (?, ?, ?, ?)'
  ).bind(key, fromUser, text, createdAt).run();

  return jsonResponse({ id: res.meta.last_row_id, createdAt }, 201, env, request);
}
