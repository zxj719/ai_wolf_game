import { authMiddleware, errorResponse, getCorsHeaders } from './middleware.js';

function resolveNovelServiceBase(env) {
  const base = env.ECS_NOVEL_URL || env.ECS_BT_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

export async function handleNovelProxy(request, env, pathname) {
  const { user, error } = await authMiddleware(request, env);
  if (error) return errorResponse(error, 401, env, request);

  const base = resolveNovelServiceBase(env);
  if (!base) {
    return errorResponse('Novel service is not configured', 503, env, request);
  }

  const url = new URL(request.url);
  const upstreamPath = pathname.replace(/^\/api\/novel/, '/novel');
  const upstreamUrl = `${base}${upstreamPath}${url.search}`;
  const headers = new Headers(request.headers);
  headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
  headers.set('X-Zhaxiaoji-Username', user.username || '');
  headers.delete('host');

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
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
    console.error('[Novel proxy]', err);
    return errorResponse('Novel service unavailable: ' + err.message, 502, env, request);
  }
}
