/**
 * Cloudflare Workers 认证API入口
 */

import { handleCors, errorResponse, checkGlobalIPLimit } from './middleware.js';
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
  handleSendVerification,
  handleVerifyEmail,
  handleForgotPassword,
  handleResetPassword
} from './handlers.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

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
