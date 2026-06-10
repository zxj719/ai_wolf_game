import { authMiddleware, errorResponse, getCorsHeaders } from './middleware.js';
import { isAdmin } from './queue.js';

function resolveWerewolfServiceBase(env) {
  const base = env.ECS_BT_URL || env.ECS_NOVEL_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

export async function handleWerewolfSessionProxy(request, env, pathname) {
  const base = resolveWerewolfServiceBase(env);
  if (!base) {
    return errorResponse('Werewolf session service is not configured', 503, env, request);
  }

  const upstreamPath = pathname.replace(/^\/api\/werewolf\/session/, '/bt/session');
  const upstreamUrl = `${base}${upstreamPath}`;
  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');

  let user = null;
  if (request.headers.get('Authorization')) {
    ({ user } = await authMiddleware(request, env));
    if (user) {
      headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
      headers.set('X-Zhaxiaoji-Username', user.username || '');
    }
  }

  // 队列守门（CLAUDE.md 硬规则：所有 ECS 调用必须经过 queue acquire）。
  // Admin 不走队列，凭 JWT 直接放行；其余调用方必须持有未过期的 werewolf 租约，
  // 否则可以绕开排队系统直接消耗 ECS 资源。
  const callerIsAdmin = user ? await isAdmin(user.email, env) : false;
  if (!callerIsAdmin) {
    const leaseId = request.headers.get('X-Lease-Id');
    if (!leaseId) {
      return errorResponse('Werewolf session requires an active queue lease', 401, env, request);
    }
    const lease = await env.DB.prepare(
      "SELECT 1 AS ok FROM resource_locks WHERE resource = 'werewolf' AND lease_id = ? AND expires_at >= datetime('now')"
    ).bind(leaseId).first();
    if (!lease) {
      return errorResponse('Queue lease invalid or expired', 403, env, request);
    }
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.body,
    });
    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json',
        ...getCorsHeaders(env, request),
      },
    });
  } catch (err) {
    console.error('[Werewolf session proxy]', err);
    return errorResponse(`Werewolf session service unavailable: ${err.message}`, 502, env, request);
  }
}
