/**
 * tennisService.js — 家庭网球公开赛战绩 API（仿 gameService.js 模式）
 */

import { getToken } from '../utils/authToken';
import { buildApiUrl } from './apiBase';

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * 上传一局战绩（仅登录用户；游客直接返回 not logged in，由调用方降级本地保存）
 * @param {Object} record
 * @param {string} record.character   本局所选家庭角色
 * @param {string} record.characterFace
 * @param {string} record.opponent
 * @param {string} record.opponentFace
 * @param {number} record.setsWon     0-2，且与 setsLost 恰有一方为 2
 * @param {number} record.setsLost
 * @param {number|null} record.reactionMs
 * @param {string} record.grade       S/A/B/C
 */
export async function saveTennisRecord(record) {
  const token = getToken();
  if (!token) {
    return { success: false, error: 'Not logged in' };
  }

  try {
    const response = await fetch(buildApiUrl('/api/tennis/record'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(record),
    });
    return await response.json();
  } catch (error) {
    console.error('[Tennis] Save record error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 拉取全网排行榜（公开接口）
 * @returns {{players: Array, recent: Array}|null} 失败返回 null，由调用方降级
 */
export async function getTennisLeaderboard() {
  try {
    const response = await fetch(buildApiUrl('/api/tennis/leaderboard'), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('[Tennis] Leaderboard error:', error);
    return null;
  }
}
