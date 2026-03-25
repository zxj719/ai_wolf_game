/**
 * submitGameLog.js
 *
 * Serializes the full game state after game-end and POSTs to the
 * /api/game-end webhook for the review pipeline.
 *
 * Designed to be called from a dedicated useEffect in App.jsx.
 * The Worker queues to KV and returns 202 immediately — actual
 * review processing happens in reviewPipeline.mjs asynchronously.
 */

import { buildApiUrl } from './apiBase';

const REQUEST_TIMEOUT = 15000; // 15s — Worker should return 202 fast

/**
 * Truncate game history to the last `maxRounds` rounds.
 * A "round" = one full day cycle (discussion + voting).
 * This guards against oversized payloads from very long games.
 *
 * @param {Array}  entries  - speech/vote/death history array
 * @param {number} maxRounds - keep last N rounds
 * @returns {Array}
 */
export function truncateToRounds(entries, maxRounds = 8) {
  if (!Array.isArray(entries) || entries.length === 0) return entries;
  const lastDay = entries[entries.length - 1]?.day ?? 0;
  const cutoff = lastDay - maxRounds + 1;
  if (cutoff <= 0) return entries;
  // Keep only entries from the last `maxRounds` days
  return entries.filter(e => e.day >= cutoff);
}

/**
 * Serialize and submit full game state to the review pipeline.
 *
 * @param {Object} gameState - full reducer state from useWerewolfGame
 * @param {Object} options
 * @param {Function} options.onError  - called on failure (e.g. logger.error)
 * @param {number}   [options.maxRounds=8] - truncation limit
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitGameLog(gameState, { onError, maxRounds = 8 } = {}) {
  const {
    players = [],
    speechHistory = [],
    voteHistory = [],
    deathHistory = [],
    nightActionHistory = [],
    gameResult,
    gameMode,
    dayCount,
    phase,
    role: userRole,
    gameSessionId,
  } = gameState;

  try {
    const payload = {
      gameSessionId: gameSessionId || `local-${Date.now()}`,
      gameResult,
      gameMode,
      dayCount,
      phase,
      userRole,
      // Truncate to last 8 rounds to bound payload size
      speechHistory: truncateToRounds(speechHistory, maxRounds),
      voteHistory: truncateToRounds(voteHistory, maxRounds),
      deathHistory: truncateToRounds(deathHistory, maxRounds),
      nightActionHistory: truncateToRounds(nightActionHistory, maxRounds),
      // Full players array is small — no truncation needed
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        isAlive: p.isAlive,
        // Include model info if available
        modelId: p._modelId || null,
        modelName: p._modelName || null,
      })),
      // Timestamp of when this log was captured
      submittedAt: new Date().toISOString(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(buildApiUrl('/api/game-end'), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    return { success: true };
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? 'submitGameLog: request timeout'
      : `submitGameLog: ${err.message}`;

    if (onError) onError(msg);
    else console.error('[submitGameLog]', msg);

    // Critical gap (flagged in eng review): no retry on failure.
    // For Phase 1 demo this is acceptable; future work: localStorage
    // fallback + retry on next page load.
    return { success: false, error: msg };
  }
}
