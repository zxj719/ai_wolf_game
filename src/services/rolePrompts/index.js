/**
 * 角色提示词模块导出聚合器
 *
 * 渐进式披露架构说明：
 * - 每个角色有独立的提示词模块
 * - 提示词根据游戏配置（存在的角色、局数等）动态调整
 * - 不存在的角色相关内容不会出现在提示词中
 */

// 基础规则
export {
  TERMINOLOGY,
  VICTORY_MODE_PROMPTS,
  IDENTITY_TABLE_PROMPT,
  ADVERSARIAL_REFLECTION,
  isMiniGame,
  isStandardGame,
  isLargeGame,
  detectExistingRoles,
  buildConditionalRules,
  buildVictoryPrompt,
  getBaseContext
} from './baseRules';

// 角色模块
export { WEREWOLF_PROMPTS } from './werewolf';
export { SEER_PROMPTS } from './seer';
export { WITCH_PROMPTS } from './witch';
export { HUNTER_PROMPTS } from './hunter';
export { GUARD_PROMPTS } from './guard';
export { MAGICIAN_PROMPTS } from './magician';
export { KNIGHT_PROMPTS } from './knight';
export { VILLAGER_PROMPTS } from './villager';

// 角色模块映射表
import { WEREWOLF_PROMPTS } from './werewolf';
import { SEER_PROMPTS } from './seer';
import { WITCH_PROMPTS } from './witch';
import { HUNTER_PROMPTS } from './hunter';
import { GUARD_PROMPTS } from './guard';
import { MAGICIAN_PROMPTS } from './magician';
import { KNIGHT_PROMPTS } from './knight';
import { VILLAGER_PROMPTS } from './villager';

export const ROLE_MODULES = {
  '狼人': WEREWOLF_PROMPTS,
  '预言家': SEER_PROMPTS,
  '女巫': WITCH_PROMPTS,
  '猎人': HUNTER_PROMPTS,
  '守卫': GUARD_PROMPTS,
  '魔术师': MAGICIAN_PROMPTS,
  '骑士': KNIGHT_PROMPTS,
  '村民': VILLAGER_PROMPTS
};

/**
 * 获取角色模块
 * @param {string} role - 角色名称
 * @returns {Object} 角色提示词模块
 */
export const getRoleModule = (role) => {
  return ROLE_MODULES[role] || ROLE_MODULES['村民'];
};
