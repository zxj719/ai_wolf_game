/**
 * 女巫夜间用药行为树
 *
 * 决策优先级：
 *   1. 应该救人 → 使用解药
 *   2. 有明确查杀目标 → 使用毒药
 *   3. 有高嫌疑目标 → 使用毒药（次优）
 *   4. 兜底：什么都不做（留药以后用）
 *
 * 注意：每轮只能做一件事（救药和毒药互斥）
 */

import { selector, sequence } from '../../core/nodes.js';
import { shouldSave, hasPoisonTarget, hasPoisonHighSuspicion } from '../../conditions/night.js';
import { useSavePotion, usePoisonOnSeerKill, usePoisonHighSuspicion, doNothing } from '../../actions/nightActions.js';

export const witchPotionTree = selector('witch_potion', [
  sequence('使用解药', [shouldSave, useSavePotion]),
  sequence('毒查杀目标', [hasPoisonTarget, usePoisonOnSeerKill]),
  sequence('毒高嫌疑', [hasPoisonHighSuspicion, usePoisonHighSuspicion]),
  doNothing,
]);
