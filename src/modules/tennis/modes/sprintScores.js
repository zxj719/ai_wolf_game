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
