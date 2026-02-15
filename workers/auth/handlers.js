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
  isValidUsername,
  recordFailedAttempt
} from './middleware.js';
import {
  generateToken,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail
} from './email.js';

const FEEDBACK_RECIPIENT = 'xingjian_zhang719@outlook.com';
const FEEDBACK_MIN_LENGTH = 5;
const FEEDBACK_MAX_LENGTH = 2000;
const FEEDBACK_CONTACT_MAX_LENGTH = 200;

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

    // 获取客户端IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    // 查找用户
    const user = await env.DB.prepare(
      'SELECT id, username, email, password_hash, email_verified FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (!user) {
      // 记录失败尝试
      await recordFailedAttempt(env, clientIP);
      return errorResponse('Invalid email or password', 401, env, request);
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      // 记录失败尝试
      await recordFailedAttempt(env, clientIP);
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

    // 获取用户详细信息和统计（包含令牌状态）
    const userInfo = await env.DB.prepare(
      `SELECT u.id, u.username, u.email, u.email_verified, u.created_at, u.last_login,
              u.modelscope_token, u.token_verified_at,
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
        hasModelscopeToken: !!userInfo.modelscope_token,
        tokenVerifiedAt: userInfo.token_verified_at,
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

/**
 * 保存游戏记录
 * POST /api/game/record
 */
export async function handleSaveGameRecord(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const body = await request.json();
    const { role, result, gameMode, durationSeconds } = body;

    // 验证输入
    if (!role || !result || !gameMode) {
      return errorResponse('role, result, and gameMode are required', 400, env, request);
    }

    if (!['win', 'lose'].includes(result)) {
      return errorResponse('result must be "win" or "lose"', 400, env, request);
    }

    // 插入游戏记录
    await env.DB.prepare(
      `INSERT INTO game_history (user_id, role, result, game_mode, duration_seconds)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(user.sub, role, result, gameMode, durationSeconds || null).run();

    // 更新用户统计
    const isWin = result === 'win';
    await env.DB.prepare(
      `UPDATE user_stats SET
        total_games = total_games + 1,
        wins = wins + ?,
        losses = losses + ?,
        win_rate = ROUND(CAST(wins + ? AS REAL) / (total_games + 1) * 100, 2)
       WHERE user_id = ?`
    ).bind(isWin ? 1 : 0, isWin ? 0 : 1, isWin ? 1 : 0, user.sub).run();

    return jsonResponse({
      success: true,
      message: 'Game record saved'
    }, 201, env, request);
  } catch (error) {
    console.error('Save game record error:', error);
    return errorResponse('Failed to save game record: ' + error.message, 500, env, request);
  }
}

/**
 * 获取游戏历史
 * GET /api/game/history?limit=20&offset=0
 */
