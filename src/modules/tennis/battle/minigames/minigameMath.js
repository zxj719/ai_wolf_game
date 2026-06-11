/**
 * minigameMath.js — 小游戏判定纯函数（时间戳驱动，与帧率无关）
 *
 * 统一约定：先算 accuracy ∈ [0,1]，再 toMultiplier → [0.5,1.5]。
 * windowBonus（卡牌/无障碍补偿）放宽判定窗口：window × (1+bonus)。
 */

export const toMultiplier = (accuracy) =>
  0.5 + Math.max(0, Math.min(1, accuracy));

/** 时机类：与目标时刻的偏差（ms）→ accuracy。窗口内线性衰减。 */
export function timingAccuracy(deltaMs, window = 200, windowBonus = 0) {
  const w = window * (1 + windowBonus);
  const d = Math.abs(deltaMs);
  if (d >= w) return 0;
  return 1 - d / w;
}

/** 连点类：时限内点击数/目标数 → accuracy（超额不加成） */
export function mashAccuracy(clicks, target) {
  if (target <= 0) return 1;
  return Math.max(0, Math.min(1, clicks / target));
}

/** 反应类：反应时长 ms → accuracy（best 满分，worst 零分，线性） */
export function reactionAccuracy(ms, best = 250, worst = 900) {
  if (ms <= best) return 1;
  if (ms >= worst) return 0;
  return 1 - (ms - best) / (worst - best);
}

/** 区间类：数值落点距中心 → accuracy（半宽内线性） */
export function zoneAccuracy(value, center, halfWidth, windowBonus = 0) {
  return timingAccuracy(value - center, halfWidth, windowBonus);
}

/** 发球三段判定：perfect→ace / 窗口内→good / 其余→fault */
export function serveResult(deltaMs, perfectWindow = 60, goodWindow = 220, windowBonus = 0) {
  const d = Math.abs(deltaMs);
  if (d <= perfectWindow * (1 + windowBonus)) return 'ace';
  if (d <= goodWindow * (1 + windowBonus)) return 'good';
  return 'fault';
}

/** 多段时机的综合：各段 accuracy 平均 */
export function comboAccuracy(accuracies) {
  if (!accuracies.length) return 0;
  return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
}
