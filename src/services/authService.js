/**
 * 认证API服务封装
 */

// API基础URL - 开发环境使用本地Workers，生产环境使用部署的Workers
const API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8787';

/**
 * 通用请求方法
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  const response = await fetch(url, config);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
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
  }
};
