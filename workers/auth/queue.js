/**
 * queue.js — 资源队列管理
 *
 * 控制 API 调用入口的并发：同时只允许 1 个用户使用受限资源。
 * Admin 可以抢占 guest 正在使用的资源。
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';

const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 min default lease

async function isAdmin(email, env) {
  if (!email) return false;
  const row = await env.DB.prepare('SELECT email FROM admins WHERE email = ?').bind(email).first();
  return !!row;
}

function generateLeaseId() {
  return `lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * GET /api/me — 返回用户信息 + isAdmin
 */
export async function handleGetMe(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user) {
    return jsonResponse({ isAdmin: false, user: null, isGuest: true });
  }
  const admin = await isAdmin(user.email, env);
  return jsonResponse({
    isAdmin: admin,
    isGuest: false,
    // JWT 载荷里用户 id 字段是 sub（不是 id）。历史上这里误用 user.id 始终返回 undefined；
    // 前端只读 isAdmin 所以没暴露问题，但 Phase 2 ECS 鉴权委托依赖 user.id，必须用 sub。
    user: { id: user.sub, username: user.username, email: user.email },
  });
}

/**
 * POST /api/queue/acquire — 获取资源锁
 * Body: { resource: "werewolf" | "novel" }
 */
export async function handleQueueAcquire(request, env) {
  const body = await request.json().catch(() => ({}));
  const { resource } = body;
  if (!resource) return errorResponse('Missing resource', 400);

  const { user } = await authMiddleware(request, env);
  const holderId = user ? String(user.id) : `guest-${request.headers.get('cf-connecting-ip') || 'unknown'}`;
  const holderEmail = user?.email || null;
  const holderRole = await isAdmin(holderEmail, env) ? 'admin' : 'guest';

  // Clean expired locks
  await env.DB.prepare("DELETE FROM resource_locks WHERE expires_at < datetime('now')").run();

  // Check current lock
  const current = await env.DB.prepare('SELECT * FROM resource_locks WHERE resource = ?').bind(resource).first();

  if (current) {
    // Same holder re-acquiring (refresh)
    if (current.holder_id === holderId) {
      const newExpiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
      await env.DB.prepare('UPDATE resource_locks SET expires_at = ? WHERE resource = ?')
        .bind(newExpiry, resource).run();
      return jsonResponse({ acquired: true, leaseId: current.lease_id, refreshed: true });
    }

    // Admin preempts guest
    if (holderRole === 'admin' && current.holder_role === 'guest') {
      const leaseId = generateLeaseId();
      const expiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
      await env.DB.prepare(
        'UPDATE resource_locks SET holder_id = ?, holder_role = ?, lease_id = ?, acquired_at = datetime(\'now\'), expires_at = ? WHERE resource = ?'
      ).bind(holderId, holderRole, leaseId, expiry, resource).run();
      return jsonResponse({
        acquired: true,
        leaseId,
        preempted: true,
        previousHolder: current.holder_id,
      });
    }

    // Queue full — someone else is using it
    return jsonResponse({
      acquired: false,
      reason: 'occupied',
      holderRole: current.holder_role,
      expiresAt: current.expires_at,
    }, 409);
  }

  // Resource is free — acquire it
  const leaseId = generateLeaseId();
  const expiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
  await env.DB.prepare(
    'INSERT INTO resource_locks (resource, holder_id, holder_role, lease_id, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(resource, holderId, holderRole, leaseId, expiry).run();

  return jsonResponse({ acquired: true, leaseId });
}

/**
 * POST /api/queue/release — 释放资源锁
 * Body: { leaseId }
 */
export async function handleQueueRelease(request, env) {
  const body = await request.json().catch(() => ({}));
  const { leaseId } = body;
  if (!leaseId) return errorResponse('Missing leaseId', 400);

  const result = await env.DB.prepare('DELETE FROM resource_locks WHERE lease_id = ?').bind(leaseId).run();
  return jsonResponse({ released: result.meta.changes > 0 });
}

/**
 * POST /api/queue/heartbeat — 续租
 * Body: { leaseId }
 */
export async function handleQueueHeartbeat(request, env) {
  const body = await request.json().catch(() => ({}));
  const { leaseId } = body;
  if (!leaseId) return errorResponse('Missing leaseId', 400);

  const newExpiry = new Date(Date.now() + LEASE_DURATION_MS).toISOString();
  const result = await env.DB.prepare(
    'UPDATE resource_locks SET expires_at = ? WHERE lease_id = ?'
  ).bind(newExpiry, leaseId).run();

  if (result.meta.changes === 0) {
    return errorResponse('Lease not found or expired', 404);
  }
  return jsonResponse({ renewed: true, expiresAt: newExpiry });
}

/**
 * GET /api/queue/status — 查询资源占用状态
 * Query: ?resource=werewolf
 */
export async function handleQueueStatus(request, env) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  // Clean expired
  await env.DB.prepare("DELETE FROM resource_locks WHERE expires_at < datetime('now')").run();

  if (resource) {
    const lock = await env.DB.prepare('SELECT resource, holder_role, acquired_at, expires_at FROM resource_locks WHERE resource = ?')
      .bind(resource).first();
    return jsonResponse({ resource, occupied: !!lock, lock: lock || null });
  }

  const locks = await env.DB.prepare('SELECT resource, holder_role, acquired_at, expires_at FROM resource_locks').all();
  return jsonResponse({ locks: locks.results || [] });
}
