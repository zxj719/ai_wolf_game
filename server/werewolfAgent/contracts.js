/**
 * Werewolf agent contracts — the static, data-only description of every
 * supported live-game action.
 *
 * One contract per actionType. Each contract is a plain object so the
 * validator, prompt composer, and repair pipeline can reason over it
 * uniformly. Adding a new action = one entry here + one prompt fragment in
 * promptComposer; no per-action branches in validator/repair.
 *
 * v1 supports the 7 actions in the adapter spec. Roles still in legacy
 * prompt-only mode (Magician/Knight/Dreamweaver) are intentionally absent —
 * `getContract()` throws for them so server falls back to the broad prompt.
 */

export const CONTRACT_VERSION = 'werewolf-agent-contract-v1';
export const CAPABILITY_MODE = 'minimax-claude-code-v1';

export const ACTION_TYPES = Object.freeze([
  'DAY_SPEECH',
  'DAY_VOTE',
  'NIGHT_WOLF',
  'NIGHT_SEER',
  'NIGHT_WITCH',
  'NIGHT_GUARD',
  'HUNTER_SHOOT',
]);

const FIELD_TYPES = Object.freeze({
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  NULLABLE_INTEGER: 'integer|null',
  NULLABLE_STRING: 'string|null',
  IDENTITY_TABLE: 'identity_table',
});

/**
 * Target source keys reference fields on the request `params`. The validator
 * pulls the legal id list from this key when checking the model output.
 *
 *   ALIVE_NON_SELF       - players.alive minus current player (vote default)
 *   ALIVE_NON_WOLF_TEAM  - players.alive minus wolves (wolf night kill)
 *   PARAM_VALID_TARGETS  - explicit params.validTargets
 *   PARAM_ALIVE_TARGETS  - explicit params.aliveTargets
 *   GUARD_TARGETS        - alive players, optionally minus cannotGuard, plus null skip
 *   WITCH_POISON_TARGETS - alive players excluding self, plus null skip
 */
const TARGET_SOURCES = Object.freeze({
  ALIVE_NON_SELF: 'alive_non_self',
  ALIVE_NON_WOLF_TEAM: 'alive_non_wolf_team',
  PARAM_VALID_TARGETS: 'param_valid_targets',
  PARAM_ALIVE_TARGETS: 'param_alive_targets',
  GUARD_TARGETS: 'guard_targets',
  WITCH_POISON_TARGETS: 'witch_poison_targets',
});

/**
 * Fallback strategies — what to return if repair exhausts. Each contract
 * declares one. Engine uses the strategy + the resolved legal target list to
 * synthesize a deterministic, legal action object.
 *
 *   SKIP_VOTE              - { targetId: -1 } (only when contract.allowSkip)
 *   SKIP_NULL_TARGET       - { targetId: null } (only when contract.allowNullTarget)
 *   FIRST_LEGAL_TARGET     - { targetId: legalIds[0] } (mandatory actions)
 *   WITCH_NO_OP            - { useSave:false, usePoison:null }
 *   HUNTER_FIRST_LEGAL     - { shoot:true, targetId: legalIds[0] }
 *   SPEECH_NEUTRAL         - empty defensive speech, no vote intention
 */
const FALLBACK_STRATEGIES = Object.freeze({
  SKIP_VOTE: 'skip_vote',
  SKIP_NULL_TARGET: 'skip_null_target',
  FIRST_LEGAL_TARGET: 'first_legal_target',
  WITCH_NO_OP: 'witch_no_op',
  HUNTER_FIRST_LEGAL: 'hunter_first_legal',
  SPEECH_NEUTRAL: 'speech_neutral',
});

const COMMON_IDENTITY_FIELD = Object.freeze({
  name: 'identity_table',
  type: FIELD_TYPES.IDENTITY_TABLE,
  required: false,
  description: 'Map of playerId -> { suspect, confidence, reason }; only current players and configured roles allowed.',
});

