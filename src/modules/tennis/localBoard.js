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
 * 返回某玩家最近 n 场（历史记录末尾 n 条）的胜负序列。
 * 数组顺序：旧 → 新（下标 0 最早，末尾最新）。
 * 记录不足 n 条时返回实际可用数量。
 */
export function computeRecentResults(records, playerName, n = 3) {
  if (n <= 0) return [];
  const mine = records.filter((r) => r.p === playerName);
  return mine.slice(-n).map((r) => r.sp > r.so);
}

/**
 * 返回某玩家对某对手最近 n 场的胜负序列（双维度过滤）。
 * 数组顺序：旧 → 新（下标 0 最早，末尾最新）。
 * 记录不足 n 条时返回实际可用数量。
 */
export function computeOppRecentResults(records, playerName, oppName, n = 3) {
  if (n <= 0) return [];
  const mine = records.filter((r) => r.p === playerName && r.o === oppName);
  return mine.slice(-n).map((r) => r.sp > r.so);
}

/**
 * 返回某玩家对某对手末尾连胜数（不含"本局"）。
 * 末尾为败或无记录则返回 0。
 * 例：[W,L,W,W] → 2；[W,W,L] → 0
 */
export function computeOppWinStreak(records, playerName, oppName) {
  const mine = records.filter((r) => r.p === playerName && r.o === oppName);
  let streak = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].sp > mine[i].so) streak++;
    else break;
  }
  return streak;
}

/**
 * 读取历史记录中某玩家的当前连胜数（不含"本局"）。
 * 用于 SelectScreen：游戏尚未开始，只统计已有记录末尾连续胜场。
 * 无记录或最近一场为败则返回 0。
 */
export function computeCurrentWinStreak(records, playerName) {
  const mine = records.filter((r) => r.p === playerName);
  let streak = 0;
  for (let i = mine.length - 1; i >= 0; i--) {
    if (mine[i].sp > mine[i].so) streak++;
    else break;
  }
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

/**
 * 返回某玩家对某对手历史最长连胜数（不含"本局"）。
 * 扫描全部历史记录，返回任意时段的最大连续胜场数。
 * 无记录或从未赢过时返回 0。
 */
export function computeOppBestWinStreak(records, playerName, oppName) {
  const mine = records.filter((r) => r.p === playerName && r.o === oppName);
  let best = 0, cur = 0;
  for (const r of mine) {
    if (r.sp > r.so) { cur++; if (cur > best) best = cur; }
    else cur = 0;
  }
  return best;
}

/**
 * 返回某玩家对某对手最近一场对战的 Unix 时间戳（ts 字段）。
 * 无记录或最近一条记录缺少 ts 字段时返回 null。
 */
export function computeOppLastBattleTs(records, playerName, oppName) {
  const mine = records.filter((r) => r.p === playerName && r.o === oppName);
  if (mine.length === 0) return null;
  return mine[mine.length - 1].ts ?? null;
}

/**
 * 对对手卡片列表按「推荐→中立→劲敌→NEW」四档排序（稳定，不改变原数组）。
 * 推荐（胜率≥60%）> 中立（35%≤胜率<60%）> 劲敌（胜率<35%）> NEW（未见过/无数据）
 * @param {Array} chars - 角色数组，每项需有 .n 字段
 * @param {Set} seenOpps - 已对战过的对手名称集合
 * @param {Object} oppWinRateMap - { [name]: { wins: number, total: number } }
 */
export function sortOppChars(chars, seenOpps, oppWinRateMap) {
  const getPriority = (c) => {
    if (!seenOpps.has(c.n)) return 3;
    const data = oppWinRateMap[c.n];
    if (!data || data.total === 0) return 3;
    const rate = data.wins / data.total;
    if (rate >= 0.6) return 0;
    if (rate < 0.35) return 2;
    return 1;
  };
  return [...chars].sort((a, b) => getPriority(a) - getPriority(b));
}

/** 原版排序：胜场优先 → 净胜盘 → 反应越快越靠前 */
export function sortLocalRecords(list) {
  return [...list].sort((a, b) =>
    (b.sp > b.so) - (a.sp > a.so) ||
    (b.sp - b.so) - (a.sp - a.so) ||
    a.ms - b.ms);
}

