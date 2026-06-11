/**
 * tennis.js — 家庭网球公开赛 API（D1）
 *
 * 端点：
 *   POST /api/tennis/record       上传战绩（JWT 必须，服务端校验见 tennisLib.js）
 *   GET  /api/tennis/leaderboard  全网榜（公开）：按用户聚合 TOP 50 + 最近 20 场
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { validateTennisRecord } from './tennisLib.js';

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
            WHERE user_id = t.user_id ORDER BY id DESC LIMIT 1) AS last_character
       FROM tennis_matches t
       JOIN users u ON u.id = t.user_id
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