export async function handleGetGameHistory(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 获取游戏历史
    const history = await env.DB.prepare(
      `SELECT id, role, result, game_mode, duration_seconds, created_at
       FROM game_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(user.sub, limit, offset).all();

    // 获取总数
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as total FROM game_history WHERE user_id = ?'
    ).bind(user.sub).first();

    return jsonResponse({
      success: true,
      history: history.results,
      pagination: {
        total: countResult.total,
        limit,
        offset,
        hasMore: offset + limit < countResult.total
      }
    }, 200, env, request);
  } catch (error) {
    console.error('Get game history error:', error);
    return errorResponse('Failed to get game history: ' + error.message, 500, env, request);
  }
}

/**
 * 获取用户统计
 * GET /api/user/stats
 */
export async function handleGetUserStats(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const stats = await env.DB.prepare(
      'SELECT total_games, wins, losses, win_rate FROM user_stats WHERE user_id = ?'
    ).bind(user.sub).first();

    // 获取角色统计
    const roleStats = await env.DB.prepare(
      `SELECT role,
              COUNT(*) as games,
              SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
       FROM game_history
       WHERE user_id = ?
       GROUP BY role`
    ).bind(user.sub).all();

    // 获取最近战绩（最近10场）
    const recentGames = await env.DB.prepare(
      `SELECT result FROM game_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`
    ).bind(user.sub).all();

    return jsonResponse({
      success: true,
      stats: {
        totalGames: stats?.total_games || 0,
        wins: stats?.wins || 0,
        losses: stats?.losses || 0,
        winRate: stats?.win_rate || 0,
        roleStats: roleStats.results,
        recentResults: recentGames.results.map(g => g.result)
      }
    }, 200, env, request);
  } catch (error) {
    console.error('Get user stats error:', error);
    return errorResponse('Failed to get user stats: ' + error.message, 500, env, request);
  }
}

/**
 * 获取排行榜
 * GET /api/leaderboard?limit=20
 */
export async function handleGetLeaderboard(request, env) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    const leaderboard = await env.DB.prepare(
      `SELECT u.username, s.total_games, s.wins, s.losses, s.win_rate
       FROM user_stats s
       JOIN users u ON s.user_id = u.id
       WHERE s.total_games >= 5
       ORDER BY s.win_rate DESC, s.wins DESC
       LIMIT ?`
    ).bind(limit).all();

    return jsonResponse({
      success: true,
      leaderboard: leaderboard.results.map((row, index) => ({
        rank: index + 1,
        username: row.username,
        totalGames: row.total_games,
        wins: row.wins,
        losses: row.losses,
        winRate: row.win_rate
      }))
    }, 200, env, request);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return errorResponse('Failed to get leaderboard: ' + error.message, 500, env, request);
  }
}

/**
 * 提交意见反馈（公开接口）
 * POST /api/feedback
 */
export async function handleSubmitFeedback(request, env) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = await checkRateLimit(env, `feedback:${clientIP}`, 5, 3600);

    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many feedback submissions. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request
      );
    }

    const body = await request.json();
    const messageRaw = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!messageRaw) {
      return errorResponse('Feedback message is required', 400, env, request);
    }

    if (messageRaw.length < FEEDBACK_MIN_LENGTH) {
      return errorResponse(
        `Feedback message must be at least ${FEEDBACK_MIN_LENGTH} characters`,
        400,
        env,
        request
      );
    }

    if (messageRaw.length > FEEDBACK_MAX_LENGTH) {
      return errorResponse(
        `Feedback message must be at most ${FEEDBACK_MAX_LENGTH} characters`,
        400,
        env,
        request
      );
    }

    const contactRaw = typeof body?.contact === 'string' ? body.contact.trim() : '';
    if (contactRaw.length > FEEDBACK_CONTACT_MAX_LENGTH) {
      return errorResponse(
        `Contact info must be at most ${FEEDBACK_CONTACT_MAX_LENGTH} characters`,
        400,
        env,
        request
      );
    }

    const usernameRaw = typeof body?.username === 'string' ? body.username.trim() : '';
    const pageRaw = typeof body?.page === 'string' ? body.page.trim() : '';
    const isGuest = !!body?.isGuest;

    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const referer = request.headers.get('Referer') || '';

    const message = escapeHtml(messageRaw);
    const contact = escapeHtml(contactRaw || '未填写');
    const username = escapeHtml(usernameRaw || (isGuest ? '访客' : '未知'));
    const page = escapeHtml(pageRaw || 'home');
    const ip = escapeHtml(clientIP);
    const agent = escapeHtml(userAgent);
    const refererText = escapeHtml(referer || 'n/a');
    const timestamp = new Date().toISOString();

    const subject = `Battle Web 意见反馈 - ${username}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Battle Web 意见反馈</h2>
        <p>收到新的玩家反馈：</p>
        <div style="background: #111827; color: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${message}</div>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p><strong>联系信息：</strong> ${contact}</p>
        <p><strong>提交者：</strong> ${username} (${isGuest ? '游客' : '登录用户'})</p>
        <p><strong>页面：</strong> ${page}</p>
        <p><strong>时间：</strong> ${timestamp}</p>
        <p><strong>IP：</strong> ${ip}</p>
        <p><strong>User-Agent：</strong> ${agent}</p>
        <p><strong>Referer：</strong> ${refererText}</p>
      </div>
    `;

    const emailResult = await sendEmail(env, {
      to: FEEDBACK_RECIPIENT,
      subject,
      html
    });

    if (!emailResult.success) {
      return errorResponse('Failed to send feedback', 500, env, request);
    }

    return jsonResponse({
      success: true,
      message: 'Feedback sent'
    }, 200, env, request);
  } catch (error) {
    console.error('Submit feedback error:', error);
    return errorResponse('Failed to send feedback: ' + error.message, 500, env, request);
  }
}

/**
 * 发送邮箱验证邮件
 * POST /api/auth/send-verification
 */
export async function handleSendVerification(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    // Rate limiting: 每小时3次
    const rateCheck = await checkRateLimit(env, `verify-email:${user.sub}`, 3, 3600);
    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many verification requests. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request
      );
    }

    // 检查是否已验证
    const userRecord = await env.DB.prepare(
      'SELECT email_verified, email, username FROM users WHERE id = ?'
    ).bind(user.sub).first();

    if (userRecord.email_verified === 1) {
      return errorResponse('Email already verified', 400, env, request);
    }

    // 生成验证令牌
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时

    // 删除旧的验证令牌
    await env.DB.prepare(
      'DELETE FROM verification_tokens WHERE user_id = ? AND type = ?'
    ).bind(user.sub, 'email_verify').run();

    // 保存新令牌
    await env.DB.prepare(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES (?, ?, 'email_verify', ?)`
    ).bind(user.sub, token, expiresAt).run();

    // 发送邮件
    const emailResult = await sendVerificationEmail(env, {
      email: userRecord.email,
      username: userRecord.username,
      token
    });

    if (!emailResult.success) {
      return errorResponse('Failed to send verification email', 500, env, request);
    }

    return jsonResponse({
      success: true,
      message: 'Verification email sent'
    }, 200, env, request);
  } catch (error) {
    console.error('Send verification error:', error);
    return errorResponse('Failed to send verification email: ' + error.message, 500, env, request);
  }
}

