/**
 * dailyChallenge.js — 今日一战：按 UTC 日期种子固定对手
 *
 * 同一天所有用户抽到相同对手，每天 UTC 0:00 自动更换。
 * 种子算法：日期字符串哈希 → LCG（线性同余生成器）。
 */
import { CHARS } from '../gameData';

function seedFromDate(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (Math.imul(31, h) + dateStr.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function seededRng(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function seededInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

const PREFIX = 'tennis_daily_';

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export function getDailyChallenge(playerName) {
  const today = getTodayKey();
  const rng = seededRng(seedFromDate(today));
  const pool = CHARS.filter((c) => c.n !== playerName);
  const foe = pool[seededInt(rng, 0, pool.length - 1)];
  return {
    foe,
    stats: {
      sta: seededInt(rng, 45, 85),
      skill: seededInt(rng, 45, 85),
      mind: seededInt(rng, 45, 85),
    },
    date: today,
  };
}

export function isDailyChallengeCompleted() {
  try { return localStorage.getItem(`${PREFIX}${getTodayKey()}`) === '1'; }
  catch { return false; }
}

export function markDailyChallengeCompleted() {
  try { localStorage.setItem(`${PREFIX}${getTodayKey()}`, '1'); }
  catch { /* 隐私模式等静默 */ }
}

export const DAILY_BONUS_COINS = 30;

const DAILY_STATS_PREFIX = 'tennis_daily_stats_';

/**
 * 记录今日一战个人数据（按玩家名分组，支持家庭多人共用浏览器）。
 * @param {{ playerName, won, setsP, setsO, aces, avgMultiplier, clutchWins, countersWon, topRally }} stats
 */
export function saveDailyStats({ playerName, won, setsP, setsO, aces, avgMultiplier, clutchWins, countersWon, topRally }) {
  const key = `${DAILY_STATS_PREFIX}${getTodayKey()}`;
  let data = {};
  try { data = JSON.parse(localStorage.getItem(key)) ?? {}; } catch { /* noop */ }
  data[playerName] = {
    won: !!won,
    setsP: setsP ?? 0,
    setsO: setsO ?? 0,
    aces: aces ?? 0,
    avgMultiplier: avgMultiplier ?? null,
    clutchWins: clutchWins ?? 0,
    countersWon: countersWon ?? 0,
    topRally: (topRally?.pMultiplier > 0)
      ? { mv: topRally.pMove, mult: +topRally.pMultiplier.toFixed(2), ctr: topRally.counterMul > 1 }
      : null,
  };
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* 隐私模式等静默 */ }
}

/** 读取某玩家今日一战数据；无记录返回 null。 */
export function loadDailyStats(playerName) {
  if (!playerName) return null;
  const key = `${DAILY_STATS_PREFIX}${getTodayKey()}`;
  try {
    const data = JSON.parse(localStorage.getItem(key)) ?? {};
    return data[playerName] ?? null;
  } catch { return null; }
}

const STREAK_KEY = 'tennis_daily_streak';

/** 返回当前连续完成天数（0 = 无记录）。 */
export function loadDailyStreak() {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY));
    if (!raw || typeof raw.streak !== 'number') return 0;
    return raw.streak;
  } catch { return 0; }
}

/**
 * 在今日一战胜利时调用；幂等（同一天多次调用不重复计）。
 * @param {string} [today] 可注入日期（YYYY-MM-DD UTC），方便测试
 * @returns {number} 更新后的连续天数
 */
export function updateDailyStreak(today = getTodayKey()) {
  try {
    const raw = JSON.parse(localStorage.getItem(STREAK_KEY)) ?? {};
    if (raw.lastDate === today) return raw.streak ?? 1;
    const todayMs = new Date(`${today}T00:00:00Z`).getTime();
    const yesterday = new Date(todayMs - 86400000).toISOString().slice(0, 10);
    const newStreak = raw.lastDate === yesterday ? (raw.streak ?? 0) + 1 : 1;
    localStorage.setItem(STREAK_KEY, JSON.stringify({ streak: newStreak, lastDate: today }));
    return newStreak;
  } catch { return 1; }
}

/** 清空连胜记录（测试辅助）。 */
export function clearDailyStreak() {
  try { localStorage.removeItem(STREAK_KEY); } catch { /* noop */ }
}

/**
 * 计算玩家在今日一战中的速度排名（按 duration_s 升序，仅统计胜者）。
 * @param {string} playerName
 * @param {Array<{player_name:string, won:boolean, duration_s:number}>} completions
 * @returns {number|null} 1-indexed 名次，玩家不在胜者列表时返回 null
 */
export function computeDailyRank(playerName, completions) {
  if (!playerName || !Array.isArray(completions) || completions.length === 0) return null;
  const winners = completions
    .filter((c) => c.won && c.duration_s > 0)
    .sort((a, b) => a.duration_s - b.duration_s);
  const idx = winners.findIndex((c) => c.player_name === playerName);
  return idx === -1 ? null : idx + 1;
}
