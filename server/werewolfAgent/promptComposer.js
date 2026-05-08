/**
 * Werewolf agent prompt composer — schema-first, compact prompt assembly.
 *
 * Final order (the model sees exactly this; nothing else):
 *   1. SYSTEM RULES                  contract version + live-game guardrails
 *   2. ACTION                        actionType + role + day/phase
 *   3. ROLE / PRIVATE CONTEXT        role-scoped private facts only
 *   4. PUBLIC FACTS                  alive list, deaths, votes, public claims
 *   5. LEGAL ACTIONS                 explicit legal target ids + forbidden ids
 *   6. STRATEGY HINTS                advisory only
 *   7. OUTPUT SCHEMA                 declared field-by-field for this action
 *   8. JSON-ONLY INSTRUCTION         hard rule: emit one JSON object
 *
 * No external memory of other players, no other roles' skills, no shell or
 * filesystem hints — that contract is set in SYSTEM RULES at the top.
 */

import { CONTRACT_VERSION, CAPABILITY_MODE, FIELD_TYPES } from './contracts.js';
import { getSkill } from './skills.js';

const HARD_GUARDRAILS = [
  'You are a Werewolf game agent invoked by an HTTP server.',
  'No filesystem access. No shell. No network. No tools. Do not browse, search, or call any external API.',
  'You only see this prompt; never assume cross-player memory.',
  'Output exactly one JSON object that matches the OUTPUT SCHEMA. No prose. No markdown fences.',
];

function fieldDescription(field) {
  const required = field.required ? 'required' : 'optional';
  const desc = field.description ? ` — ${field.description}` : '';
  return `  - ${field.name} (${field.type}, ${required})${desc}`;
}

function describeOutputSchema(contract) {
  const lines = [`OUTPUT SCHEMA for ${contract.actionType}:`];
  for (const field of contract.fields) lines.push(fieldDescription(field));
  return lines.join('\n');
}

function describeLegalActions({ contract, capabilities, params }) {
  const lines = ['LEGAL ACTIONS:'];
  if (contract.targetSource) {
    lines.push(`  legalTargets: [${(capabilities.legalTargets || []).join(', ')}]`);
  }
  if (capabilities.forbiddenTargets?.length) {
    lines.push(`  forbiddenTargets: [${capabilities.forbiddenTargets.join(', ')}]`);
  }
  if (contract.allowSkip) lines.push('  abstain (-1): allowed');
  if (contract.allowNullTarget) lines.push('  null target (skip): allowed');
  if (contract.actionType === 'NIGHT_WITCH') {
    lines.push(`  canSave: ${params?.canSave === false ? 'false' : 'true'}`);
    lines.push(`  hasPoison: ${params?.hasPoison === false ? 'false' : 'true'}`);
    if (params?.dyingId != null) lines.push(`  dyingId: ${params.dyingId}`);
  }
  if (contract.actionType === 'NIGHT_GUARD' && params?.cannotGuard != null) {
    lines.push(`  cannotGuard: ${params.cannotGuard}`);
  }
  if (contract.actionType === 'DAY_VOTE' && params?.lastVoteIntention != null) {
    lines.push(`  lastVoteIntention: ${params.lastVoteIntention}`);
  }
  return lines.join('\n');
}

function describePublicFacts(facts) {
  if (!facts) return 'PUBLIC FACTS: (none)';
  const lines = ['PUBLIC FACTS:'];
  lines.push(`  day=${facts.dayCount ?? '?'} phase=${facts.phase || '?'}`);
  lines.push(`  alive: [${(facts.alive || []).join(', ')}]`);
  if (facts.dead?.length) lines.push(`  dead: [${facts.dead.join(', ')}]`);
  if (facts.deaths?.length) {
    const summary = facts.deaths
      .map((d) => `D${d.day ?? '?'}${d.phase} P${d.playerId} (${d.cause || '?'})`)
      .join('; ');
    lines.push(`  death log: ${summary}`);
  }
  if (facts.votes?.length) {
    const summary = facts.votes
      .map((r) => `D${r.day ?? '?'}: ${r.eliminated === -1 ? 'tied' : `P${r.eliminated} eliminated`}`)
      .join('; ');
    lines.push(`  vote log: ${summary}`);
  }
  return lines.join('\n');
}

function describePrivateContext({ contract, currentPlayer, privateFacts, skill, memoryView }) {
  const lines = ['ROLE / PRIVATE CONTEXT:'];
  lines.push(`  you: P${currentPlayer?.id} role=${currentPlayer?.role || '?'} alive=${currentPlayer?.isAlive !== false}`);
  if (privateFacts?.wolfTeam?.length) {
    lines.push(`  wolf teammates: ${privateFacts.wolfTeam.map((p) => `P${p.id}${p.isAlive ? '' : '(dead)'}`).join(', ')}`);
  }
  if (privateFacts?.seerChecks?.length) {
    lines.push(`  your seer checks: ${privateFacts.seerChecks.map((c) => `N${c.night}->P${c.targetId}=${c.isWolf ? 'wolf' : 'good'}`).join('; ')}`);
  }
  if (privateFacts?.role === '女巫') {
    lines.push(`  potions: save=${privateFacts.hasSave ? 'available' : 'used'} poison=${privateFacts.hasPoison ? 'available' : 'used'}`);
    if (privateFacts.dyingId != null) lines.push(`  tonight's wolf kill target: P${privateFacts.dyingId}`);
  }
  if (privateFacts?.role === '守卫') {
    lines.push(`  last guard: ${privateFacts.lastGuardTarget != null ? `P${privateFacts.lastGuardTarget}` : 'none'}`);
  }
  if (skill) lines.push(`  role skill: ${skill}`);
  if (memoryView?.private?.transcript) {
    lines.push('  your private memory (own past turns only):');
    lines.push(memoryView.private.transcript.split('\n').map((l) => `    ${l}`).join('\n'));
  }
  return lines.join('\n');
}