/**
 * 验证邮箱
 * POST /api/auth/verify-email
 */
export async function handleVerifyEmail(request, env) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return errorResponse('Token is required', 400, env, request);
    }

    // 查找令牌
    const tokenRecord = await env.DB.prepare(
      `SELECT user_id, expires_at FROM verification_tokens
       WHERE token = ? AND type = 'email_verify'`
    ).bind(token).first();

    if (!tokenRecord) {
      return errorResponse('Invalid or expired token', 400, env, request);
    }

    // 检查是否过期
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // 删除过期令牌
      await env.DB.prepare(
        'DELETE FROM verification_tokens WHERE token = ?'
      ).bind(token).run();
      return errorResponse('Token has expired', 400, env, request);
    }

    // 更新用户邮箱验证状态
    await env.DB.prepare(
      'UPDATE users SET email_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(tokenRecord.user_id).run();

    // 删除已使用的令牌
    await env.DB.prepare(
      'DELETE FROM verification_tokens WHERE token = ?'
    ).bind(token).run();

    return jsonResponse({
      success: true,
      message: 'Email verified successfully'
    }, 200, env, request);
  } catch (error) {
    console.error('Verify email error:', error);
    return errorResponse('Failed to verify email: ' + error.message, 500, env, request);
  }
}

/**
 * 忘记密码 - 发送重置邮件
 * POST /api/auth/forgot-password
 */
export async function handleForgotPassword(request, env) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return errorResponse('Email is required', 400, env, request);
    }

    // Rate limiting: 每小时3次
    const rateCheck = await checkRateLimit(env, `forgot-pwd:${email.toLowerCase()}`, 3, 3600);
    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many reset requests. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request
      );
    }

    // 查找用户（即使用户不存在也返回成功，防止枚举攻击）
    const user = await env.DB.prepare(
      'SELECT id, username, email FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();

    if (user) {
      // 生成重置令牌
      const token = generateToken(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1小时

      // 删除旧的重置令牌
      await env.DB.prepare(
        'DELETE FROM verification_tokens WHERE user_id = ? AND type = ?'
      ).bind(user.id, 'password_reset').run();

      // 保存新令牌
      await env.DB.prepare(
        `INSERT INTO verification_tokens (user_id, token, type, expires_at)
         VALUES (?, ?, 'password_reset', ?)`
      ).bind(user.id, token, expiresAt).run();

      // 发送重置邮件
      await sendPasswordResetEmail(env, {
        email: user.email,
        username: user.username,
        token
      });
    }

    // 无论用户是否存在都返回成功
    return jsonResponse({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    }, 200, env, request);
  } catch (error) {
    console.error('Forgot password error:', error);
    return errorResponse('Failed to process request: ' + error.message, 500, env, request);
  }
}

