/**
 * Cloudflare Workers 认证API入口
 */

import { handleCors, errorResponse, checkGlobalIPLimit, getCorsHeaders } from './middleware.js';
import {
  handleChordsHealth,
  handleCreateChordsJob,
  handleGetChordsArtifact,
  handleGetChordsJob,
} from './chords.js';
import { handleNovelProxy } from './novel.js';
import { handleWerewolfSessionProxy } from './werewolf.js';
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleGetProfile,
  handleUpdateProfile,
  handleVerifyToken,
  handleSaveGameRecord,
  handleGetGameHistory,
  handleGameEnd,
  handleGetUserStats,
  handleGetLeaderboard,
  handleSubmitFeedback,
  handleSendVerification,
  handleVerifyEmail,
  handleForgotPassword,
  handleResetPassword,
  handleSaveToken,
  handleVerifyModelscopeToken,
  handleGetToken,
  handleDeleteToken,
  handleSubmitModelStats,
  handleGetModelLeaderboard,
  handleGetAvatars,
  handleGetAvatarsBatch
} from './handlers.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const isApiRequest = path.startsWith('/api/');
    if (!isApiRequest) {
      return serveStaticAsset(request, env);
    }

    // 处理CORS预检请求
    const corsResponse = handleCors(request, env);
    if (corsResponse) return corsResponse;

    // 全局 IP 限流检查（健康检查除外）
    if (path !== '/api/health') {
      const ipBlockResponse = await checkGlobalIPLimit(request, env);
      if (ipBlockResponse) return ipBlockResponse;
    }

    // API路由
    try {
      // 认证相关
      if (path === '/api/auth/register' && request.method === 'POST') {
        return handleRegister(request, env);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        return handleLogout(request, env);
      }

      if (path === '/api/auth/verify' && request.method === 'GET') {
        return handleVerifyToken(request, env);
      }

      // 邮箱验证
      if (path === '/api/auth/send-verification' && request.method === 'POST') {
        return handleSendVerification(request, env);
      }

      if (path === '/api/auth/verify-email' && request.method === 'POST') {
        return handleVerifyEmail(request, env);
      }

      // 密码重置
      if (path === '/api/auth/forgot-password' && request.method === 'POST') {
        return handleForgotPassword(request, env);
      }

      if (path === '/api/auth/reset-password' && request.method === 'POST') {
        return handleResetPassword(request, env);
      }

      // 用户相关
      if (path === '/api/user/profile' && request.method === 'GET') {
        return handleGetProfile(request, env);
      }

      if (path === '/api/user/profile' && request.method === 'PUT') {
        return handleUpdateProfile(request, env);
      }

      if (path === '/api/user/stats' && request.method === 'GET') {
        return handleGetUserStats(request, env);
      }

      // ModelScope 令牌相关
      if (path === '/api/user/token' && request.method === 'PUT') {
        return handleSaveToken(request, env);
      }

      if (path === '/api/user/token' && request.method === 'GET') {
        return handleGetToken(request, env);
      }

      if (path === '/api/user/token' && request.method === 'DELETE') {
        return handleDeleteToken(request, env);
      }

      if (path === '/api/user/verify-modelscope-token' && request.method === 'POST') {
        return handleVerifyModelscopeToken(request, env);
      }

      // 游戏相关
      if (path === '/api/game/record' && request.method === 'POST') {
        return handleSaveGameRecord(request, env);
      }

      if (path === '/api/game/history' && request.method === 'GET') {
        return handleGetGameHistory(request, env);
      }

      // 游戏日志复盘（公开接口 — 无需认证）
      if (path === '/api/game-end' && request.method === 'POST') {
        return handleGameEnd(request, env);
      }

      // 排行榜（公开接口）
      if (path === '/api/leaderboard' && request.method === 'GET') {
        return handleGetLeaderboard(request, env);
      }

      // 意见反馈（公开接口）
      if (path === '/api/feedback' && request.method === 'POST') {
        return handleSubmitFeedback(request, env);
      }

      // AI 模型统计（公开接口）
      if (path === '/api/model-stats' && request.method === 'POST') {
        return handleSubmitModelStats(request, env);
      }

      if (path === '/api/model-leaderboard' && request.method === 'GET') {
        return handleGetModelLeaderboard(request, env);
      }

      if (path.startsWith('/api/novel/') && ['GET', 'POST', 'PATCH'].includes(request.method)) {
        return handleNovelProxy(request, env, path);
      }

      if (path.startsWith('/api/werewolf/session/') && request.method === 'POST') {
        return handleWerewolfSessionProxy(request, env, path);
      }

      // 头像相关（公开接口）
      if (path === '/api/avatars' && request.method === 'GET') {
        return handleGetAvatars(request, env);
      }

      if (path === '/api/avatars/batch' && request.method === 'POST') {
        return handleGetAvatarsBatch(request, env);
      }

      // 股票K线代理（解决 CORS）
      if (path === '/api/stock/kline' && request.method === 'POST') {
        return handleStockKlineProxy(request, env);
      }

      // 音乐编曲分轨任务
      if (path === '/api/chords/jobs' && request.method === 'POST') {
        return handleCreateChordsJob(request, env);
      }

      const chordsJobMatch = path.match(/^\/api\/chords\/jobs\/([^/]+)$/);
      if (chordsJobMatch && request.method === 'GET') {
        return handleGetChordsJob(request, env, chordsJobMatch[1]);
      }

      const chordsArtifactMatch = path.match(/^\/api\/chords\/jobs\/([^/]+)\/artifacts\/(.+)$/);
      if (chordsArtifactMatch && request.method === 'GET') {
        return handleGetChordsArtifact(request, env, chordsArtifactMatch[1], chordsArtifactMatch[2]);
      }

      if (path === '/api/chords/health' && request.method === 'GET') {
        return handleChordsHealth(request, env);
      }

      // 健康检查 — 包含 ECS werewolf upstream 状态（含 LLM provider token 配置），
      // 让前端 / ops 在出 game 之前就能看清整条链是否就绪，而不是
      // 等到 /api/werewolf/session/ask 90s 超时才暴露。
      if (path === '/api/health') {
        const upstreamBase = (env.ECS_BT_URL || env.ECS_NOVEL_URL || '').replace(/\/+$/, '');
        let werewolfUpstream = { ok: false, reason: 'not configured' };
        if (upstreamBase) {
          try {
            const upstreamRes = await fetch(`${upstreamBase}/health`, {
              method: 'GET',
              signal: AbortSignal.timeout(5000),
            });
            if (upstreamRes.ok) {
              const data = await upstreamRes.json().catch(() => ({}));
              werewolfUpstream = {
                ok: data.provider?.ok === true,
                provider: data.provider || null,
                ai_version: data.ai_version || null,
                bt_version: data.bt_version || null,
              };
            } else {
              werewolfUpstream = { ok: false, reason: `upstream ${upstreamRes.status}` };
            }
          } catch (err) {
            werewolfUpstream = { ok: false, reason: `upstream unreachable: ${err.message}` };
          }
        }
        const status = werewolfUpstream.ok ? 'ok' : 'degraded';
        return new Response(JSON.stringify({
          status,
          timestamp: new Date().toISOString(),
          werewolf_upstream: werewolfUpstream,
        }), {
          status: werewolfUpstream.ok ? 200 : 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 404
      return errorResponse('Not found', 404, env, request);
    } catch (error) {
      console.error('Unhandled error:', error);
      return errorResponse('Internal server error', 500, env, request);
    }
  }
};

/**
 * 股票K线数据代理 - 转发请求到 infoway.io（解决 CORS 限制）
 */
async function handleStockKlineProxy(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  try {
    const body = await request.json();
    const INFOWAY_API_KEY = env.INFOWAY_API_KEY || 'c2c3f1594d41409e9e1a198b3e494d47-infoway';

    const resp = await fetch('https://data.infoway.io/stock/v2/batch_kline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiKey': INFOWAY_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

async function serveStaticAsset(request, env) {
  if (!env.ASSETS) {
    return new Response('Not found', { status: 404 });
  }

  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return addHtmlCacheHeaders(assetResponse, request);
  }

  const url = new URL(request.url);
  const lastSegment = url.pathname.split('/').pop() || '';
  const hasExtension = lastSegment.includes('.');
  if (hasExtension) {
    return assetResponse;
  }

  const fallbackRequest = new Request(new URL('/index.html', url.origin), request);
  const fallbackResponse = await env.ASSETS.fetch(fallbackRequest);
  // Pass the ORIGINAL request (e.g. /, /werewolf/play) for cache purge,
  // not the /index.html fallback — CF caches under the original URL.
  return addHtmlCacheHeaders(fallbackResponse, request);
}

// Force CF edge to never cache HTML. Two mechanisms layered:
//   1. Response headers (no-store) tell edge "don't cache this"
//   2. Workers Cache API purge deletes any previously cached version
// Together they break the chicken-and-egg where edge has a stale cached
// response from the OLD Worker and never calls the NEW Worker.
async function addHtmlCacheHeaders(response, originalRequest) {
  const ct = response.headers.get('Content-Type') || '';
  if (!ct.includes('text/html')) return response;
  // Explicitly purge stale edge-cached HTML for BOTH the original URL
  // (e.g. / or /werewolf/play) AND the canonical /index.html, because CF
  // caches by the URL the browser actually requested, not by the internal
  // fallback URL.
  try {
    await caches.default.delete(originalRequest);
    const url = new URL(originalRequest.url);
    if (url.pathname !== '/index.html') {
      await caches.default.delete(new Request(new URL('/index.html', url.origin)));
    }
  } catch { /* edge envs where cache API is unavailable */ }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  headers.set('CDN-Cache-Control', 'no-store');
  headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
  // Vary: * is the HTTP nuclear option — tells every cache layer (CF edge,
  // browser, CDN) that this response is unique to this exact request and must
  // never be served from cache. Combined with no-store, this guarantees
  // every page load hits the Worker and gets the freshly deployed index.html.
  headers.set('Vary', '*');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
