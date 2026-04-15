/**
 * 村民白天投票行为树
 *
 * 决策优先级（Selector 从上到下）：
 *   1. 唯一预言家给出查杀 → 直接投查杀
 *   2. 多预言家对抗 → 投嫌疑高的那个跳预言家
 *   3. 场上有高嫌疑目标 → 跟归票
 *   4. 兜底：随机选一个非金水目标
 *
 * 使用方式：
 *   import { villagerVoteTree } from './trees/villager/vote';
 *   const tree = new BehaviorTree(villagerVoteTree);
 *   const decision = tree.run(blackboard);
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

export const villagerVoteTree = selector('villager_vote', [
  sequence('跟查杀', [uniqueSeerWithKill, voteSeerKill]),
  sequence('打对抗', [multipleSeerClaims, voteSuspiciousSeer]),
  sequence('跟归票', [hasHighSuspicion, voteHighestSuspicion]),
  voteRandom, // 兜底
]);
