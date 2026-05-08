/**
 * Werewolf agent validator — strict, contract-driven validation of model
 * output. Returns a structured ValidationResult with rich error reasons so
 * the repair pipeline can compose a focused correction prompt.
 *
 * Visibility of legality decisions:
 *   - JSON parsing
 *   - required fields present
 *   - field types correct
 *   - target ids drawn from capabilities.legalTargets
 *   - forbidden ids rejected
 *   - identity_table entries reference real players + configured roles
 *   - action-specific hard rules (Hunter must shoot; Witch potion legality;
 *     Guard cannot repeat; Wolf cannot self/teammate; Vote -1 only when
 *     contract.allowSkip; null only when contract.allowNullTarget)
 *
 * The validator never mutates the model output. The `parsed` field on the
 * result is the parsed JSON if and only if `ok` is true; a sanitized
 * identity_table is included as `sanitizedIdentityTable` for engine reuse.
 */

import { FIELD_TYPES, FALLBACK_STRATEGIES } from './contracts.js';

const MAX_TEXT_LENGTH = 4000;

export const ERROR_TYPES = Object.freeze({
  PARSE: 'parse_error',
  MISSING_FIELD: 'missing_field',
  TYPE_MISMATCH: 'type_mismatch',
  ILLEGAL_TARGET: 'illegal_target',
  FORBIDDEN_TARGET: 'forbidden_target',
  ACTION_RULE: 'action_rule_violation',
  IDENTITY_TABLE: 'identity_table_invalid',
  SHAPE: 'shape_mismatch',
});

function tryParseJson(text) {
  if (text == null) return null;
  if (typeof text === 'object') return text;
  const raw = String(text).trim();
  if (!raw) return null;
  const stripped = raw.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    try {
      return JSON.parse(stripped.slice(first, last + 1));
    } catch {
      return null;
    }
  }
}

function checkType(value, expected) {
  switch (expected) {
    case FIELD_TYPES.STRING:
      return typeof value === 'string';
    case FIELD_TYPES.NULLABLE_STRING:
      return value === null || typeof value === 'string';
    case FIELD_TYPES.NUMBER:
      return typeof value === 'number' && Number.isFinite(value);
    case FIELD_TYPES.INTEGER:
      return Number.isInteger(value);
    case FIELD_TYPES.NULLABLE_INTEGER:
      return value === null || Number.isInteger(value);
    case FIELD_TYPES.BOOLEAN:
      return typeof value === 'boolean';
    case FIELD_TYPES.IDENTITY_TABLE:
      return value === null || (typeof value === 'object' && !Array.isArray(value));
    default:
      return false;
  }
}

