import { authMiddleware, errorResponse, getCorsHeaders } from './middleware.js';

function resolveNovelServiceBase(env) {
  const base = env.ECS_NOVEL_URL || env.ECS_BT_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

// Access policy: GET = public read-only (guests included); writes require JWT.
// Aligns with CLAUDE.md "Novel Codex: guest 看到的是只读版本" semantics.
const READ_ONLY_METHODS = new Set(['GET', 'HEAD']);

export async function handleNovelProxy(request, env, pathname) {
  const isReadOnly = READ_ONLY_METHODS.has(request.method);
  let user = null;

  if (!isReadOnly) {
    const auth = await authMiddleware(request, env);
    if (auth.error) return errorResponse(auth.error, 401, env, request);
    user = auth.user;
  } else {
    // Best-effort: include identity if a JWT happens to be present, but never reject.
    try {
      const auth = await authMiddleware(request, env);
      if (!auth.error) user = auth.user;
    } catch { /* ignore — public read */ }
  }

  const base = resolveNovelServiceBase(env);
  if (!base) {
    return errorResponse('Novel service is not configured', 503, env, request);
  }

  const url = new URL(request.url);
  const upstreamPath = pathname.replace(/^\/api\/novel/, '/novel');
  const upstreamUrl = `${base}${upstreamPath}${url.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');
  if (user) {
    headers.set('X-Zhaxiaoji-User-Id', String(user.sub));
    headers.set('X-Zhaxiaoji-Username', user.username || '');
  } else {
    headers.set('X-Zhaxiaoji-Role', 'guest');
  }

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
