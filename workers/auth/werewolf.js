import { authMiddleware, errorResponse, getCorsHeaders } from './middleware.js';

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

  if (request.headers.get('Authorization')) {
    const { user } = await authMiddleware(request, env);
    if (user) {
      headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
      headers.set('X-Zhaxiaoji-Username', user.username || '');
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
