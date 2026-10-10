/**
 * minigames.js — 小游戏（扫雷 / 麻将消除）全网排行榜 API（D1）
 *
 * 端点：
 *   POST /api/minigames/score        上传通关成绩（JWT 必须）
 *   GET  /api/minigames/leaderboard  ?game=&variant=  每人最好成绩 TOP 50（公开；带 JWT 时附自己的名次）
 */

import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';
import { validateMinigameScore, isKnownVariant } from './minigamesLib.js';

/** POST /api/minigames/score */
export async function handleMinigameScore(request, env) {
  try {
    const { user, error } = await authMiddleware(request, env);
    if (error) return errorResponse(error, 401, env, request);

    const body = await request.json().catch(() => null);
    const result = validateMinigameScore(body);
    if (!result.ok) return errorResponse(result.error, 400, env, request);

    const { game, variant, timeMs } = result.record;
    const prev = await env.DB.prepare(
      'SELECT MIN(time_ms) AS best FROM minigame_scores WHERE user_id = ? AND game = ? AND variant = ?'
    ).bind(user.sub, game, variant).first();

    await env.DB.prepare(
      'INSERT INTO minigame_scores (user_id, game, variant, time_ms) VALUES (?, ?, ?, ?)'
    ).bind(user.sub, game, variant, timeMs).run();

    const best = prev?.best == null ? timeMs : Math.min(prev.best, timeMs);
    const rankRow = await env.DB.prepare(
      `SELECT COUNT(*) AS ahead FROM (
         SELECT MIN(time_ms) AS best FROM minigame_scores
         WHERE game = ? AND variant = ? GROUP BY user_id
       ) WHERE best < ?`
    ).bind(game, variant, best).first();

    return jsonResponse({
      success: true,
      personalBest: prev?.best == null || timeMs < prev.best,
      best,
      rank: (rankRow?.ahead ?? 0) + 1,
    }, 201, env, request);
  } catch (err) {
    console.error('Minigame score error:', err);
    return errorResponse('Failed to save score', 500, env, request);
  }
}

/** GET /api/minigames/leaderboard?game=&variant= */
export async function handleMinigameLeaderboard(request, env) {
  try {
    const url = new URL(request.url);
    const game = url.searchParams.get('game') || '';
    const variant = url.searchParams.get('variant') || '';
    if (!isKnownVariant(game, variant)) return errorResponse('Unknown game or variant', 400, env, request);

    const { results } = await env.DB.prepare(
      `SELECT u.username, MIN(s.time_ms) AS best, COUNT(*) AS plays, MAX(s.created_at) AS last_at
       FROM minigame_scores s
       JOIN users u ON u.id = s.user_id
       WHERE s.game = ? AND s.variant = ?
       GROUP BY s.user_id
       ORDER BY best ASC, last_at ASC
       LIMIT 50`
    ).bind(game, variant).all();

    let me = null;
    const { user } = await authMiddleware(request, env);
    if (user) {
      const mine = await env.DB.prepare(
        'SELECT MIN(time_ms) AS best, COUNT(*) AS plays FROM minigame_scores WHERE user_id = ? AND game = ? AND variant = ?'
      ).bind(user.sub, game, variant).first();
      if (mine?.best != null) {
        const ahead = await env.DB.prepare(
          `SELECT COUNT(*) AS ahead FROM (
             SELECT MIN(time_ms) AS best FROM minigame_scores
             WHERE game = ? AND variant = ? GROUP BY user_id
           ) WHERE best < ?`
        ).bind(game, variant, mine.best).first();
        me = { best: mine.best, plays: mine.plays, rank: (ahead?.ahead ?? 0) + 1 };
      }
    }

    return jsonResponse({
      game,
      variant,
      players: (results || []).map((r) => ({ username: r.username, best: r.best, plays: r.plays })),
      me,
    }, 200, env, request);
  } catch (err) {
    console.error('Minigame leaderboard error:', err);
    return errorResponse('Failed to load leaderboard', 500, env, request);
  }
}
