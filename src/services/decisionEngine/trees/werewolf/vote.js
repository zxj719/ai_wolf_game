/**
 * 狼人白天投票行为树
 *
 * 优先级：
 *   1. 投唯一跳预言家（消灭信息源，最高价值）
 *   2. 投公开金水玩家（消灭验证好人）
 *   3. 跟高嫌疑归票（掩护身份，看起来和平民逻辑一致）
 *   4. 随机投非队友（兜底）
 *
 * 硬约束：永远不投狼人队友。
 */

import { selector, sequence } from '../../core/nodes.js';
import { seerClaimInValidTargets, goldWaterInValidTargets, hasWolfSafeTarget } from '../../conditions/wolf.js';
import { hasHighSuspicion } from '../../conditions/common.js';
import { voteRealSeer, voteGoldWater, voteHighSuspicionForCover, voteRandomNonWolf } from '../../actions/wolfActions.js';

export const werewolfVoteTree = selector('werewolf_vote', [
  sequence('投跳预言家', [seerClaimInValidTargets, voteRealSeer]),
  sequence('投金水好人', [goldWaterInValidTargets, voteGoldWater]),
  sequence('跟归票掩护', [hasHighSuspicion, voteHighSuspicionForCover]),
  sequence('随机安全票',  [hasWolfSafeTarget, voteRandomNonWolf]),
]);
