import { API_BASE, buildApiUrl } from './apiBase';

/**
 * 认证API服务封装
 */

// API基础URL - 开发环境使用本地Workers，生产环境使用部署的Workers

// Debug: 打印 API 配置
console.log('[AuthService] API_BASE:', API_BASE || '(same-origin)');

/**
 * 请求超时时间（毫秒）
 */
const REQUEST_TIMEOUT = 30000;

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  }
}

/**
 * 通用请求方法
 */
async function request(endpoint, options = {}) {
  const url = buildApiUrl(endpoint);
  console.log('[AuthService] Request:', options.method || 'GET', url);

  const config = {
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetchWithTimeout(url, config);
    console.log('[AuthService] Response status:', response.status);

    if (!response.ok) {
      // 尝试解析错误响应
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const data = await response.json();
        console.log('[AuthService] Error response:', data);
        errorMessage = data.error || errorMessage;
      } catch {
        // 如果无法解析JSON，使用默认错误消息
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('[AuthService] Success response:', data.success);
    return data;
  } catch (error) {
    // 网络错误或其他fetch错误
    if (error.name === 'TypeError') {
      console.error('[AuthService] Network error:', endpoint, error);
      throw new Error('网络连接失败，请检查网络或稍后重试');
    }
    console.error('[AuthService] API request failed:', endpoint, error);
    throw error;
  }
}

/**
 * 带认证的请求方法
 */
async function authRequest(endpoint, options = {}, token) {
  return request(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}

export const authService = {
  /**
   * 用户注册
   */
  async register(username, email, password) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  },

  /**
   * 用户登录
   */
  async login(email, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  /**
   * 用户登出
   */
  async logout(token) {
    try {
      await authRequest('/api/auth/logout', { method: 'POST' }, token);
    } catch {
      // 登出失败不影响前端清除token
    }
  },

  /**
   * 验证Token
   */
  async verifyToken(token) {
    return authRequest('/api/auth/verify', { method: 'GET' }, token);
  },

  /**
   * 获取用户信息
   */
  async getProfile(token) {
    return authRequest('/api/user/profile', { method: 'GET' }, token);
  },

  /**
   * 更新用户信息
   */
  async updateProfile(token, data) {
    return authRequest('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }, token);
  },

  /**
   * 发送邮箱验证邮件
   */
  async sendVerificationEmail(token) {
    return authRequest('/api/auth/send-verification', {
      method: 'POST'
    }, token);
  },

  /**
   * 验证邮箱
   */
  async verifyEmail(verificationToken) {
    return request('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verificationToken })
    });
  },

  /**
   * 忘记密码 - 发送重置邮件
   */
  async forgotPassword(email) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  /**
   * 重置密码
   */
  async resetPassword(token, password) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    });
  },

  /**
   * 保存 ModelScope 令牌
   */
  async saveModelscopeToken(authToken, modelscopeToken) {
    return authRequest('/api/user/token', {
      method: 'PUT',
      body: JSON.stringify({ modelscopeToken })
    }, authToken);
  },

  /**
   * 获取用户的 ModelScope 令牌
   */
  async getModelscopeToken(authToken) {
    return authRequest('/api/user/token', { method: 'GET' }, authToken);
  },

  /**
   * 验证 ModelScope 令牌
   */
  async verifyModelscopeToken(authToken) {
    return authRequest('/api/user/verify-modelscope-token', {
      method: 'POST'
    }, authToken);
  },

  /**
   * 删除 ModelScope 令牌
   */
  async deleteModelscopeToken(authToken) {
    return authRequest('/api/user/token', { method: 'DELETE' }, authToken);
  },

  /**
   * 提交 AI 模型游戏统计
   * @param {Object} data - 游戏统计数据
   * @param {string} data.gameSessionId - 游戏会话ID
   * @param {string} data.gameMode - 游戏模式
   * @param {number} data.durationSeconds - 游戏时长
   * @param {string} data.result - 游戏结果 (good_win/wolf_win)
   * @param {Array} data.players - 玩家列表（包含角色、模型信息、结果）
   */
  async submitModelStats(data) {
    // 不需要认证，任何人都可以提交模型统计（游客模式也可以）
    return request('/api/model-stats', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * 获取 AI 模型排行榜
   * @param {Object} options - 查询选项
   * @param {string} options.role - 按角色筛选（可选）
   * @param {string} options.sortBy - 排序字段 (winRate/totalGames)
   * @param {number} options.limit - 返回数量限制
   */
  async getModelLeaderboard(options = {}) {
    const params = new URLSearchParams();
    if (options.role) params.append('role', options.role);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const endpoint = queryString ? `/api/model-leaderboard?${queryString}` : '/api/model-leaderboard';

    return request(endpoint, { method: 'GET' });
  }
};
