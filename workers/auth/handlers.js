/**
 * API处理函数模块
 */

import { signToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  jsonResponse,
  errorResponse,
  authMiddleware,
  checkRateLimit,
  isValidEmail,
  isValidPassword,
  isValidUsername
} from './middleware.js';

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function handleRegister(request, env) {
  try {
    // Rate limiting: 1小时3次
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = await checkRateLimit(env, `register:${clientIP}`, 3, 3600);

    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many registration attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request
      );
    }

    const body = await request.json();
    const { username, email, password } = body;

    // 验证输入
    if (!username || !email || !password) {
      return errorResponse('Username, email and password are required', 400, env, request);
    }

    if (!isValidUsername(username)) {
      return errorResponse(
        'Username must be 3-20 characters, only letters, numbers and underscores',
        400,
        env,
        request
      );
    }

    if (!isValidEmail(email)) {
      return errorResponse('Invalid email format', 400, env, request);
    }

    if (!isValidPassword(password)) {
      return errorResponse(
        'Password must be at least 8 characters with uppercase, lowercase and number',
        400,
        env,
        request
      );
    }

    // 检查用户名是否已存在
    const existingUsername = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existingUsername) {
      return errorResponse('Username already exists', 409, env, request);
    }

    // 检查邮箱是否已存在
    const existingEmail = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (existingEmail) {
      return errorResponse('Email already registered', 409, env, request);
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 插入用户
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`
    ).bind(username, email.toLowerCase(), passwordHash).run();

    const userId = result.meta.last_row_id;

    // 创建用户统计记录
    await env.DB.prepare(
      'INSERT INTO user_stats (user_id) VALUES (?)'
    ).bind(userId).run();

    // 生成JWT Token
    const token = await signToken({
      sub: userId,
      username,
      email: email.toLowerCase()
    }, env.JWT_SECRET);

    return jsonResponse({
      success: true,
      user: {
        id: userId,
        username,
        email: email.toLowerCase()
      },
      token
    }, 201, env, request);
  } catch (error) {
    console.error('Register error:', error);
    return errorResponse('Registration failed: ' + error.message, 500, env, request);
  }
}

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400, env, request);
    }

    // Rate limiting: 15分钟5次
    const rateCheck = await checkRateLimit(env, `login:${email.toLowerCase()}`, 5, 900);

    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many login attempts. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request
      );
    }

    // 查找用户
    const user = await env.DB.prepare(
      'SELECT id, username, email, password_hash, email_verified FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) {
      return errorResponse('Invalid email or password', 401, env, request);
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return errorResponse('Invalid email or password', 401, env, request);
    }

    // 更新最后登录时间
    await env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    // 生成JWT Token
    const token = await signToken({
      sub: user.id,
      username: user.username,
      email: user.email
    }, env.JWT_SECRET);

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified === 1
      },
      token
    }, 200, env, request);
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed: ' + error.message, 500, env, request);
  }
}

/**
 * 用户登出
 * POST /api/auth/logout
 */
export async function handleLogout(request, env) {
  // JWT是无状态的，登出只需前端删除token
  // 如果需要服务端登出，可以将token加入黑名单
  return jsonResponse({
    success: true,
    message: 'Logged out successfully'
  }, 200, env, request);
}

/**
 * 获取用户信息
 * GET /api/user/profile
 */
export async function handleGetProfile(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    // 获取用户详细信息和统计
    const userInfo = await env.DB.prepare(
      `SELECT u.id, u.username, u.email, u.email_verified, u.created_at, u.last_login,
              s.total_games, s.wins, s.losses, s.win_rate
       FROM users u
       LEFT JOIN user_stats s ON u.id = s.user_id
       WHERE u.id = ?`
    ).bind(user.sub).first();

    if (!userInfo) {
      return errorResponse('User not found', 404, env, request);
    }

    return jsonResponse({
      success: true,
      user: {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        emailVerified: userInfo.email_verified === 1,
        createdAt: userInfo.created_at,
        lastLogin: userInfo.last_login,
        stats: {
          totalGames: userInfo.total_games || 0,
          wins: userInfo.wins || 0,
          losses: userInfo.losses || 0,
          winRate: userInfo.win_rate || 0
        }
      }
    }, 200, env, request);
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse('Failed to get profile: ' + error.message, 500, env, request);
  }
}

/**
 * 更新用户信息
 * PUT /api/user/profile
 */
export async function handleUpdateProfile(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const body = await request.json();
    const { username, password, currentPassword } = body;

    // 如果要更改密码，需要验证当前密码
    if (password) {
      if (!currentPassword) {
        return errorResponse('Current password is required to change password', 400, env, request);
      }

      const userRecord = await env.DB.prepare(
        'SELECT password_hash FROM users WHERE id = ?'
      ).bind(user.sub).first();

      const isValid = await verifyPassword(currentPassword, userRecord.password_hash);
      if (!isValid) {
        return errorResponse('Current password is incorrect', 401, env, request);
      }

      if (!isValidPassword(password)) {
        return errorResponse(
          'New password must be at least 8 characters with uppercase, lowercase and number',
          400,
          env,
          request
        );
      }

      const newPasswordHash = await hashPassword(password);
      await env.DB.prepare(
        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(newPasswordHash, user.sub).run();
    }

    // 如果要更改用户名
    if (username && username !== user.username) {
      if (!isValidUsername(username)) {
        return errorResponse(
          'Username must be 3-20 characters, only letters, numbers and underscores',
          400,
          env,
          request
        );
      }

      // 检查用户名是否已存在
      const existing = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(username, user.sub).first();

      if (existing) {
        return errorResponse('Username already taken', 409, env, request);
      }

      await env.DB.prepare(
        'UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(username, user.sub).run();
    }

    // 返回更新后的用户信息
    const updatedUser = await env.DB.prepare(
      'SELECT id, username, email, email_verified FROM users WHERE id = ?'
    ).bind(user.sub).first();

    return jsonResponse({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        emailVerified: updatedUser.email_verified === 1
      }
    }, 200, env, request);
  } catch (error) {
    console.error('Update profile error:', error);
    return errorResponse('Failed to update profile: ' + error.message, 500, env, request);
  }
}

/**
 * 验证Token有效性
 * GET /api/auth/verify
 */
export async function handleVerifyToken(request, env) {
  const { user, error } = await authMiddleware(request, env);

  if (error) {
    return errorResponse(error, 401, env, request);
  }

  return jsonResponse({
    success: true,
    user: {
      id: user.sub,
      username: user.username,
      email: user.email
    }
  }, 200, env, request);
}
