/**
 * 通用条件节点 —— 纯状态判断，不修改 Blackboard
 */

import { condition } from '../core/nodes.js';

/** 至少存在一个跳预言家（可能是真可能是假） */
export const anySeerClaim = condition('存在预言家跳', bb =>
  bb.state.seerClaims.length > 0
);

/** 仅有 1 个跳预言家，且有至少 1 个查杀目标 */
export const uniqueSeerWithKill = condition('唯一预言家+有查杀', bb => {
  const claims = bb.state.seerClaims;
  if (claims.length !== 1) return false;
  return claims[0].kills.length > 0;
});

/** 存在 ≥ 2 个跳预言家（对抗局面） */
export const multipleSeerClaims = condition('多预言家对抗', bb =>
  bb.state.seerClaims.length >= 2
);

/** 存在高怀疑分目标（≥ 40） */
export const hasHighSuspicion = condition('有高嫌疑目标', bb => {
  for (const [, v] of bb.state.suspicion) if (v >= 40) return true;
  return false;
});

/** 自己是否在任一公开金水列表里 */
export const isSelfDeclaredGood = condition('自己被金水', bb => {
  const selfId = bb.state.self.id;
  return bb.state.seerClaims.some(c => c.goldWaters.includes(selfId));
});
