/**
 * opponentAI.js — 性格化出招 + 读招提示（纯函数，spec §1.4）
 *
 * 出招：按性格权重在配招内加权随机，体力约束（力竭禁重招）后归一化。
 * 提示：75% 真实率；假提示也必须来自该角色配招（否则秒拆穿）。
 */

import { CHAR_BUILDS, MOVES } from './moves';

/** 与 CHAR_BUILDS[name].moves 一一对齐的权重（和=1），首招即流派本命招 */
export const TEMPERAMENTS = {
  '诚':   [0.40, 0.25, 0.20, 0.15],
  'Elza': [0.35, 0.30, 0.20, 0.15],
  '菲比': [0.35, 0.25, 0.25, 0.15],
  'Ross': [0.45, 0.30, 0.15, 0.10],
  '铁蛋': [0.40, 0.25, 0.20, 0.15],
  '丫':   [0.40, 0.25, 0.20, 0.15],
  '莹':   [0.30, 0.30, 0.20, 0.20],
};

/** 力竭线与禁招阈值（与 spec §1.1 玩家规则镜像） */
const EXHAUSTED_BELOW = 20;
const HEAVY_COST = 16;

function availableMoves(charName, energy) {
  const moves = CHAR_BUILDS[charName].moves;
  if (energy >= EXHAUSTED_BELOW) return moves;
  const ok = moves.filter((id) => MOVES[id].energyCost < HEAVY_COST);
  if (ok.length > 0) return ok;
  // 全禁的极端情况：回退到耗体最低的一招
  return [moves.reduce((a, b) => (MOVES[a].energyCost <= MOVES[b].energyCost ? a : b))];
}

/**
 * @param {{charName: string, energy: number, rngRoll: number}} p rngRoll ∈ [0,1)
 */
export function pickOpponentMove({ charName, energy, rngRoll }) {
  const moves = CHAR_BUILDS[charName].moves;
  const weights = TEMPERAMENTS[charName];
  const avail = availableMoves(charName, energy);

  const pairs = moves
    .map((id, i) => [id, weights[i]])
    .filter(([id]) => avail.includes(id));
  const total = pairs.reduce((s, [, w]) => s + w, 0);

  let acc = 0;
  for (const [id, w] of pairs) {
    acc += w / total;
    if (rngRoll < acc) return id;
  }
  return pairs[pairs.length - 1][0];
}

/** 每招的小动作提示文案 */
export const TELLS = {
  flatDrive: '抡圆了胳膊，杀气腾腾',
  smash: '死死盯着高空，跃跃欲试',
  topspin: '手腕飞快地转了两圈',
  slice: '握拍手松了松，脚步放缓',
  volley: '重心前倾，蠢蠢欲动要冲网',
  dropShot: '偷瞄了一眼网前的空当',
  lob: '瞄了一眼你身后的天空',
  passingShot: '盯着边线，眼神发直',
};

/**
 * @param {{charName, actualMove, truthRoll, fakeRoll}} p
 *   truthRoll < 0.75 → 真提示；否则从配招的其它招里按 fakeRoll 取假提示
 */
export function makeTell({ charName, actualMove, truthRoll, fakeRoll }) {
  if (truthRoll < 0.75) {
    return { text: TELLS[actualMove], isTrue: true };
  }
  const others = CHAR_BUILDS[charName].moves.filter((id) => id !== actualMove);
  const fake = others[Math.floor(fakeRoll * others.length)] ?? others[0];
  return { text: TELLS[fake], isTrue: false };
}
