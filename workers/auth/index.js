/**
 * Cloudflare Workers 认证API入口
 */

import { handleCors, errorResponse, checkGlobalIPLimit, getCorsHeaders } from './middleware.js';
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleGetProfile,
  handleUpdateProfile,
  handleVerifyToken,
  handleSaveGameRecord,
  handleGetGameHistory,
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

      // 健康检查
      if (path === '/api/health') {
        return new Response(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString()
        }), {
          headers: { 'Content-Type': 'application/json' }
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
    return assetResponse;
  }

  const url = new URL(request.url);
  const lastSegment = url.pathname.split('/').pop() || '';
  const hasExtension = lastSegment.includes('.');
  if (hasExtension) {
    return assetResponse;
  }

  const fallbackRequest = new Request(new URL('/index.html', url.origin), request);
  return env.ASSETS.fetch(fallbackRequest);
}
