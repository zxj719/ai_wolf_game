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

/** 与原版同构的记录：{p, pf, o, of, sp, so, ms, g, d} */
export function saveLocalRecord({ player, opp, setsP, setsO }) {
  const rec = {
    p: player.name, pf: player.face,
    o: opp.name, of: opp.face,
    sp: setsP, so: setsO,
    ms: player.ms, g: player.grade,
    d: new Date().toLocaleString('zh-CN', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
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

/** 原版排序：胜场优先 → 净胜盘 → 反应越快越靠前 */
export function sortLocalRecords(list) {
  return [...list].sort((a, b) =>
    (b.sp > b.so) - (a.sp > a.so) ||
    (b.sp - b.so) - (a.sp - a.so) ||
    a.ms - b.ms);
}
