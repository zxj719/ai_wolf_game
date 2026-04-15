/**
 * 守卫夜间守护行为树
 *
 * 优先级：
 *   1. 守唯一公开预言家（高价值目标）
 *   2. 守公开金水玩家（已验好人）
 *   3. 守随机存活（兜底，排除上晚目标）
 */

import { selector, sequence } from '../../core/nodes.js';
import { canGuardSeer, hasGuardableGoldWater } from '../../conditions/night.js';
import { guardSeerClaimant, guardGoldWater, guardRandom } from '../../actions/nightActions.js';

export const guardProtectTree = selector('guard_protect', [
  sequence('守公开预言家', [canGuardSeer, guardSeerClaimant]),
  sequence('守公开金水',   [hasGuardableGoldWater, guardGoldWater]),
  guardRandom,
]);
