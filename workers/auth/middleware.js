/**
 * 中间件模块 - CORS、认证验证、Rate Limiting
 */

import { verifyToken } from './jwt.js';

/**
 * 允许的来源列表
 */
const ALLOWED_ORIGINS = [
  'https://battle-web.pages.dev',
  'https://zhaxiaoji.com',
  'https://www.zhaxiaoji.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000'
];

/**
 * CORS响应头
 */
export function getCorsHeaders(env, request = null) {
  let origin = env.FRONTEND_URL || '*';

  // 检查请求的 Origin 是否在允许列表中
  if (request) {
    const requestOrigin = request.headers.get('Origin');
    if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
      origin = requestOrigin;
    }
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

/**
 * 处理CORS预检请求
 */
export function handleCors(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(env, request)
    });
  }
  return null;
}

/**
 * 创建JSON响应
 */
export function jsonResponse(data, status = 200, env = {}, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env, request)
    }
  });
}

/**
 * 错误响应
 */
export function errorResponse(message, status = 400, env = {}, request = null) {
  return jsonResponse({ success: false, error: message }, status, env, request);
}

/**
 * 从请求中提取JWT Token
 */
function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 认证中间件 - 验证JWT Token
 */
export async function authMiddleware(request, env) {
  const token = extractToken(request);

  if (!token) {
    return { user: null, error: 'No token provided' };
  }

  const payload = await verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return { user: null, error: 'Invalid or expired token' };
  }

  return { user: payload, error: null };
}

/**
 * 全局 IP 限流配置
 */
const IP_RATE_LIMITS = {
  // 全局请求限制：每分钟60次
  global: { maxAttempts: 60, windowSeconds: 60 },
  // 认证接口限制：每分钟10次
  auth: { maxAttempts: 10, windowSeconds: 60 },
  // 严格限制（登录/注册失败后）：每小时5次
  strict: { maxAttempts: 5, windowSeconds: 3600 }
};

/**
 * 全局 IP 拦截检查
 * 返回 null 表示允许，返回 Response 表示拦截
 */
export async function checkGlobalIPLimit(request, env) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  // 检查是否在黑名单中
  const blacklisted = await isIPBlacklisted(env, clientIP);
  if (blacklisted) {
    return errorResponse('IP blocked due to suspicious activity', 403, env, request);
  }

  // 检查全局请求频率
  const globalCheck = await checkRateLimit(env, `global:${clientIP}`,
    IP_RATE_LIMITS.global.maxAttempts,
    IP_RATE_LIMITS.global.windowSeconds
  );

  if (!globalCheck.allowed) {
    // 超过全局限制，加入临时黑名单
    await addToBlacklist(env, clientIP, 3600); // 封禁1小时
    return errorResponse(
      `Too many requests. IP blocked for 1 hour.`,
      429,
      env,
      request
    );
  }

  return null;
}

/**
 * 检查 IP 是否在黑名单中
 */
async function isIPBlacklisted(env, ip) {
  if (!env.RATE_LIMIT) return false;

  try {
    const blacklisted = await env.RATE_LIMIT.get(`blacklist:${ip}`);
    return blacklisted !== null;
  } catch {
    return false;
  }
}

/**
 * 将 IP 加入黑名单
 */
export async function addToBlacklist(env, ip, durationSeconds) {
  if (!env.RATE_LIMIT) return;

  try {
    await env.RATE_LIMIT.put(`blacklist:${ip}`, JSON.stringify({
      blockedAt: Date.now(),
      reason: 'rate_limit_exceeded'
    }), { expirationTtl: durationSeconds });
  } catch (error) {
    console.error('Failed to add to blacklist:', error);
  }
}

/**
 * 记录失败尝试（用于渐进式封禁）
 */
export async function recordFailedAttempt(env, ip) {
  if (!env.RATE_LIMIT) return;

  const key = `failed:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    const data = await env.RATE_LIMIT.get(key, 'json') || { count: 0, timestamps: [] };

    // 只保留最近1小时的失败记录
    const recentTimestamps = data.timestamps.filter(t => t > now - 3600);
    recentTimestamps.push(now);

    const failCount = recentTimestamps.length;

    await env.RATE_LIMIT.put(key, JSON.stringify({
      count: failCount,
      timestamps: recentTimestamps
    }), { expirationTtl: 3600 });

    // 渐进式封禁
    if (failCount >= 10) {
      // 10次失败：封禁24小时
      await addToBlacklist(env, ip, 86400);
    } else if (failCount >= 5) {
      // 5次失败：封禁1小时
      await addToBlacklist(env, ip, 3600);
    }
  } catch (error) {
    console.error('Failed to record failed attempt:', error);
  }
}

/**
 * Rate Limiting - 使用KV存储
 * @param {string} key - 限制键（如 IP 或 email）
 * @param {number} maxAttempts - 最大尝试次数
 * @param {number} windowSeconds - 时间窗口（秒）
 */
export async function checkRateLimit(env, key, maxAttempts, windowSeconds) {
  if (!env.RATE_LIMIT) {
    // 如果没有配置KV，跳过限制
    return { allowed: true, remaining: maxAttempts };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  try {
    const data = await env.RATE_LIMIT.get(key, 'json');

    if (!data) {
      // 首次请求
      await env.RATE_LIMIT.put(key, JSON.stringify({
        attempts: [now],
        count: 1
      }), { expirationTtl: windowSeconds });

      return { allowed: true, remaining: maxAttempts - 1 };
    }

    // 过滤掉窗口外的尝试
    const recentAttempts = data.attempts.filter(t => t > windowStart);
    recentAttempts.push(now);

    if (recentAttempts.length > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: windowSeconds - (now - recentAttempts[0])
      };
    }

    await env.RATE_LIMIT.put(key, JSON.stringify({
      attempts: recentAttempts,
      count: recentAttempts.length
    }), { expirationTtl: windowSeconds });

    return { allowed: true, remaining: maxAttempts - recentAttempts.length };
  } catch (error) {
    console.error('Rate limit error:', error);
    // 出错时允许请求
    return { allowed: true, remaining: maxAttempts };
  }
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证密码强度
 * 至少8字符，包含大小写字母和数字
 */
export function isValidPassword(password) {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}

/**
 * 验证用户名
 * 3-20字符，只允许字母、数字、下划线
 */
export function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}
