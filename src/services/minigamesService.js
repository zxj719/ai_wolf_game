/**
 * minigamesService.js — 小游戏（扫雷 / 麻将消除）全网排行榜 API
 */

import { getToken } from '../utils/authToken';
import { buildApiUrl } from './apiBase';

function headers() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 上传通关成绩（仅登录用户）。返回 { success, best, rank, personalBest } 或 { success:false, error } */
export async function submitMinigameScore(game, variant, timeMs) {
  if (!getToken()) return { success: false, error: 'Not logged in' };
  try {
    const res = await fetch(buildApiUrl('/api/minigames/score'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ game, variant, timeMs: Math.round(timeMs) }),
    });
    return await res.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/** 拉取排行榜；失败返回 null */
export async function getMinigameLeaderboard(game, variant) {
  try {
    const qs = new URLSearchParams({ game, variant });
    const res = await fetch(buildApiUrl(`/api/minigames/leaderboard?${qs}`), { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