function validateIdentityTable(table, { playerIds, allowedRoles }) {
  // identity_table is decorative metadata, not game-legal state. Treat
  // mismatches as sanitization opportunities, not validation failures —
  // unknown role labels (e.g. MiniMax emitting "unknown" / "likely_village")
  // get coerced to "未知" rather than triggering a repair round-trip. Only
  // shape (table must be an object) is a hard error.
  if (table == null) return { ok: true, sanitized: null, errors: [] };
  if (typeof table !== 'object' || Array.isArray(table)) {
    return {
      ok: false,
      sanitized: null,
      errors: [{ type: ERROR_TYPES.IDENTITY_TABLE, detail: 'identity_table must be an object' }],
    };
  }
  const sanitized = {};
  const playerIdSet = new Set(playerIds.map((id) => String(id)));
  const allowedRoleSet = new Set(allowedRoles);

  for (const [rawKey, rawValue] of Object.entries(table)) {
    const match = String(rawKey).match(/\d+/);
    if (!match) continue;
    const normalizedKey = match[0];
    if (playerIdSet.size > 0 && !playerIdSet.has(normalizedKey)) continue;
    const value = rawValue && typeof rawValue === 'object' ? rawValue : {};
    let suspect = typeof value.suspect === 'string' ? value.suspect.trim() : '';
    if (suspect && allowedRoleSet.size > 0) {
      const present = [...allowedRoleSet].filter((r) => suspect.includes(r));
      if (present.length === 0) {
        suspect = '未知';
      } else if (present.length === 1) {
        suspect = present[0];
      } else {
        suspect = present.join('或');
      }
    }
    let confidence = value.confidence;
    if (confidence != null) {
      const num = typeof confidence === 'number' ? confidence : Number(confidence);
      confidence = Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : undefined;
    }
    sanitized[normalizedKey] = {
      ...(suspect ? { suspect } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      ...(typeof value.reason === 'string' ? { reason: value.reason.slice(0, 600) } : {}),
    };
  }
  return { ok: true, sanitized, errors: [] };
}

function findMissingFields(parsed, contract) {
  const missing = [];
  for (const field of contract.fields) {
    if (!field.required) continue;
    if (!Object.prototype.hasOwnProperty.call(parsed, field.name)) {
      missing.push(field.name);
    }
  }
  return missing;
}

function findTypeMismatches(parsed, contract) {
  const issues = [];
  for (const field of contract.fields) {
    if (field.type === FIELD_TYPES.IDENTITY_TABLE) continue; // checked separately
    if (!Object.prototype.hasOwnProperty.call(parsed, field.name)) continue;
    if (!checkType(parsed[field.name], field.type)) {
      issues.push({ field: field.name, expected: field.type, got: typeof parsed[field.name] });
    }
  }
  return issues;
}

function checkActionRules({ contract, parsed, capabilities, params }) {
  const errors = [];
  const legal = new Set(capabilities.legalTargets || []);
  const forbidden = new Set(capabilities.forbiddenTargets || []);
  const allowSkip = !!contract.allowSkip;
  const allowNullTarget = !!contract.allowNullTarget;

  switch (contract.actionType) {
    case 'DAY_VOTE': {
      const targetId = parsed.targetId;
      if (targetId === -1) {
        if (!allowSkip) errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'abstention not allowed by contract' });
      } else if (!Number.isInteger(targetId) || !legal.has(targetId)) {
        errors.push({ type: ERROR_TYPES.ILLEGAL_TARGET, detail: `targetId ${targetId} not in legal vote targets [${[...legal].join(',')}] (or -1)` });
      } else if (forbidden.has(targetId)) {
        errors.push({ type: ERROR_TYPES.FORBIDDEN_TARGET, detail: `cannot vote for forbidden target ${targetId}` });
      }
      break;
    }
    case 'NIGHT_WOLF':
    case 'NIGHT_SEER': {
      const targetId = parsed.targetId;
      if (!Number.isInteger(targetId) || !legal.has(targetId)) {
        errors.push({ type: ERROR_TYPES.ILLEGAL_TARGET, detail: `targetId ${targetId} not in legal targets [${[...legal].join(',')}]` });
      } else if (forbidden.has(targetId)) {
        errors.push({ type: ERROR_TYPES.FORBIDDEN_TARGET, detail: `targetId ${targetId} is forbidden for this action` });
      }
      break;
    }
    case 'NIGHT_GUARD': {
      const targetId = parsed.targetId;
      if (targetId === null) {
        if (!allowNullTarget) errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'null guard target not allowed' });
      } else if (!Number.isInteger(targetId) || !legal.has(targetId)) {
        errors.push({ type: ERROR_TYPES.ILLEGAL_TARGET, detail: `guard targetId ${targetId} must be a living non-cannotGuard player or null` });
      } else if (params?.cannotGuard != null && Number(targetId) === Number(params.cannotGuard)) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: `cannot repeat last night's guard target ${params.cannotGuard}` });
      }
      break;
    }
    case 'NIGHT_WITCH': {
      const useSave = !!parsed.useSave;
      const usePoison = parsed.usePoison;
      const canSave = params?.canSave !== false && params?.dyingId != null;
      const hasPoison = params?.hasPoison !== false;
      if (useSave && !canSave) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'cannot useSave: antidote unavailable or no-one was killed' });
      }
      if (usePoison != null) {
        if (!hasPoison) {
          errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'cannot use poison: poison unavailable' });
        } else if (!Number.isInteger(usePoison) || !legal.has(usePoison)) {
          errors.push({ type: ERROR_TYPES.ILLEGAL_TARGET, detail: `usePoison target ${usePoison} not in legal targets [${[...legal].join(',')}]` });
        } else if (forbidden.has(usePoison)) {
          errors.push({ type: ERROR_TYPES.FORBIDDEN_TARGET, detail: `cannot poison forbidden target ${usePoison}` });
        }
      }
      if (useSave && usePoison != null) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'cannot use both potions on the same night' });
      }
      break;
    }
    case 'HUNTER_SHOOT': {
      if (parsed.shoot !== true) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'shoot must be true; hunters cannot decline to fire' });
      }
      const targetId = parsed.targetId;
      if (!Number.isInteger(targetId) || !legal.has(targetId)) {
        errors.push({ type: ERROR_TYPES.ILLEGAL_TARGET, detail: `targetId ${targetId} not in legal targets [${[...legal].join(',')}]` });
      } else if (forbidden.has(targetId)) {
        errors.push({ type: ERROR_TYPES.FORBIDDEN_TARGET, detail: `cannot shoot forbidden target ${targetId}` });
      }
      break;
    }
    case 'DAY_SPEECH': {
      if (typeof parsed.speech === 'string' && parsed.speech.length === 0) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'speech must not be empty' });
      }
      const intention = parsed.voteIntention;
      if (intention != null && intention !== -1 && !Number.isInteger(intention)) {
        errors.push({ type: ERROR_TYPES.ACTION_RULE, detail: 'voteIntention must be a player id, -1, or null' });
      }
      break;
    }
    default:
      break;
  }
  return errors;
}

