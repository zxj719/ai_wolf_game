/**
 * levels.js — 坚持类小游戏难度等级（spec §7b）
 *
 * 每玩一次等级 +1（无论胜败），曲线收敛到可玩上限。
 * 等级存 localStorage（个人节奏感设定，不上云、无作弊面）。
 */

const KEY = 'tennis_v2_minigame_levels';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

export function getLevel(game) {
  return readAll()[game] ?? 0;
}

/** 每玩一次 +1，返回新等级 */
export function bumpLevel(game) {
  const all = readAll();
  const next = (all[game] ?? 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify({ ...all, [game]: next })); } catch { /* noop */ }
  return next;
}

/** Flappy：缝隙占比 0.34→0.18 收敛，滚动速度 0.22→0.40 屏/秒，生成间隔 1500→950ms */
export function flappyParams(level) {
  const t = Math.min(1, level / 12);
  return {
    gapRatio: 0.34 - 0.16 * t,
    speed: 0.22 + 0.18 * t,
    spawnMs: 1500 - 550 * t,
  };
}

/** 弹幕：每波球数 2→6，下落时长 2200→1100ms，波间隔 900→480ms */
export function dodgeParams(level) {
  const t = Math.min(1, level / 12);
  return {
    ballsPerWave: Math.round(2 + 4 * t),
    fallMs: 2200 - 1100 * t,
    waveMs: 900 - 420 * t,
  };
}

/** 刷分 → 倍率（0.5–1.5）：60 分顶格 */
export function scoreToMultiplier(score, cap = 60) {
  return 0.5 + Math.max(0, Math.min(1, score / cap));
}
