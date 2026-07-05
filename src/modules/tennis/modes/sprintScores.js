/**
 * sprintScores.js — 限时冲刺本机最高分榜（localStorage，最多 10 条）
 *
 * 沿用 localBoard.js 的安全降级 store 模式。
 * 所有函数为纯操作，便于测试注入 now 参数。
 */

const HS_KEY = 'tennis_sprint_hiscores';
const MAX_SCORES = 10;

const store = (() => {
  try {
    localStorage.setItem('__sphs', '1');
    localStorage.removeItem('__sphs');
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

/** 读取本机榜（降序排列，最多 MAX_SCORES 条） */
export function loadSprintHiscores() {
  try { return JSON.parse(store.getItem(HS_KEY)) || []; }
  catch { return []; }
}

/** 清空本机榜（用于测试或用户重置） */
export function clearSprintHiscores() {
  store.removeItem(HS_KEY);
}

/**
 * 判断给定时间戳是否属于「今天」（按本地时区）。
 *
 * @param {number} ts - Unix ms 时间戳
 * @param {{ today?: number }} opts - today 注入用于测试（亦为 Unix ms）
 */
export function isToday(ts, { today } = {}) {
  const d = new Date(ts);
  const ref = today !== undefined ? new Date(today) : new Date();
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/** 计算每场均分（效率）。matchCount 为 0 时返回 null。 */
export function computeEff(pts, matchCount) {
  if (!matchCount) return null;
  return pts / matchCount;
}

/**
 * 判断给定时间戳是否属于「本月」（按本地时区，同年同月）。
 *
 * @param {number} ts - Unix ms 时间戳
 * @param {{ today?: number }} opts - today 注入用于测试（亦为 Unix ms）
 */
export function isThisMonth(ts, { today } = {}) {
  const d = new Date(ts);
  const ref = today !== undefined ? new Date(today) : new Date();
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth()
  );
}

/**
 * 当前玩家本月最高成绩（按 pts 最高选取，同分时选最早的那条）。
 *
 * @param {Array} hiscores - loadSprintHiscores() 的返回值
 * @param {string} playerName - 玩家名字
 * @param {{ today?: number }} opts - today 注入（测试用）
 * @returns {Object|null} 最高分条目，无记录则 null
 */
export function getPersonalMonthlyBest(hiscores, playerName, { today } = {}) {
  const mine = hiscores.filter(
    (s) => s.player === playerName && isThisMonth(s.ts, { today }),
  );
  if (!mine.length) return null;
  return mine.reduce((best, s) => {
    if (s.pts > best.pts) return s;
    if (s.pts === best.pts && s.ts < best.ts) return s;
    return best;
  });
}

/**
 * 今日效率排行（按 pts/matches 降序，同效率时分数高者前，再按时间戳升序）。
 * @param {Array} hiscores - loadSprintHiscores() 的返回值
 * @param {{ today?: number }} opts - today 注入（测试用）
 * @returns {Array} 今日记录按效率排序
 */
export function getTodayEffBoard(hiscores, { today } = {}) {
  return hiscores
    .filter((s) => s.matches > 0 && isToday(s.ts, { today }))
    .sort((a, b) => {
      const ea = a.pts / a.matches;
      const eb = b.pts / b.matches;
      const diff = eb - ea;
      if (Math.abs(diff) > 1e-9) return diff;
      if (b.pts !== a.pts) return b.pts - a.pts;
      return a.ts - b.ts;
    });
}

/**
 * 计算本次 Sprint 结算的成就徽章（最多 3 个，按威信度降序）。
 *
 * 成就列表（prestige 高 = 更稀有）：
 *   全场全胜 (6) — 3+ 场全赢
 *   完美收官 (4) — 最后一场赢了
 *   三连胜   (3) — 任意连续 3 场赢
 *   逆势翻盘 (2) — 曾落后（累计负>胜），最终以赢收官
 *   铁打意志 (1) — 累计 6 场以上
 *
 * @param {Array<{win: boolean}>} results
 * @returns {Array<{icon: string, label: string, color: string}>}
 */
export function computeAchievements(results) {
  if (!results || results.length === 0) return [];

  const earned = [];
  const lastWin = results[results.length - 1].win;

  if (results.length >= 3 && results.every((r) => r.win)) {
    earned.push({ icon: '🏅', label: '全场全胜', color: '#facc15', prestige: 6 });
  }

  if (lastWin) {
    earned.push({ icon: '🔥', label: '完美收官', color: '#f97316', prestige: 4 });
  }

  let maxStreak = 0, cur = 0;
  for (const r of results) {
    cur = r.win ? cur + 1 : 0;
    if (cur > maxStreak) maxStreak = cur;
  }
  if (maxStreak >= 3) {
    earned.push({ icon: '⚡', label: '三连胜', color: '#22d3ee', prestige: 3 });
  }

  {
    let w = 0, l = 0, wasBehind = false;
    for (const r of results) {
      if (r.win) w++; else l++;
      if (l > w) wasBehind = true;
    }
    if (wasBehind && lastWin) {
      earned.push({ icon: '💪', label: '逆势翻盘', color: '#4ade80', prestige: 2 });
    }
  }

  if (results.length >= 6) {
    earned.push({ icon: '🏃', label: '铁打意志', color: '#a78bfa', prestige: 1 });
  }

  earned.sort((a, b) => b.prestige - a.prestige);
  return earned.slice(0, 3).map(({ icon, label, color }) => ({ icon, label, color }));
}

/**
 * 写入一条 Sprint 成绩，自动维护降序榜单。
 *
 * @param {{ totalPts, matchCount, winCount, grade, playerName }} entry
 * @param {{ now?: number }} opts - 注入时间戳（测试用）
 * @returns {{ rank: number|null, isNew: boolean }}
 *   rank: 1-based 排名（null = 未入榜，实际上 10 条内必然入榜）
 *   isNew: true = 成功写入榜单
 */
export function saveSprintHiscore({ totalPts, matchCount, winCount, grade, playerName }, { now } = {}) {
  const ts = now ?? Date.now();
  const entry = {
    pts: totalPts,
    matches: matchCount,
    wins: winCount,
    grade: { label: grade.label, icon: grade.icon },
    player: playerName,
    date: new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    ts,
  };
  const list = loadSprintHiscores();
  // 分高者前，同分时先打完（ts 小）者前
  const merged = [...list, entry]
    .sort((a, b) => b.pts - a.pts || a.ts - b.ts)
    .slice(0, MAX_SCORES);
  store.setItem(HS_KEY, JSON.stringify(merged));
  const rank = merged.findIndex((e) => e.ts === ts && e.pts === totalPts) + 1;
  return { rank: rank > 0 ? rank : null, isNew: rank > 0 };
}