const CONTRACTS = {
  DAY_SPEECH: {
    actionType: 'DAY_SPEECH',
    visibility: 'public',                       // speech goes into public memory
    targetSource: null,                         // no targetId field
    allowSkip: false,
    allowNullTarget: false,
    fields: [
      { name: 'thought',        type: FIELD_TYPES.NULLABLE_STRING, required: false, maxLength: 1500, description: 'private chain-of-thought; never leaks to other players' },
      { name: 'speech',         type: FIELD_TYPES.STRING,          required: true,  maxLength: 1200, description: 'public-facing speech text' },
      { name: 'voteIntention',  type: FIELD_TYPES.NULLABLE_INTEGER, required: false, description: 'preview of who you intend to vote (-1 = abstain, null = undecided)' },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'Return strict JSON with the speech field present. Keep speech under 1200 characters. voteIntention must be a player id, -1, or null.',
    fallback: { strategy: FALLBACK_STRATEGIES.SPEECH_NEUTRAL },
  },

  DAY_VOTE: {
    actionType: 'DAY_VOTE',
    visibility: 'public',
    targetSource: TARGET_SOURCES.PARAM_VALID_TARGETS,
    allowSkip: true,
    allowNullTarget: false,
    fields: [
      { name: 'reasoning', type: FIELD_TYPES.STRING,  required: true, maxLength: 600 },
      { name: 'targetId',  type: FIELD_TYPES.INTEGER, required: true, description: 'player id from params.validTargets, or -1 to abstain' },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'targetId must be one of the legal ids OR -1 to abstain. reasoning must be a non-empty string.',
    fallback: { strategy: FALLBACK_STRATEGIES.SKIP_VOTE },
  },

  NIGHT_WOLF: {
    actionType: 'NIGHT_WOLF',
    visibility: 'private',
    targetSource: TARGET_SOURCES.ALIVE_NON_WOLF_TEAM,
    allowSkip: false,
    allowNullTarget: false,
    fields: [
      { name: 'targetId',  type: FIELD_TYPES.INTEGER, required: true, description: 'player id of the kill target; cannot be a dead player or a wolf teammate' },
      { name: 'reasoning', type: FIELD_TYPES.STRING,  required: true, maxLength: 600 },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'targetId must be a living non-wolf player id. Wolves cannot kill teammates or dead players.',
    fallback: { strategy: FALLBACK_STRATEGIES.FIRST_LEGAL_TARGET },
  },

  NIGHT_SEER: {
    actionType: 'NIGHT_SEER',
    visibility: 'private',
    targetSource: TARGET_SOURCES.PARAM_VALID_TARGETS,
    allowSkip: false,
    allowNullTarget: false,
    fields: [
      { name: 'targetId',  type: FIELD_TYPES.INTEGER, required: true },
      { name: 'reasoning', type: FIELD_TYPES.STRING,  required: true, maxLength: 600 },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'targetId must be drawn from the supplied legal targets list (alive players you have not yet inspected, excluding yourself).',
    fallback: { strategy: FALLBACK_STRATEGIES.FIRST_LEGAL_TARGET },
  },

  NIGHT_WITCH: {
    actionType: 'NIGHT_WITCH',
    visibility: 'private',
    targetSource: TARGET_SOURCES.WITCH_POISON_TARGETS,
    allowSkip: false,
    allowNullTarget: true,
    fields: [
      { name: 'useSave',   type: FIELD_TYPES.BOOLEAN,           required: true,  description: 'true to use the antidote on the player marked as dyingId' },
      { name: 'usePoison', type: FIELD_TYPES.NULLABLE_INTEGER,  required: true,  description: 'id of the player to poison, or null to keep the poison' },
      { name: 'reasoning', type: FIELD_TYPES.STRING,            required: true,  maxLength: 600 },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'You cannot use both potions on the same night. Only set useSave=true if params.canSave is true. Only return a non-null usePoison if params.hasPoison is true and the id is a living non-self player.',
    fallback: { strategy: FALLBACK_STRATEGIES.WITCH_NO_OP },
  },

  NIGHT_GUARD: {
    actionType: 'NIGHT_GUARD',
    visibility: 'private',
    targetSource: TARGET_SOURCES.GUARD_TARGETS,
    allowSkip: false,
    allowNullTarget: true,
    fields: [
      { name: 'targetId',  type: FIELD_TYPES.NULLABLE_INTEGER, required: true, description: 'player id to protect, or null to skip; cannot equal params.cannotGuard' },
      { name: 'reasoning', type: FIELD_TYPES.STRING,           required: true, maxLength: 600 },
      COMMON_IDENTITY_FIELD,
    ],
    repairGuidance: 'targetId must be a living player or null. Never repeat last night\'s guard target when params.cannotGuard is set.',
    fallback: { strategy: FALLBACK_STRATEGIES.SKIP_NULL_TARGET },
  },

  HUNTER_SHOOT: {
    actionType: 'HUNTER_SHOOT',
    visibility: 'public',
    targetSource: TARGET_SOURCES.PARAM_ALIVE_TARGETS,
    allowSkip: false,
    allowNullTarget: false,
    fields: [
      { name: 'shoot',    type: FIELD_TYPES.BOOLEAN, required: true, description: 'must be true; hunters are required to fire on death' },
      { name: 'targetId', type: FIELD_TYPES.INTEGER, required: true, description: 'living non-self target' },
      { name: 'reason',   type: FIELD_TYPES.STRING,  required: true, maxLength: 600 },
    ],
    repairGuidance: 'shoot must be true. targetId must be a living player other than yourself drawn from params.aliveTargets.',
    fallback: { strategy: FALLBACK_STRATEGIES.HUNTER_FIRST_LEGAL },
  },
};

Object.freeze(CONTRACTS);
for (const c of Object.values(CONTRACTS)) {
  Object.freeze(c);
  Object.freeze(c.fields);
  Object.freeze(c.fallback);
  for (const f of c.fields) Object.freeze(f);
}

export { FIELD_TYPES, TARGET_SOURCES, FALLBACK_STRATEGIES };

export function isSupportedAction(actionType) {
  return Object.prototype.hasOwnProperty.call(CONTRACTS, actionType);
}

export function getContract(actionType) {
  if (!isSupportedAction(actionType)) {
    throw new Error(`Unsupported action contract: ${actionType}`);
  }
  return CONTRACTS[actionType];
}

export function listContracts() {
  return Object.values(CONTRACTS);
}
