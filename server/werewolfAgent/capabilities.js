/**
 * Werewolf agent capabilities — derive deterministic, action-scoped views of
 * the world that the model is allowed to see.
 *
 * Three buckets per call:
 *   - publicFacts      everything any player could observe (alive list, deaths,
 *                      vote history, public claims). Never includes private
 *                      thoughts or other agents' role knowledge.
 *   - privateFacts     only the *current* player's role-known information.
 *                      Wolves see their pack; seer sees own checks; witch
 *                      sees potion availability + tonight's dyingId; guard
 *                      sees their own last-guard target. No-one else's.
 *   - legalTargets     resolved id list per the contract's targetSource. The
 *                      validator uses this as the source of truth for
 *                      target legality.
 *
 * Optional:
 *   - strategyHints    advisory only; never hard commands. Empty by default.
 */

import { TARGET_SOURCES } from './contracts.js';

function asPlayer(p) {
  return {
    id: p.id,
    role: p.role,
    isAlive: p.isAlive !== false,
    name: p.name || `P${p.id}`,
    hasWitchSave: p.hasWitchSave,
    hasWitchPoison: p.hasWitchPoison,
  };
}

function alivePlayers(state) {
  return (state.players || []).map(asPlayer).filter((p) => p.isAlive);
}

function findPlayer(state, playerId) {
  return (state.players || []).find((p) => Number(p.id) === Number(playerId)) || null;
}

function buildPublicFacts(state) {
  const players = state.players || [];
  const deathHistory = state.deathHistory || [];
  const voteHistory = state.voteHistory || [];

  const alive = players.filter((p) => p.isAlive !== false).map((p) => p.id);
  const dead = players.filter((p) => p.isAlive === false).map((p) => p.id);

  const deaths = deathHistory.map((d) => ({
    playerId: d.playerId,
    day: d.day ?? null,
    phase: d.phase || '',
    cause: d.cause || '',
  }));

  const votes = voteHistory.map((round) => ({
    day: round.day ?? null,
    eliminated: round.eliminated ?? -1,
    votes: (round.votes || []).map((v) => ({ from: v.from, to: v.to })),
  }));

  return {
    dayCount: state.dayCount ?? null,
    phase: state.phase || '',
    alive,
    dead,
    deaths,
    votes,
  };
}

function buildPrivateFacts(state, currentPlayer) {
  if (!currentPlayer) return {};
  const facts = {
    selfId: currentPlayer.id,
    role: currentPlayer.role,
    isAlive: currentPlayer.isAlive !== false,
  };

  const players = state.players || [];

  if (currentPlayer.role === '狼人') {
    facts.wolfTeam = players
      .filter((p) => p.role === '狼人')
      .map((p) => ({ id: p.id, isAlive: p.isAlive !== false }));
  }

  if (currentPlayer.role === '预言家') {
    const checks = (state.seerChecks || []).filter(
      (c) => Number(c.seerId) === Number(currentPlayer.id),
    );
    facts.seerChecks = checks.map((c) => ({
      night: c.night ?? null,
      targetId: c.targetId,
      isWolf: !!c.isWolf,
    }));
  }

  if (currentPlayer.role === '女巫') {
    facts.hasSave = currentPlayer.hasWitchSave !== false;
    facts.hasPoison = currentPlayer.hasWitchPoison !== false;
    if (state.nightDecisions?.wolfTarget != null) {
      facts.dyingId = state.nightDecisions.wolfTarget;
    }
  }

  if (currentPlayer.role === '守卫') {
    facts.lastGuardTarget = state.nightDecisions?.lastGuardTarget ?? null;
  }

  return facts;
}

