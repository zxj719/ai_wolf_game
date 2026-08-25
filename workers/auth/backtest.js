import { errorResponse, getCorsHeaders } from './middleware.js';

function resolveBacktestServiceBase(env) {
  const base = env.ECS_BACKTEST_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

// Public endpoint (Admin + Guest, decision #3 in the design doc): pure historical
// computation, no per-user data, no LLM calls, no queue lock needed. See
// docs/superpowers/specs/2026-08-25-backtest-tool-design.md.
export async function handleBacktestProxy(request, env, pathname) {
  const base = resolveBacktestServiceBase(env);
  if (!base) {
    return errorResponse('Backtest service is not configured', 503, env, request);
  }

  const url = new URL(request.url);
  const upstreamPath = pathname.replace(/^\/api\/backtest/, '') || '/';
  const upstreamUrl = `${base}${upstreamPath}${url.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');

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
    console.error('[Backtest proxy]', err);
    return errorResponse('Backtest service unavailable: ' + err.message, 502, env, request);
  }
}
