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
