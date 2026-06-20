/**
 * tennis.js — 家庭网球公开赛 API（D1）
 *
 * 端点：
 *   POST /api/tennis/record       上传战绩（JWT 必须，服务端校验见 tennisLib.js）
 *   GET  /api/tennis/leaderboard  全网榜（公开）：按用户聚合 TOP 50 + 最近 20 场
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { validateTennisRecord } from './tennisLib.js';
import { validateProgressUpdate, DEFAULT_PROGRESS } from './tennisProgressLib.js';

/** POST /api/tennis/record */
export async function handleTennisRecord(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) {
      return errorResponse(error, 401, env, request);
    }

    const body = await request.json().catch(() => null);
    const result = validateTennisRecord(body);
    if (!result.ok) {
      return errorResponse(result.error, 400, env, request);
    }

    const r = result.record;
    await env.DB.prepare(
      `INSERT INTO tennis_matches
        (user_id, character, character_face, opponent, opponent_face,
         sets_won, sets_lost, reaction_ms, grade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.sub, r.character, r.characterFace, r.opponent, r.opponentFace,
      r.setsWon, r.setsLost, r.reactionMs, r.grade
    ).run();

    return jsonResponse({ success: true }, 201, env, request);
  } catch (err) {
    console.error('Tennis record error:', err);
    return errorResponse('Failed to save tennis record: ' + err.message, 500, env, request);
  }
}

function rowToProgress(row) {
  if (!row) return { ...DEFAULT_PROGRESS };
  return {
    coins: row.coins,
    equipment: JSON.parse(row.equipment || '{}'),
    unlockedMoves: JSON.parse(row.unlocked_moves || '[]'),
    achievements: JSON.parse(row.achievements || '[]'),
    ownedCards: JSON.parse(row.owned_cards || '[]'),
    championships: row.championships,
    adventureClears: row.adventure_clears,
  };
}

/** GET /api/tennis/progress（auth） */
export async function handleGetTennisProgress(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) return errorResponse(error, 401, env, request);

    const row = await env.DB.prepare(
      'SELECT * FROM tennis_progress WHERE user_id = ?'
    ).bind(user.sub).first();

    return jsonResponse({ progress: rowToProgress(row) }, 200, env, request);
  } catch (err) {
    console.error('Tennis progress get error:', err);
    return errorResponse('Failed to load progress: ' + err.message, 500, env, request);
  }
}

/** PUT /api/tennis/progress（auth，服务端白名单校验） */
export async function handlePutTennisProgress(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) return errorResponse(error, 401, env, request);

    const body = await request.json().catch(() => null);
    const row = await env.DB.prepare(
      'SELECT * FROM tennis_progress WHERE user_id = ?'
    ).bind(user.sub).first();
    const existing = rowToProgress(row);

    const result = validateProgressUpdate(body, existing);
    if (!result.ok) return errorResponse(result.error, 400, env, request);

    const p = result.progress;
    await env.DB.prepare(
      `INSERT INTO tennis_progress
         (user_id, coins, equipment, unlocked_moves, achievements, owned_cards, championships, adventure_clears, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         coins = excluded.coins,
         equipment = excluded.equipment,
         unlocked_moves = excluded.unlocked_moves,
         achievements = excluded.achievements,
         owned_cards = excluded.owned_cards,
         championships = excluded.championships,
         adventure_clears = excluded.adventure_clears,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      user.sub, p.coins, JSON.stringify(p.equipment), JSON.stringify(p.unlockedMoves),
      JSON.stringify(p.achievements), JSON.stringify(p.ownedCards), p.championships, p.adventureClears
    ).run();

    return jsonResponse({ success: true, progress: p }, 200, env, request);
  } catch (err) {
    console.error('Tennis progress put error:', err);
    return errorResponse('Failed to save progress: ' + err.message, 500, env, request);
  }
}

// ===== 遥测（平衡性/可玩性数据收集，spec 评估体系）=====

const TELEMETRY_MODES = ['single', 'ladder', 'adventure'];
const TELEMETRY_CHARS = ['诚', 'Elza', '菲比', 'Ross', '铁蛋', '丫', '莹'];

