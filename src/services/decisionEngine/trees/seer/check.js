/**
 * 预言家夜间查验行为树
 *
 * 优先级：
 *   1. 多预言家对抗 → 查嫌疑更高的那个
 *   2. 场上有高嫌疑且未查 → 查高嫌疑
 *   3. 兜底：随机查验
 */

import { selector, sequence } from '../../core/nodes.js';
import { hasUncheckSeerConflict, hasUncheckedSuspect } from '../../conditions/night.js';
import { checkSuspiciousSeer, checkHighestSuspicion, checkRandom } from '../../actions/nightActions.js';

export const seerCheckTree = selector('seer_check', [
  sequence('查对抗预言家', [hasUncheckSeerConflict, checkSuspiciousSeer]),
  sequence('查高嫌疑目标', [hasUncheckedSuspect, checkHighestSuspicion]),
  checkRandom,
]);
