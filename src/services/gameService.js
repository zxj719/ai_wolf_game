/**
 * 游戏记录服务
 */

import { getToken } from '../utils/authToken';

const API_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8787';

/**
 * 获取带认证的请求头
 */
function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * 保存游戏记录
 * @param {Object} gameData - 游戏数据
 * @param {string} gameData.role - 玩家角色
 * @param {string} gameData.result - 游戏结果 ('win' | 'lose')
 * @param {string} gameData.gameMode - 游戏模式
 * @param {number} [gameData.durationSeconds] - 游戏时长（秒）
 */
export async function saveGameRecord(gameData) {
  const token = getToken();
  if (!token) {
    // 未登录用户不保存记录
    return { success: false, error: 'Not logged in' };
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/record`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(gameData)
    });

    return await response.json();
  } catch (error) {
    console.error('Save game record error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取游戏历史
 * @param {number} [limit=20] - 每页数量
 * @param {number} [offset=0] - 偏移量
 */
export async function getGameHistory(limit = 20, offset = 0) {
  try {
    const response = await fetch(
      `${API_BASE}/api/game/history?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: getAuthHeaders()
      }
    );

    return await response.json();
  } catch (error) {
    console.error('Get game history error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取用户统计
 */
export async function getUserStats() {
  try {
    const response = await fetch(`${API_BASE}/api/user/stats`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    return await response.json();
  } catch (error) {
    console.error('Get user stats error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 获取排行榜
 * @param {number} [limit=20] - 数量限制
 */
export async function getLeaderboard(limit = 20) {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return await response.json();
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return { success: false, error: error.message };
  }
}
