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
 * 拉取永久进度（登录用户）。游客或失败返回 null，由 progressStore 降级本地。
 */
export async function getTennisProgress() {
  const token = getToken();
  if (!token) return null;
  try {
    const response = await fetch(buildApiUrl('/api/tennis/progress'), {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.progress ?? null;
  } catch (error) {
    console.error('[Tennis] Get progress error:', error);
    return null;
  }
}

/**
 * 上传永久进度（登录用户）。
 */
export async function putTennisProgress(progress) {
  const token = getToken();
  if (!token) return { success: false, error: 'Not logged in' };
  try {
    const response = await fetch(buildApiUrl('/api/tennis/progress'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(progress),
    });
    return await response.json();
  } catch (error) {
    console.error('[Tennis] Put progress error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 上报对局遥测（公开，游客也上报；fire-and-forget，不阻塞 UI）。
 * 用于后台平衡性/可玩性监控（/api/tennis/telemetry/summary 聚合）。
 */
export function sendMatchTelemetry({ mode, character, opponent, score, matchStats, durationS }) {
  try {
    const payload = {
      mode,
      character,
      opponent: String(opponent).slice(0, 20),
      result: score.winner === 0 ? 'win' : 'loss',
      rallies: Math.max(1, matchStats.mgCount),
      aces: matchStats.aces,
      clutchWins: matchStats.clutchWins,
      countersWon: matchStats.countersWon,
      avgMultiplier: matchStats.mgCount
        ? Math.max(0.5, Math.min(1.5, matchStats.mgSum / matchStats.mgCount))
        : 1.0,
      durationS: durationS ?? 0,
      moveUsage: matchStats.moveUsage ?? {},
    };
    fetch(buildApiUrl('/api/tennis/telemetry'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* 遥测静默失败 */ });
  } catch { /* noop */ }
}

/**
 * 提交赛后评价（公开，游客可提交；fire-and-forget，不阻塞 UI）
 */
export function sendMatchFeedback({ rating, comment, mode, character, result }) {
  try {
    fetch(buildApiUrl('/api/tennis/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment, mode, character, result }),
    }).catch(() => { /* 评价静默失败 */ });
  } catch { /* noop */ }
}

/**
 * 记录每日一战完成（公开，游客可用；fire-and-forget，不阻塞 UI）
 */
export function recordDailyCompletion({ playerName, foeName, won, durationS }) {
  try {
    fetch(buildApiUrl('/api/tennis/daily/record'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, foeName, won, durationS }),
    }).catch(() => { /* 静默失败 */ });
  } catch { /* noop */ }
}

/**
 * 拉取今日一战排行榜（公开）
 * @returns {{date: string, completions: Array}|null} 失败返回 null
 */
export async function getDailyLeaderboard() {
  try {
    const res = await fetch(buildApiUrl('/api/tennis/daily/leaderboard'));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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
