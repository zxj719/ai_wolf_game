/**
 * Werewolf agent memory views — compressed read-only projections of the
 * per-session memory map already maintained in werewolfSession.js.
 *
 * The session map stores per-player turn objects with both `summary`
 * (public-safe) and `privateSummary` (only the agent itself). This module
 * gives the prompt composer five disjoint views over that data so each
 * section of the prompt receives only what its scope allows.
 *
 * Bucket scopes:
 *   public        — every alive player's most recent public actions
 *   private       — current agent's *own* private turns (their own thoughts)
 *   semantic      — distilled "what is true now" facts (who claimed seer,
 *                   who voted whom). Server-side reduction so the model
 *                   doesn't have to re-derive each turn.
 *   episodic      — chronological recent events (deaths, votes), capped
 *   strategy      — empty in v1; placeholder for future learned heuristics
 *
 * The memory limits are intentionally tight to keep the prompt small.
 */

const MAX_PUBLIC_TURNS = 24;
const MAX_PRIVATE_TURNS = 18;
const MAX_EPISODIC_EVENTS = 16;

function cleanText(value, limit = 360) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function publicTurnLine(turn, index) {
  const day = turn.day ?? '?';
  const phase = turn.phase || '';
  return `${index + 1}. D${day} ${phase} P${turn.playerId} ${turn.actionType}: ${cleanText(turn.summary, 320)}`;
}

function privateTurnLine(turn, index) {
  return `${index + 1}. ${turn.actionType}: ${cleanText(turn.privateSummary || turn.summary, 320)}`;
}

/**
 * Build the public memory view from session.publicTurns. Excludes any
 * privateSummary fields by construction.
 */
export function buildPublicMemory(session, { limit = MAX_PUBLIC_TURNS } = {}) {
  const turns = (session?.publicTurns || []).slice(-limit);
  return {
    turns: turns.map((t) => ({
      day: t.day ?? null,
      phase: t.phase || '',
      playerId: t.playerId,
      actionType: t.actionType,
      summary: cleanText(t.summary, 320),
    })),
    transcript: turns.map(publicTurnLine).join('\n'),
  };
}

/**
 * Build the private memory view for one specific player. Reads from that
 * player's bucket only — never from any other agent's bucket.
 */
export function buildPrivateMemory(session, playerId, { limit = MAX_PRIVATE_TURNS } = {}) {
  const key = String(playerId);
  const turns = (session?.agentMemories?.get?.(key) || []).slice(-limit);
  return {
    turns: turns.map((t) => ({
      day: t.day ?? null,
      phase: t.phase || '',
      actionType: t.actionType,
      privateSummary: cleanText(t.privateSummary || t.summary, 320),
    })),
    transcript: turns.map(privateTurnLine).join('\n'),
  };
}

/**
 * Build a small "facts you should already know" semantic view, derived from
 * gameState. Currently aggregates public-claim counts and known votes; it is
 * deliberately small and additive — the authoritative facts are still in
 * the publicFacts capability bucket.
 */
export function buildSemanticMemory(gameState) {
  const claimHistory = Array.isArray(gameState?.claimHistory) ? gameState.claimHistory : [];
  const claims = claimHistory.map((c) => ({
    day: c.day ?? null,
    playerId: c.playerId,
    type: c.type,
    payload: c.payload || {},
  }));

  const voteHistory = Array.isArray(gameState?.voteHistory) ? gameState.voteHistory : [];
  const lastVote = voteHistory.length > 0 ? voteHistory[voteHistory.length - 1] : null;

  return {
    claims,
    lastVote: lastVote
      ? {
        day: lastVote.day ?? null,
        eliminated: lastVote.eliminated ?? -1,
        votes: (lastVote.votes || []).map((v) => ({ from: v.from, to: v.to })),
      }
      : null,
  };
}

/**
 * Build a chronological episodic stream of recent observable events
 * (deaths + votes), capped to keep prompts small.
 */
export function buildEpisodicMemory(gameState, { limit = MAX_EPISODIC_EVENTS } = {}) {
  const events = [];
  for (const d of gameState?.deathHistory || []) {
    events.push({
      kind: 'death',
      day: d.day ?? null,
      phase: d.phase || '',
      playerId: d.playerId,
      cause: d.cause || '',
    });
  }
  for (const round of gameState?.voteHistory || []) {
    events.push({
      kind: 'vote',
      day: round.day ?? null,
      eliminated: round.eliminated ?? -1,
    });
  }

  events.sort((a, b) => {
    if ((a.day ?? 0) !== (b.day ?? 0)) return (a.day ?? 0) - (b.day ?? 0);
    if (a.kind === b.kind) return 0;
    return a.kind === 'death' ? -1 : 1;
  });

  return { events: events.slice(-limit) };
}

/**
 * Strategy memory bucket. v1 is intentionally empty — the contract spec
 * notes this as a future channel for learned per-player heuristics. Kept as
 * a stable shape so prompt composer / tests do not need to special-case
 * its absence.
 */
export function buildStrategyMemory(/* session, playerId */) {
  return { hints: [] };
}

/**
 * Convenience: assemble all five views in one call.
 */
export function buildMemoryView({ session, playerId, gameState }) {
  return {
    public: buildPublicMemory(session),
    private: buildPrivateMemory(session, playerId),
    semantic: buildSemanticMemory(gameState),
    episodic: buildEpisodicMemory(gameState),
    strategy: buildStrategyMemory(session, playerId),
  };
}
