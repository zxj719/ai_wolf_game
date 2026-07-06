/**
 * noviceTracker.js — 新手保护期追踪（localStorage，无需 D1）
 *
 * 前 NOVICE_GAME_THRESHOLD 场对手属性 -NOVICE_STAT_PENALTY，
 * 让首次接触的玩家能体验到获胜感而不是被碾压。
 */

const KEY = 'tennis_novice_games_v1';

export const NOVICE_GAME_THRESHOLD = 5;
export const NOVICE_STAT_PENALTY = 15;

export function getNoviceGamesPlayed() {
  try { return parseInt(localStorage.getItem(KEY) ?? '0', 10); }
  catch { return 0; }
}

export function incrementNoviceGames() {
  try { localStorage.setItem(KEY, String(getNoviceGamesPlayed() + 1)); }
  catch { /* 隐私模式等场景静默 */ }
}

export function isNovice() {
  return getNoviceGamesPlayed() < NOVICE_GAME_THRESHOLD;
}
