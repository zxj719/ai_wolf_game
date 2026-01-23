/**
 * Token存储工具
 */

const TOKEN_KEY = 'wolfgame_auth_token';
const USER_KEY = 'wolfgame_user';

/**
 * 获取存储的Token
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * 存储Token
 */
export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save token:', error);
  }
}

/**
 * 删除Token
 */
export function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to remove token:', error);
  }
}

/**
 * 获取存储的用户信息
 */
export function getStoredUser() {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

/**
 * 存储用户信息
 */
export function setStoredUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user:', error);
  }
}

/**
 * 删除用户信息
 */
export function removeStoredUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error('Failed to remove user:', error);
  }
}

/**
 * 清除所有认证数据
 */
export function clearAuth() {
  removeToken();
  removeStoredUser();
}
