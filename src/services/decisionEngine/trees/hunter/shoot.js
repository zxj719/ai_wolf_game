/**
 * 猎人开枪行为树
 *
 * 猎人死亡触发，必须开枪带走一名玩家。
 * 决策优先级（Selector 从上到下）：
 *   1. 预言家查杀目标存活 → 开枪带走查杀（最高价值）
 *   2. 多预言家对抗 → 打嫌疑高的跳预言家
 *   3. 场上有高嫌疑目标 → 开枪带走高嫌疑
 *   4. 兜底：随机开枪（猎人必须开枪）
 *
 * 与村民投票树共享相同的条件 + 动作节点——猎人和村民
 * 的目标优先级一致，区别只在触发时机（投票 vs 死亡开枪）。
 */

import { selector, sequence } from '../../core/nodes.js';
import {
  uniqueSeerWithKill,
  multipleSeerClaims,
  hasHighSuspicion,
} from '../../conditions/common.js';
import {
  voteSeerKill,
  voteSuspiciousSeer,
  voteHighestSuspicion,
  voteRandom,
} from '../../actions/pickVote.js';

export const hunterShootTree = selector('hunter_shoot', [
  sequence('打查杀', [uniqueSeerWithKill, voteSeerKill]),
  sequence('打对抗', [multipleSeerClaims, voteSuspiciousSeer]),
  sequence('打高嫌疑', [hasHighSuspicion, voteHighestSuspicion]),
  voteRandom, // 猎人必须开枪，此兜底不可移除
]);