function describePublicMemory(memoryView) {
  if (!memoryView?.public?.transcript) return null;
  return ['PUBLIC MATCH TRANSCRIPT:', memoryView.public.transcript.split('\n').map((l) => `  ${l}`).join('\n')].join('\n');
}

function describeStrategyHints(hints) {
  if (!hints?.length) return null;
  return ['STRATEGY HINTS (advisory only):', ...hints.map((h) => `  - ${h}`)].join('\n');
}

function describeAction({ contract, currentPlayer, capabilities }) {
  const facts = capabilities.publicFacts || {};
  return [
    'ACTION:',
    `  type: ${contract.actionType}`,
    `  player: P${currentPlayer?.id} role=${currentPlayer?.role}`,
    `  day=${facts.dayCount ?? '?'} phase=${facts.phase || '?'}`,
  ].join('\n');
}

function describeSystemRules() {
  return [
    `SYSTEM RULES (${CONTRACT_VERSION}, ${CAPABILITY_MODE}):`,
    ...HARD_GUARDRAILS.map((line) => `  - ${line}`),
  ].join('\n');
}

const JSON_ONLY = 'JSON ONLY: respond with exactly one JSON object that matches OUTPUT SCHEMA. No commentary, no markdown fences, no extra keys.';

/**
 * Compose the action prompt.
 *
 * @param {object} args
 * @param {object} args.contract        contract for this action
 * @param {object} args.capabilities    from buildCapabilities()
 * @param {object} args.params          original action params
 * @param {object} args.player          current player snapshot
 * @param {object} args.memoryView      from buildMemoryView()
 * @param {string} [args.systemAddon]   optional extra rules from caller
 * @param {string} [args.userAddon]     optional extra task text from caller
 * @returns {{ system: string, user: string }}
 */
export function composePrompt({ contract, capabilities, params, player, memoryView, systemAddon, userAddon }) {
  const skill = getSkill(player?.role, contract.actionType);

  const systemSections = [
    describeSystemRules(),
    describeAction({ contract, currentPlayer: player, capabilities }),
  ];
  if (systemAddon) systemSections.push(['EXTRA RULES:', systemAddon].join('\n'));

  const userSections = [
    describePrivateContext({
      contract,
      currentPlayer: player,
      privateFacts: capabilities.privateFacts,
      skill,
      memoryView,
    }),
    describePublicFacts(capabilities.publicFacts),
  ];

  const publicMemory = describePublicMemory(memoryView);
  if (publicMemory) userSections.push(publicMemory);

  userSections.push(describeLegalActions({ contract, capabilities, params }));

  const hintsBlock = describeStrategyHints(capabilities.strategyHints);
  if (hintsBlock) userSections.push(hintsBlock);

  userSections.push(describeOutputSchema(contract));

  if (userAddon) userSections.push(['TASK NOTE:', userAddon].join('\n'));

  userSections.push(JSON_ONLY);

  return {
    system: systemSections.join('\n\n'),
    user: userSections.join('\n\n'),
  };
}

/**
 * Build a focused correction prompt for the repair pipeline. Includes the
 * exact validation errors, the contract's repairGuidance, the legal options
 * still available, and the same JSON-only rule. Reuses the user prompt
 * that produced the bad output, so the model sees the original task.
 */
export function composeRepairUserPrompt({ priorUser, validation, contract, capabilities }) {
  const errorLines = (validation.errors || []).map((e) => `  - [${e.type}] ${e.detail}`);
  const sections = [
    'PRIOR REQUEST (unchanged):',
    priorUser,
    '',
    'CORRECTION REQUIRED — your previous output failed validation:',
    ...errorLines,
    '',
    'GUIDANCE:',
    `  ${contract.repairGuidance}`,
    'CURRENT LEGAL TARGETS:',
    `  legalTargets: [${(capabilities.legalTargets || []).join(', ')}]`,
  ];
  if (capabilities.forbiddenTargets?.length) {
    sections.push(`  forbiddenTargets: [${capabilities.forbiddenTargets.join(', ')}]`);
  }
  sections.push('', 'Re-emit one JSON object that satisfies the OUTPUT SCHEMA. JSON ONLY.');
  return sections.join('\n');
}

export const _internals = { describePublicFacts, describeLegalActions, describeOutputSchema, FIELD_TYPES };