function resolveLegalTargets({ contract, state, params, currentPlayer }) {
  if (!contract.targetSource) return [];

  const alive = alivePlayers(state);
  const aliveIds = alive.map((p) => p.id);
  const selfId = currentPlayer?.id;

  switch (contract.targetSource) {
    case TARGET_SOURCES.ALIVE_NON_SELF:
      return aliveIds.filter((id) => id !== selfId);

    case TARGET_SOURCES.ALIVE_NON_WOLF_TEAM: {
      const wolfIds = new Set(
        (state.players || [])
          .filter((p) => p.role === '狼人' && p.isAlive !== false)
          .map((p) => p.id),
      );
      return aliveIds.filter((id) => !wolfIds.has(id));
    }

    case TARGET_SOURCES.PARAM_VALID_TARGETS: {
      const supplied = Array.isArray(params?.validTargets) ? params.validTargets : [];
      const aliveSet = new Set(aliveIds);
      const filtered = supplied
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && aliveSet.has(v));
      return filtered.length > 0 ? filtered : aliveIds.filter((id) => id !== selfId);
    }

    case TARGET_SOURCES.PARAM_ALIVE_TARGETS: {
      const supplied = Array.isArray(params?.aliveTargets) ? params.aliveTargets : [];
      const aliveSet = new Set(aliveIds);
      const filtered = supplied
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && aliveSet.has(v) && v !== selfId);
      return filtered.length > 0 ? filtered : aliveIds.filter((id) => id !== selfId);
    }

    case TARGET_SOURCES.GUARD_TARGETS: {
      const cannotGuard = params?.cannotGuard;
      return aliveIds.filter((id) => Number(id) !== Number(cannotGuard));
    }

    case TARGET_SOURCES.WITCH_POISON_TARGETS:
      return aliveIds.filter((id) => id !== selfId);

    default:
      return [];
  }
}

function buildForbiddenTargets({ contract, params, currentPlayer }) {
  const forbidden = new Set();
  if (currentPlayer?.id != null && contract.targetSource !== TARGET_SOURCES.GUARD_TARGETS) {
    forbidden.add(currentPlayer.id);
  }
  if (contract.actionType === 'NIGHT_GUARD' && params?.cannotGuard != null) {
    forbidden.add(Number(params.cannotGuard));
  }
  if (contract.actionType === 'NIGHT_WOLF') {
    // wolf teammates handled by ALIVE_NON_WOLF_TEAM, but make it explicit
    // for prompts
    forbidden.add(currentPlayer?.id);
  }
  return Array.from(forbidden).filter((v) => v != null);
}

function buildStrategyHints({ contract, params }) {
  const hints = [];
  if (contract.actionType === 'NIGHT_GUARD' && params?.cannotGuard != null) {
    hints.push(`Last night you guarded ${params.cannotGuard}; do not repeat.`);
  }
  if (contract.actionType === 'NIGHT_WITCH') {
    if (params?.canSave === false) {
      hints.push('Antidote already used or unavailable; useSave must be false.');
    }
    if (params?.hasPoison === false) {
      hints.push('Poison already used or unavailable; usePoison must be null.');
    }
    if (params?.dyingId == null) {
      hints.push('No-one was killed tonight (peaceful night); useSave must be false.');
    }
  }
  if (contract.actionType === 'DAY_VOTE' && params?.lastVoteIntention != null) {
    const hint = params.lastVoteIntention === -1
      ? 'You signalled abstention earlier; staying consistent strengthens credibility.'
      : `You signalled voting ${params.lastVoteIntention} earlier; switching needs justification.`;
    hints.push(hint);
  }
  return hints;
}

/**
 * Build the action-scoped capability view.
 *
 * @param {object} args
 * @param {object} args.contract       resolved contract for this action type
 * @param {object} args.gameState      compact game snapshot from the client
 * @param {object} args.params         action-specific params from the client
 * @param {object} args.player         current player as supplied by the client
 * @returns {{
 *   contractVersion: string,
 *   actionType: string,
 *   currentPlayer: object,
 *   publicFacts: object,
 *   privateFacts: object,
 *   legalTargets: number[],
 *   forbiddenTargets: number[],
 *   strategyHints: string[]
 * }}
 */
export function buildCapabilities({ contract, gameState, params, player }) {
  const safeState = gameState && typeof gameState === 'object' ? gameState : {};
  const safeParams = params && typeof params === 'object' ? params : {};
  const richPlayer = findPlayer(safeState, player?.id) || player || null;

  return {
    actionType: contract.actionType,
    currentPlayer: richPlayer ? asPlayer(richPlayer) : null,
    publicFacts: buildPublicFacts(safeState),
    privateFacts: buildPrivateFacts(safeState, richPlayer),
    legalTargets: resolveLegalTargets({ contract, state: safeState, params: safeParams, currentPlayer: richPlayer }),
    forbiddenTargets: buildForbiddenTargets({ contract, params: safeParams, currentPlayer: richPlayer }),
    strategyHints: buildStrategyHints({ contract, params: safeParams }),
  };
}