/** POST /api/tennis/telemetry（公开，含游客；严格上限防脏数据） */
export async function handleTennisTelemetry(request, env) {
  try {
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== 'object') return errorResponse('Invalid body', 400, env, request);
    const ok = TELEMETRY_MODES.includes(b.mode)
      && TELEMETRY_CHARS.includes(b.character)
      && typeof b.opponent === 'string' && b.opponent.length <= 20
      && ['win', 'loss'].includes(b.result)
      && Number.isInteger(b.rallies) && b.rallies > 0 && b.rallies <= 500
      && Number.isInteger(b.aces) && b.aces >= 0 && b.aces <= 50
      && Number.isInteger(b.clutchWins) && b.clutchWins >= 0 && b.clutchWins <= 50
      && Number.isInteger(b.countersWon) && b.countersWon >= 0 && b.countersWon <= 500
      && typeof b.avgMultiplier === 'number' && b.avgMultiplier >= 0.5 && b.avgMultiplier <= 1.5
      && Number.isInteger(b.durationS) && b.durationS >= 0 && b.durationS <= 7200;
    if (!ok) return errorResponse('Invalid telemetry payload', 400, env, request);

    const moveUsage = typeof b.moveUsage === 'object' && b.moveUsage !== null
      ? JSON.stringify(b.moveUsage).slice(0, 500) : '{}';

    await env.DB.prepare(
      `INSERT INTO tennis_telemetry
        (mode, character, opponent, result, rallies, aces, clutch_wins, counters_won, avg_multiplier, duration_s, move_usage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      b.mode, b.character, b.opponent, b.result, b.rallies, b.aces,
      b.clutchWins, b.countersWon, b.avgMultiplier, b.durationS, moveUsage
    ).run();
    return jsonResponse({ success: true }, 201, env, request);
  } catch (err) {
    console.error('Tennis telemetry error:', err);
    return errorResponse('Failed: ' + err.message, 500, env, request);
  }
}

/** GET /api/tennis/telemetry/summary（公开只读聚合：平衡性监控面板数据源） */
export async function handleTennisTelemetrySummary(request, env) {
  try {
    const [byMode, byChar, byOpp, recent] = await env.DB.batch([
      env.DB.prepare(
        `SELECT mode, COUNT(*) AS games,
                ROUND(AVG(CASE WHEN result='win' THEN 100.0 ELSE 0 END), 1) AS win_rate,
                ROUND(AVG(rallies), 1) AS avg_rallies,
                ROUND(AVG(avg_multiplier), 3) AS avg_mult,
                ROUND(AVG(duration_s), 0) AS avg_duration
         FROM tennis_telemetry GROUP BY mode`
      ),
      env.DB.prepare(
        `SELECT character, COUNT(*) AS games,
                ROUND(AVG(CASE WHEN result='win' THEN 100.0 ELSE 0 END), 1) AS win_rate
         FROM tennis_telemetry GROUP BY character ORDER BY games DESC`
      ),
      env.DB.prepare(
        `SELECT opponent, COUNT(*) AS games,
                ROUND(AVG(CASE WHEN result='win' THEN 100.0 ELSE 0 END), 1) AS player_win_rate
         FROM tennis_telemetry GROUP BY opponent ORDER BY games DESC LIMIT 20`
      ),
      env.DB.prepare(
        `SELECT COUNT(*) AS games_7d FROM tennis_telemetry
         WHERE created_at > datetime('now', '-7 days')`
      ),
    ]);
    return jsonResponse({
      byMode: byMode.results ?? [],
      byCharacter: byChar.results ?? [],
      byOpponent: byOpp.results ?? [],
      last7Days: recent.results?.[0]?.games_7d ?? 0,
    }, 200, env, request);
  } catch (err) {
    console.error('Tennis telemetry summary error:', err);
    return errorResponse('Failed: ' + err.message, 500, env, request);
  }
}

/** GET /api/tennis/leaderboard（公开） */
export async function handleTennisLeaderboard(request, env) {
  try {
    const playersQuery = env.DB.prepare(
      `SELECT
         u.username,
         COUNT(*) AS games,
         SUM(CASE WHEN t.sets_won > t.sets_lost THEN 1 ELSE 0 END) AS wins,
         MIN(t.reaction_ms) AS best_ms,
         (SELECT character_face FROM tennis_matches
            WHERE user_id = t.user_id ORDER BY id DESC LIMIT 1) AS last_face,
         (SELECT character FROM tennis_matches
            WHERE user_id = t.user_id ORDER BY id DESC LIMIT 1) AS last_character,
         COALESCE(p.championships, 0) AS championships,
         COALESCE(p.adventure_clears, 0) AS adventure_clears
       FROM tennis_matches t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN tennis_progress p ON p.user_id = t.user_id
       GROUP BY t.user_id
       ORDER BY wins DESC,
                CAST(SUM(CASE WHEN t.sets_won > t.sets_lost THEN 1 ELSE 0 END) AS REAL) / COUNT(*) DESC,
                (best_ms IS NULL), best_ms ASC
       LIMIT 50`
    );

    const recentQuery = env.DB.prepare(
      `SELECT u.username, t.character, t.character_face, t.opponent, t.opponent_face,
              t.sets_won, t.sets_lost, t.reaction_ms, t.grade, t.created_at
       FROM tennis_matches t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.id DESC
       LIMIT 20`
    );

    const [playersRes, recentRes] = await env.DB.batch([playersQuery, recentQuery]);

    const players = (playersRes.results || []).map((p) => ({
      username: p.username,
      games: p.games,
      wins: p.wins,
      winRate: p.games ? Math.round((p.wins / p.games) * 1000) / 10 : 0,
      bestMs: p.best_ms,
      lastFace: p.last_face,
      lastCharacter: p.last_character,
      championships: p.championships,
      adventureClears: p.adventure_clears,
    }));

    const recent = (recentRes.results || []).map((m) => ({
      username: m.username,
      character: m.character,
      face: m.character_face,
      opponent: m.opponent,
      opponentFace: m.opponent_face,
      setsWon: m.sets_won,
      setsLost: m.sets_lost,
      reactionMs: m.reaction_ms,
      grade: m.grade,
      createdAt: m.created_at,
    }));

    return jsonResponse({ players, recent }, 200, env, request);
  } catch (err) {
    console.error('Tennis leaderboard error:', err);
    return errorResponse('Failed to load leaderboard: ' + err.message, 500, env, request);
  }
}

/** POST /api/tennis/feedback（公开，游客可提交；严格白名单校验） */
export async function handleTennisFeedback(request, env) {
  try {
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== 'object') return errorResponse('Invalid body', 400, env, request);
    if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) {
      return errorResponse('Invalid rating', 400, env, request);
    }
    const comment = typeof b.comment === 'string' ? b.comment.slice(0, 200) : null;
    const mode = TELEMETRY_MODES.includes(b.mode) ? b.mode : null;
    const character = TELEMETRY_CHARS.includes(b.character) ? b.character : null;
    const result = ['win', 'loss'].includes(b.result) ? b.result : null;

    await env.DB.prepare(
      `INSERT INTO tennis_feedback (rating, comment, mode, character, result) VALUES (?, ?, ?, ?, ?)`
    ).bind(b.rating, comment, mode, character, result).run();
    return jsonResponse({ success: true }, 201, env, request);
  } catch (err) {
    console.error('Tennis feedback error:', err);
    return errorResponse('Failed: ' + err.message, 500, env, request);
  }
}

/** GET /api/tennis/feedback/summary（公开只读聚合，供评估循环读取） */
export async function handleTennisFeedbackSummary(request, env) {
  try {
    const [agg, recent] = await env.DB.batch([
      env.DB.prepare(
        `SELECT COUNT(*) AS total,
                ROUND(AVG(rating), 2) AS avg_rating,
                COUNT(CASE WHEN rating >= 4 THEN 1 END) AS positive,
                COUNT(CASE WHEN rating <= 2 THEN 1 END) AS negative
         FROM tennis_feedback`
      ),
      env.DB.prepare(
        `SELECT rating, comment, mode, character, result, created_at
         FROM tennis_feedback
         WHERE comment IS NOT NULL AND comment != ''
         ORDER BY created_at DESC LIMIT 10`
      ),
    ]);
    return jsonResponse({
      summary: agg.results?.[0] ?? {},
      recentComments: recent.results ?? [],
    }, 200, env, request);
  } catch (err) {
    console.error('Tennis feedback summary error:', err);
    return errorResponse('Failed: ' + err.message, 500, env, request);
  }
}
