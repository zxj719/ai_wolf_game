/**
 * turn.js — 签发 Cloudflare Realtime TURN 短期 ICE 凭据。
 *
 * GET /api/turn-credentials (JWT) → { iceServers: {urls,username,credential} | null }
 *
 * 用 Worker secret 调 CF API 现签短期凭据（不把静态密码下发到前端）。
 * 未配置 TURN_TOKEN_ID/TURN_TOKEN 时返回 null，前端退回 STUN-only（不报错、不回归）。
 */
import { jsonResponse, errorResponse, authMiddleware } from './middleware.js';

export async function handleTurnCredentials(request, env) {
  const { user } = await authMiddleware(request, env);
  if (!user) return errorResponse('Not authenticated', 401, env, request);

  if (!env.TURN_TOKEN_ID || !env.TURN_TOKEN) {
    return jsonResponse({ iceServers: null, reason: 'turn not configured' }, 200, env, request);
  }
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_TOKEN_ID}/credentials/generate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.TURN_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: 86400 }),
      }
    );
    if (!res.ok) {
      return jsonResponse({ iceServers: null, reason: `turn ${res.status}` }, 200, env, request);
    }
    const data = await res.json();
    return jsonResponse({ iceServers: data.iceServers || null }, 200, env, request);
  } catch (e) {
    return jsonResponse({ iceServers: null, reason: e.message }, 200, env, request);
  }
}
