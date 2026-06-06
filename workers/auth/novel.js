import { authMiddleware, errorResponse, getCorsHeaders } from './middleware.js';

function resolveNovelServiceBase(env) {
  const base = env.ECS_NOVEL_URL || env.ECS_BT_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

// Inline admin lookup — same logic as queue.js' isAdmin(). Kept local to
// avoid cross-module exports just for one D1 query.
async function lookupIsAdmin(email, env) {
  if (!email) return false;
  const row = await env.DB.prepare('SELECT email FROM admins WHERE email = ?').bind(email).first();
  return !!row;
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

  // Per-request admin check so ECS can apply the "owner OR admin auto-claim" rule.
  // Skipped for guests (no user.email) to avoid a needless D1 hit.
  const isAdmin = user ? await lookupIsAdmin(user.email, env) : false;

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
    headers.set('X-Zhaxiaoji-Is-Admin', isAdmin ? '1' : '0');
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
