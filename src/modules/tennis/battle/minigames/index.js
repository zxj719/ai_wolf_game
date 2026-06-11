/**
 * minigames/index.js — 招式 id → 小游戏组件映射（与 moves.js 的 minigame 字段对应）
 */

import { ServeTiming, PrecisionStop, RhythmBar, DualTiming, ShrinkSmash } from './timingGames';
import { RhythmMash, WhackVolley, DirectionReact, GaugeDrop } from './actionGames';

export { ServeTiming };

export const MINIGAME_COMPONENTS = {
  rhythmMash: RhythmMash,        // 重炮平击
  shrinkSmash: ShrinkSmash,      // 高压扣杀
  rhythmBar: RhythmBar,          // 上旋抽击
  precisionStop: PrecisionStop,  // 切削放缓
  whackVolley: WhackVolley,      // 网前截击
  gaugeDrop: GaugeDrop,          // 放小球
  directionReact: DirectionReact,// 挑高球
  dualTiming: DualTiming,        // 穿越球
};
