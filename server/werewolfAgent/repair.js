/**
 * Werewolf agent repair pipeline — bounded retry-with-correction, then
 * deterministic fallback.
 *
 * Policy (from the spec):
 *   - 1 initial generation + up to MAX_REPAIR_ATTEMPTS additional repair calls.
 *   - Repair prompt restates the validation error, legal options, and the
 *     JSON-only rule.
 *   - If repair exhausts, build a contract.fallback action and return with
 *     diagnostics.fallbackUsed = true.
 *   - Failed attempts are NOT recorded into shared public memory (caller is
 *     responsible for that — only commit on success).
 *
 * The repair function takes a `runModel` callback so this module stays
 * transport-agnostic; werewolfSession.js wires the actual MiniMax / Claude
 * Code call. This makes unit testing trivial.
 */

import { validate, buildFallbackAction } from './validator.js';
import { composeRepairUserPrompt } from './promptComposer.js';

const MAX_REPAIR_ATTEMPTS = 2;

/**
 * Run the validate -> repair -> fallback loop.
 *
 * @param {object} args
 * @param {object} args.contract      contract for the action type
 * @param {object} args.capabilities  from buildCapabilities()
 * @param {object} args.params        original action params
 * @param {object} args.gameSetup     role pool — for identity_table validation
 * @param {{system:string,user:string}} args.basePrompt  prompt from composePrompt
 * @param {(prompt:{system:string,user:string}) => Promise<{text:string, transport:object}>} args.runModel
 *        function the engine uses to actually call the LLM. Should return
 *        the raw text + any transport metadata (model, runtime session id).
 * @returns {Promise<{
 *   action: object,
 *   transport: object | null,
 *   diagnostics: {
 *     validationAttempts: number,
 *     repairAttempts: number,
 *     fallbackUsed: boolean,
 *     errorType: string | null,
 *     lastErrors: Array<{type:string,detail:string}>
 *   },
 *   sanitizedIdentityTable: object | null
 * }>}
 */
export async function runWithRepair({
  contract,
  capabilities,
  params,
  gameSetup,
  basePrompt,
  runModel,
}) {
  let validationAttempts = 0;
  let repairAttempts = 0;
  let lastValidation = null;
  let lastTransport = null;

  // initial attempt
  let prompt = basePrompt;
  for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt += 1) {
    let modelResult;
    try {
      modelResult = await runModel(prompt);
    } catch (err) {
      lastValidation = {
        ok: false,
        parsed: null,
        errors: [{ type: 'transport_error', detail: err?.message || 'model call failed' }],
        sanitizedIdentityTable: null,
        errorType: 'transport_error',
      };
      // transport errors should bubble up so the caller can return a 502
      throw err;
    }

    validationAttempts += 1;
    lastTransport = modelResult.transport || null;

    const validation = validate({
      contract,
      text: modelResult.text,
      capabilities,
      params,
      gameSetup,
    });

    if (validation.ok) {
      const parsed = { ...validation.parsed };
      if (validation.sanitizedIdentityTable) parsed.identity_table = validation.sanitizedIdentityTable;
      return {
        action: parsed,
        transport: lastTransport,
        diagnostics: {
          validationAttempts,
          repairAttempts,
          fallbackUsed: false,
          errorType: null,
          lastErrors: [],
        },
        sanitizedIdentityTable: validation.sanitizedIdentityTable || null,
      };
    }

    lastValidation = validation;

    if (attempt >= MAX_REPAIR_ATTEMPTS) break;
    repairAttempts += 1;
    prompt = {
      system: basePrompt.system,
      user: composeRepairUserPrompt({
        priorUser: basePrompt.user,
        validation,
        contract,
        capabilities,
      }),
    };
  }

  // fallback
  const fallback = buildFallbackAction({ contract, capabilities });
  return {
    action: fallback,
    transport: lastTransport,
    diagnostics: {
      validationAttempts,
      repairAttempts,
      fallbackUsed: true,
      errorType: lastValidation?.errorType || 'unknown_error',
      lastErrors: lastValidation?.errors || [],
    },
    sanitizedIdentityTable: lastValidation?.sanitizedIdentityTable || null,
  };
}

export const REPAIR_LIMITS = Object.freeze({ MAX_REPAIR_ATTEMPTS });