/**
 * Validate a model response against a contract.
 *
 * @param {object} args
 * @param {object} args.contract       contract for the action type
 * @param {string|object} args.text    raw model output (string or pre-parsed)
 * @param {object} args.capabilities   from buildCapabilities()
 * @param {object} args.params         original action params
 * @param {object} args.gameSetup      role pool — controls identity_table roles
 * @returns {{
 *   ok: boolean,
 *   parsed: object | null,
 *   errors: Array<{type:string, detail:string}>,
 *   sanitizedIdentityTable: object | null,
 *   errorType: string | null
 * }}
 */
export function validate({ contract, text, capabilities, params, gameSetup }) {
  if (!contract) {
    return {
      ok: false,
      parsed: null,
      errors: [{ type: ERROR_TYPES.SHAPE, detail: 'no contract' }],
      sanitizedIdentityTable: null,
      errorType: ERROR_TYPES.SHAPE,
    };
  }
  const parsed = tryParseJson(text);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      parsed: null,
      errors: [{ type: ERROR_TYPES.PARSE, detail: 'output is not a JSON object' }],
      sanitizedIdentityTable: null,
      errorType: ERROR_TYPES.PARSE,
    };
  }

  const errors = [];

  for (const f of findMissingFields(parsed, contract)) {
    errors.push({ type: ERROR_TYPES.MISSING_FIELD, detail: `missing required field: ${f}` });
  }

  for (const m of findTypeMismatches(parsed, contract)) {
    errors.push({
      type: ERROR_TYPES.TYPE_MISMATCH,
      detail: `field ${m.field} expected ${m.expected} but got ${m.got}`,
    });
  }

  for (const f of contract.fields) {
    if (f.maxLength && typeof parsed[f.name] === 'string' && parsed[f.name].length > MAX_TEXT_LENGTH) {
      errors.push({ type: ERROR_TYPES.SHAPE, detail: `${f.name} exceeds max length ${MAX_TEXT_LENGTH}` });
    }
  }

  errors.push(...checkActionRules({ contract, parsed, capabilities, params }));

  const playerIds = (capabilities.publicFacts?.alive || []).concat(capabilities.publicFacts?.dead || []);
  const allowedRoles = Array.isArray(gameSetup?.STANDARD_ROLES) && gameSetup.STANDARD_ROLES.length > 0
    ? Array.from(new Set(gameSetup.STANDARD_ROLES))
    : ['狼人', '村民', '预言家', '女巫', '猎人', '守卫'];
  const idResult = validateIdentityTable(parsed.identity_table, { playerIds, allowedRoles });
  if (!idResult.ok) errors.push(...idResult.errors);

  const ok = errors.length === 0;
  return {
    ok,
    parsed: ok ? parsed : null,
    errors,
    sanitizedIdentityTable: idResult.sanitized,
    errorType: ok ? null : (errors[0]?.type || ERROR_TYPES.SHAPE),
  };
}

/**
 * Build a deterministic legal fallback action object for a contract. The
 * engine calls this when repair is exhausted. Never mutates state.
 */
export function buildFallbackAction({ contract, capabilities }) {
  const legal = capabilities.legalTargets || [];
  const strategy = contract.fallback?.strategy;
  switch (strategy) {
    case FALLBACK_STRATEGIES.SKIP_VOTE:
      return { reasoning: 'fallback: insufficient information to vote safely', targetId: -1 };
    case FALLBACK_STRATEGIES.SKIP_NULL_TARGET:
      return { reasoning: 'fallback: skip guard', targetId: null };
    case FALLBACK_STRATEGIES.FIRST_LEGAL_TARGET: {
      const target = legal[0] ?? null;
      if (target == null) return { reasoning: 'fallback: no legal target', targetId: null };
      return { reasoning: 'fallback: defaulted to first legal target', targetId: target };
    }
    case FALLBACK_STRATEGIES.WITCH_NO_OP:
      return { useSave: false, usePoison: null, reasoning: 'fallback: keep both potions' };
    case FALLBACK_STRATEGIES.HUNTER_FIRST_LEGAL: {
      const target = legal[0] ?? null;
      if (target == null) return { shoot: false, targetId: null, reason: 'fallback: no legal target to shoot' };
      return { shoot: true, targetId: target, reason: 'fallback: defaulted to first legal target' };
    }
    case FALLBACK_STRATEGIES.SPEECH_NEUTRAL:
      return {
        speech: '我先听听其他玩家的发言，再综合判断。',
        voteIntention: null,
        thought: 'fallback neutral speech',
      };
    default:
      return {};
  }
}

export { tryParseJson };