/**
 * 重置密码
 * POST /api/auth/reset-password
 */
export async function handleResetPassword(request, env) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return errorResponse('Token and password are required', 400, env, request);
    }

    if (!isValidPassword(password)) {
      return errorResponse(
        'Password must be at least 8 characters with uppercase, lowercase and number',
        400,
        env,
        request
      );
    }

    // 查找令牌
    const tokenRecord = await env.DB.prepare(
      `SELECT user_id, expires_at FROM verification_tokens
       WHERE token = ? AND type = 'password_reset'`
    ).bind(token).first();

    if (!tokenRecord) {
      return errorResponse('Invalid or expired token', 400, env, request);
    }

    // 检查是否过期
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await env.DB.prepare(
        'DELETE FROM verification_tokens WHERE token = ?'
      ).bind(token).run();
      return errorResponse('Token has expired', 400, env, request);
    }

    // 哈希新密码
    const passwordHash = await hashPassword(password);

    // 更新密码
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(passwordHash, tokenRecord.user_id).run();

    // 删除已使用的令牌
    await env.DB.prepare(
      'DELETE FROM verification_tokens WHERE token = ?'
    ).bind(token).run();

    // 删除该用户所有的密码重置令牌
    await env.DB.prepare(
      'DELETE FROM verification_tokens WHERE user_id = ? AND type = ?'
    ).bind(tokenRecord.user_id, 'password_reset').run();

    return jsonResponse({
      success: true,
      message: 'Password reset successfully'
    }, 200, env, request);
  } catch (error) {
    console.error('Reset password error:', error);
    return errorResponse('Failed to reset password: ' + error.message, 500, env, request);
  }
}

/**
 * 保存/更新 ModelScope API 令牌
 * PUT /api/user/token
 */
export async function handleSaveToken(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const body = await request.json();
    const { modelscopeToken } = body;

    if (!modelscopeToken || typeof modelscopeToken !== 'string') {
      return errorResponse('ModelScope token is required', 400, env, request);
    }

    // 基本格式验证（ModelScope 令牌通常以特定格式开头）
    const trimmedToken = modelscopeToken.trim();
    if (trimmedToken.length < 10) {
      return errorResponse('Invalid token format', 400, env, request);
    }

    // 验证令牌是否有效 - 通过实际 AI 调用测试
    const verifyResult = await verifyModelscopeToken(trimmedToken);

    if (!verifyResult.valid) {
      let errorMsg = '令牌验证失败。';

      switch (verifyResult.error) {
        case 'token_invalid':
          errorMsg = '令牌无效或已过期，请检查后重试。';
          break;
        case 'account_not_verified':
          errorMsg = '账号未完成配置。请确保已完成：1) 绑定阿里云账号 2) 完成阿里云实名认证。';
          break;
        case 'network_error':
          errorMsg = '网络连接失败，无法访问 ModelScope API。可能原因：VPN 节点限制、防火墙拦截、网络不稳定。建议：关闭 VPN 或切换网络后重试。';
          break;
        default:
          errorMsg = '令牌验证失败，请检查令牌是否正确，以及是否已完成阿里云绑定和实名认证。';
      }

      return errorResponse(errorMsg, 400, env, request);
    }

    // 保存令牌到数据库
    await env.DB.prepare(
      `UPDATE users SET
        modelscope_token = ?,
        token_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(trimmedToken, user.sub).run();

    return jsonResponse({
      success: true,
      message: 'ModelScope token saved successfully',
      tokenVerifiedAt: new Date().toISOString()
    }, 200, env, request);
  } catch (error) {
    console.error('Save token error:', error);
    return errorResponse('Failed to save token: ' + error.message, 500, env, request);
  }
}

/**
 * 验证用户的 ModelScope 令牌是否有效
 * POST /api/user/verify-modelscope-token
 */
export async function handleVerifyModelscopeToken(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    // 获取用户的令牌
    const userRecord = await env.DB.prepare(
      'SELECT modelscope_token, token_verified_at FROM users WHERE id = ?'
    ).bind(user.sub).first();

    if (!userRecord || !userRecord.modelscope_token) {
      return jsonResponse({
        success: true,
        hasToken: false,
        isValid: false,
        message: 'No ModelScope token configured'
      }, 200, env, request);
    }

    // 验证令牌 - 通过实际 AI 调用
    const verifyResult = await verifyModelscopeToken(userRecord.modelscope_token);

    // 当令牌确认不可用时，自动清空用户令牌
    const shouldClearToken = ['token_invalid', 'account_not_verified'].includes(verifyResult.error);
    let tokenCleared = false;
    if (!verifyResult.valid && shouldClearToken) {
      await env.DB.prepare(
        `UPDATE users SET
          modelscope_token = NULL,
          token_verified_at = NULL,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(user.sub).run();
      tokenCleared = true;
    }

    if (verifyResult.valid) {
      // 更新验证时间
      await env.DB.prepare(
        'UPDATE users SET token_verified_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(user.sub).run();
    }

    // 根据错误类型提供具体的提示信息
    let message = verifyResult.valid ? '令牌有效，可以开始游戏！' : '令牌验证失败';
    if (!verifyResult.valid) {
      switch (verifyResult.error) {
        case 'token_invalid':
          message = '令牌无效或已过期，请更新令牌。';
          break;
        case 'account_not_verified':
          message = '账号未完成配置，请完成阿里云绑定和实名认证。';
          break;
        case 'network_error':
          message = '网络连接失败，无法访问 ModelScope API。可能是 VPN 或防火墙限制，建议关闭 VPN 或切换网络后重试。';
          break;
        default:
          message = '令牌验证失败，请检查配置。';
      }
    }

    if (tokenCleared) {
      message = `${message}（已自动清空令牌）`;
    }

    return jsonResponse({
      success: true,
      hasToken: tokenCleared ? false : true,
      isValid: verifyResult.valid,
      errorType: verifyResult.error || null,
      tokenCleared,
      tokenVerifiedAt: verifyResult.valid ? new Date().toISOString() : (tokenCleared ? null : userRecord.token_verified_at),
      message
    }, 200, env, request);
  } catch (error) {
    console.error('Verify token error:', error);
    return errorResponse('Failed to verify token: ' + error.message, 500, env, request);
  }
}

