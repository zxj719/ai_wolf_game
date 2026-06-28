/**
 * localBoard.js — 本地「家族榜」（localStorage，带原版的安全降级语义）
 *
 * 沿用原版 key 'family_tennis_open_records'，老玩家在浏览器里的历史战绩无损。
 */

const LB_KEY = 'family_tennis_open_records';

const store = (() => {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return localStorage;
  } catch {
    const m = {};
    return {
      getItem: (k) => m[k] ?? null,
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; },
    };
  }
})();

export function loadLocalRecords() {
  try {
    return JSON.parse(store.getItem(LB_KEY)) || [];
  } catch {
    return [];
  }
}

/** 与原版同构的记录：{p, pf, o, of, sp, so, ms, g, d, ts} */
export function saveLocalRecord({ player, opp, setsP, setsO }) {
  const rec = {
    p: player.name, pf: player.face,
    o: opp.name, of: opp.face,
    sp: setsP, so: setsO,
    ms: player.ms, g: player.grade,
    d: new Date().toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    ts: Date.now(), // Unix ms，用于周度统计（老记录无此字段，自动落出周窗口）
  };
  const list = loadLocalRecords();
  list.push(rec);
  store.setItem(LB_KEY, JSON.stringify(list.slice(-50))); // 最多留 50 条
  return rec;
}

export function clearLocalRecords() {
  store.removeItem(LB_KEY);
}

/** 以「玩家身份」为维度统计出战/胜场（用于 SelectScreen 角色小字） */
export function computeCharStats(records) {
  const map = {};
  for (const r of records) {
    if (!r.p) continue;
    if (!map[r.p]) map[r.p] = { played: 0, won: 0 };
    map[r.p].played++;
    if (r.sp > r.so) map[r.p].won++;
  }
  return map;
}

/**
 * 找出胜率最高的已出战角色（至少 minPlayed 场且至少 1 胜）。
 * 同胜率时，出战场次更多者优先（样本更可信）。
 * 返回角色名字符串，无满足条件者返回 null。
 */
export function findBestChar(charStatsMap, minPlayed = 2) {
  let bestName = null, bestRate = -1, bestPlayed = 0;
  for (const [name, { played, won }] of Object.entries(charStatsMap)) {
    if (played < minPlayed || won === 0) continue;
    const rate = won / played;
    if (rate > bestRate || (rate === bestRate && played > bestPlayed)) {
      bestRate = rate;
      bestPlayed = played;
      bestName = name;
    }
  }
  return bestName;
}

/**
 * 计算连胜或连败条数（含当前局）。
 * records 为 loadLocalRecords() 未含本局的历史，本局固定计入 1 作起点。
 * isWin=true 计算连胜；isWin=false 计算连败（sp <= so 视为败）。
 */
export function computeStreakCount(records, playerName, isWin) {
  const mine = records.filter((r) => r.p === playerName);
  const pred = isWin ? (r) => r.sp > r.so : (r) => r.sp <= r.so;
  let streak = 1;
  for (let i = mine.length - 1; i >= 0 && pred(mine[i]); i--) streak++;
  return streak;
}

/**
 * 统计过去 7 天胜场最多的玩家角色。
 * 只统计带 ts 字段的记录（R92+ 新增）；旧记录无 ts，自然落出窗口。
 * 返回 { name, face, wins, played } 或 null（无满足 minWins 的角色时）。
 * now 参数用于测试中注入时间，生产代码省略即可。
 */
export function computeWeeklyChamp(records, { minWins = 2, now = Date.now() } = {}) {
  const cutoff = now - 7 * 24 * 60 * 60 * 1000;
  const map = {};
  for (const r of records) {
    if (!r.ts || r.ts <= cutoff || !r.p) continue;
    if (!map[r.p]) map[r.p] = { face: r.pf ?? '', wins: 0, played: 0 };
    map[r.p].played++;
    if (r.sp > r.so) map[r.p].wins++;
  }
  let best = null;
  for (const [name, stats] of Object.entries(map)) {
    if (stats.wins < minWins) continue;
    if (!best || stats.wins > best.wins || (stats.wins === best.wins && stats.played > best.played)) {
      best = { name, ...stats };
    }
  }
  return best;
}

/** 原版排序：胜场优先 → 净胜盘 → 反应越快越靠前 */
export function sortLocalRecords(list) {
  return [...list].sort((a, b) =>
    (b.sp > b.so) - (a.sp > a.so) ||
    (b.sp - b.so) - (a.sp - a.so) ||
    a.ms - b.ms);
}

/** 统计每个角色（以玩家身份 p）的出战次数和胜场数。*/
export function computeCharStats(records) {
  const map = {};
  for (const r of records) {
    if (!map[r.p]) map[r.p] = { played: 0, won: 0 };
    map[r.p].played++;
    if (r.sp > r.so) map[r.p].won++;
  }
  return map;
}

/** 找出胜率最高（至少 1 场）的角色名；并列时取出战最多者。*/
export function findBestChar(charStatsMap) {
  let best = null, bestRate = -1, bestPlayed = 0;
  for (const [name, s] of Object.entries(charStatsMap)) {
    if (s.played === 0) continue;
    const rate = s.won / s.played;
    if (rate > bestRate || (rate === bestRate && s.played > bestPlayed)) {
      best = name; bestRate = rate; bestPlayed = s.played;
    }
  }
  return best;
}
