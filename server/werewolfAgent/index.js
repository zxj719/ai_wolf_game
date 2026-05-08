/**
 * Werewolf agent adapter — barrel export for the live-game pipeline.
 *
 * Public surface kept minimal: the contract/capability/skill/memory/validator
 * /promptComposer/repair layers are independently testable, but
 * werewolfSession.js (the only intended consumer) imports the high-level
 * pieces it needs from here.
 */

export {
  CONTRACT_VERSION,
  CAPABILITY_MODE,
  ACTION_TYPES,
  isSupportedAction,
  getContract,
  listContracts,
  FIELD_TYPES,
  TARGET_SOURCES,
  FALLBACK_STRATEGIES,
} from './contracts.js';

export { buildCapabilities } from './capabilities.js';
export { getSkill, listSkills, resolveRoleKey } from './skills.js';
export {
  buildPublicMemory,
  buildPrivateMemory,
  buildSemanticMemory,
  buildEpisodicMemory,
  buildStrategyMemory,
  buildMemoryView,
} from './memory.js';
export {
  validate,
  buildFallbackAction,
  ERROR_TYPES,
} from './validator.js';
export { composePrompt, composeRepairUserPrompt } from './promptComposer.js';
export { runWithRepair, REPAIR_LIMITS } from './repair.js';