/**
 * 获取用户的 ModelScope 令牌（用于前端 AI 调用）
 * GET /api/user/token
 */
export async function handleGetToken(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const userRecord = await env.DB.prepare(
      'SELECT modelscope_token, token_verified_at FROM users WHERE id = ?'
    ).bind(user.sub).first();

    if (!userRecord || !userRecord.modelscope_token) {
      return jsonResponse({
        success: true,
        hasToken: false,
        token: null
      }, 200, env, request);
    }

    return jsonResponse({
      success: true,
      hasToken: true,
      token: userRecord.modelscope_token,
      tokenVerifiedAt: userRecord.token_verified_at
    }, 200, env, request);
  } catch (error) {
    console.error('Get token error:', error);
    return errorResponse('Failed to get token: ' + error.message, 500, env, request);
  }
}

/**
 * 删除用户的 ModelScope 令牌
 * DELETE /api/user/token
 */
export async function handleDeleteToken(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);

    if (error) {
      return errorResponse(error, 401, env, request);
    }

    await env.DB.prepare(
      `UPDATE users SET
        modelscope_token = NULL,
        token_verified_at = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(user.sub).run();

    return jsonResponse({
      success: true,
      message: 'Token deleted successfully'
    }, 200, env, request);
  } catch (error) {
    console.error('Delete token error:', error);
    return errorResponse('Failed to delete token: ' + error.message, 500, env, request);
  }
}

/**
 * 验证 ModelScope 令牌是否有效
 * 通过实际调用 AI 模型来测试令牌
 *
 * 注意：仅有令牌还不够，用户还需要：
 * 1. 绑定阿里云账号: https://modelscope.cn/docs/accounts/aliyun-binding-and-authorization
 * 2. 完成实名认证: https://help.aliyun.com/zh/account/account-verification-overview
 */
async function verifyModelscopeToken(token) {
  try {
    // 使用实际的 AI 调用来验证令牌是否真正可用
    // 这能检测到：令牌有效 + 阿里云绑定 + 实名认证 都完成
    const response = await fetch('https://api-inference.modelscope.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/Qwen2.5-Coder-32B-Instruct',
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 5,  // 使用最小 token 数以减少消耗
        stream: false
      })
    });

    // 检查响应状态
    if (response.status === 401 || response.status === 403) {
      // 令牌无效或无权限
      return { valid: false, error: 'token_invalid' };
    }

    if (response.status === 402) {
      // 需要付费或未完成认证
      return { valid: false, error: 'account_not_verified' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token verification failed:', response.status, errorText);

      // 检查错误信息来判断具体原因
      if (errorText.includes('实名') || errorText.includes('认证') || errorText.includes('verify') || errorText.includes('aliyun')) {
        return { valid: false, error: 'account_not_verified' };
      }

      return { valid: false, error: 'api_error' };
    }

    // 尝试解析响应，确保 AI 调用真正成功
    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
      return { valid: true };
    }

    return { valid: false, error: 'invalid_response' };
  } catch (error) {
    console.error('Token verification error:', error);
    // 记录更详细的错误信息以便诊断
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    return { valid: false, error: 'network_error' };
  }
}

/**
 * 提交 AI 模型游戏统计
 * POST /api/model-stats
 *
 * 请求体：
 * {
 *   gameSessionId: string,
 *   gameMode: string,
 *   durationSeconds: number,
 *   result: 'good_win' | 'wolf_win',
 *   players: [{
 *     playerId: number,
 *     role: string,
 *     modelId: string,
 *     modelName: string,
 *     result: 'win' | 'lose'
 *   }]
 * }
 */
export async function handleSubmitModelStats(request, env) {
  try {
    const body = await request.json();
    const { gameSessionId, gameMode, durationSeconds, result, players } = body;

    // 验证必填字段
    if (!gameSessionId || !gameMode || !result || !Array.isArray(players) || players.length === 0) {
      return errorResponse('Invalid request: missing required fields', 400, env, request);
    }

    const db = env.DB;

    // 开始事务处理
    const currentTime = new Date().toISOString();

    // 1. 插入游戏模型使用记录
    const insertStmt = db.prepare(`
      INSERT INTO game_model_usage
      (game_session_id, player_id, role, model_id, model_name, result, game_mode, duration_seconds, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const player of players) {
      try {
        await insertStmt.bind(
          gameSessionId,
          player.playerId,
          player.role,
          player.modelId,
          player.modelName,
          player.result,
          gameMode,
          durationSeconds,
          currentTime
        ).run();
      } catch (err) {
        console.error('Failed to insert game_model_usage:', err);
        // 继续处理其他玩家
      }
    }

    // 2. 更新或插入 ai_model_stats 聚合表
    for (const player of players) {
      try {
        // 检查是否存在记录
        const existing = await db.prepare(`
          SELECT id, total_games, wins, losses FROM ai_model_stats
          WHERE model_id = ? AND role = ?
        `).bind(player.modelId, player.role).first();

        if (existing) {
          // 更新现有记录
          const newTotalGames = existing.total_games + 1;
          const newWins = existing.wins + (player.result === 'win' ? 1 : 0);
          const newLosses = existing.losses + (player.result === 'lose' ? 1 : 0);
          const newWinRate = newWins / newTotalGames;

          await db.prepare(`
            UPDATE ai_model_stats
            SET total_games = ?, wins = ?, losses = ?, win_rate = ?, updated_at = ?
            WHERE id = ?
          `).bind(newTotalGames, newWins, newLosses, newWinRate, currentTime, existing.id).run();
        } else {
          // 插入新记录
          const totalGames = 1;
          const wins = player.result === 'win' ? 1 : 0;
          const losses = player.result === 'lose' ? 1 : 0;
          const winRate = wins / totalGames;

          await db.prepare(`
            INSERT INTO ai_model_stats
            (model_id, model_name, role, total_games, wins, losses, win_rate, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            player.modelId,
            player.modelName,
            player.role,
            totalGames,
            wins,
            losses,
            winRate,
            currentTime,
            currentTime
          ).run();
        }
      } catch (err) {
        console.error('Failed to update ai_model_stats:', err);
        // 继续处理其他玩家
      }
    }

    return jsonResponse({ success: true, message: 'Model stats submitted successfully' });
  } catch (error) {
    console.error('Error in handleSubmitModelStats:', error);
    return errorResponse('Failed to submit model stats', 500, env, request);
  }
}

/**
 * 获取 AI 模型排行榜
 * GET /api/model-leaderboard?role=狼人&sortBy=winRate&limit=50
 */
export async function handleGetModelLeaderboard(request, env) {
  try {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const sortBy = url.searchParams.get('sortBy') || 'winRate';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const db = env.DB;

    // 构建查询
    let query = 'SELECT * FROM ai_model_stats';
    const params = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    // 排序
    const validSortFields = {
      winRate: 'win_rate DESC',
      totalGames: 'total_games DESC',
      wins: 'wins DESC'
    };
    const orderBy = validSortFields[sortBy] || 'win_rate DESC';
    query += ` ORDER BY ${orderBy}`;

    // 限制数量
    query += ' LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const result = await stmt.bind(...params).all();

    return jsonResponse({
      success: true,
      data: result.results || [],
      count: result.results?.length || 0
    });
  } catch (error) {
    console.error('Error in handleGetModelLeaderboard:', error);
    return errorResponse('Failed to get model leaderboard', 500, env, request);
  }
}

/**
 * 获取预生成的头像
 * GET /api/avatars?names=Harry,Hermione&role=狼人
 *
 * 参数：
 * - names: 逗号分隔的名称列表（必填）
 * - role: 角色类型，可选，不传则返回所有角色的头像
 */
export async function handleGetAvatars(request, env) {
  try {
    const url = new URL(request.url);
    const namesParam = url.searchParams.get('names');
    const role = url.searchParams.get('role');

    if (!namesParam) {
      return errorResponse('Names parameter is required', 400, env, request);
    }

    const names = namesParam.split(',').map(n => n.trim()).filter(Boolean);

    if (names.length === 0) {
      return errorResponse('At least one name is required', 400, env, request);
    }

    const db = env.DB;

    // 构建查询
    const placeholders = names.map(() => '?').join(',');
    let query = `SELECT name, role, personality, image_url FROM avatars WHERE name IN (${placeholders})`;
    const params = [...names];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    const stmt = db.prepare(query);
    const result = await stmt.bind(...params).all();

    // 转换为 { name: { role: imageUrl } } 格式便于前端使用
    const avatarMap = {};
    for (const row of (result.results || [])) {
      if (!avatarMap[row.name]) {
        avatarMap[row.name] = {};
      }
      avatarMap[row.name][row.role] = row.image_url;
    }

    return jsonResponse({
      success: true,
      avatars: avatarMap,
      count: result.results?.length || 0
    });
  } catch (error) {
    console.error('Error in handleGetAvatars:', error);
    return errorResponse('Failed to get avatars', 500, env, request);
  }
}

/**
 * 批量获取头像（用于游戏开始时）
 * POST /api/avatars/batch
 *
 * Body: { players: [{ name: 'Harry', role: '狼人' }, ...] }
 */
export async function handleGetAvatarsBatch(request, env) {
  try {
    const body = await request.json();
    const { players } = body;

    if (!Array.isArray(players) || players.length === 0) {
      return errorResponse('Players array is required', 400, env, request);
    }

    const db = env.DB;
    const avatars = {};

    // 为每个玩家查询头像
    for (const player of players) {
      const { name, role } = player;
      if (!name) continue;

      // 优先查找完全匹配的头像
      let result = await db.prepare(
        'SELECT image_url FROM avatars WHERE name = ? AND role = ? LIMIT 1'
      ).bind(name, role || 'neutral').first();

      // 如果没找到，尝试查找该名称的任意角色头像
      if (!result) {
        result = await db.prepare(
          'SELECT image_url FROM avatars WHERE name = ? LIMIT 1'
        ).bind(name).first();
      }

      if (result) {
        avatars[name] = result.image_url;
      }
    }

    return jsonResponse({
      success: true,
      avatars,
      count: Object.keys(avatars).length
    });
  } catch (error) {
    console.error('Error in handleGetAvatarsBatch:', error);
    return errorResponse('Failed to get avatars batch', 500, env, request);
  }
}
