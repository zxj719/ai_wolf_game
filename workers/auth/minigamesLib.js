/**
 * minigamesLib.js — 小游戏成绩校验（纯函数，便于单测）
 *
 * variant 白名单需与前端保持一致：
 *   扫雷 → src/modules/games/minesweeper/mineEngine.js 的 DIFFICULTIES
 *   麻将 → src/modules/games/mahjong/mahjongEngine.js 的 LAYOUTS
 * minMs 是人类可达的下限（远低于世界纪录量级），只挡明显伪造的数据。
 */

export const MINIGAME_VARIANTS = {
  minesweeper: {
    beginner: { minMs: 500 },
    intermediate: { minMs: 3000 },
    expert: { minMs: 10000 },
  },
  mahjong: {
    garden: { minMs: 4000 },
    cross: { minMs: 10000 },
    fortress: { minMs: 10000 },
    pyramid: { minMs: 15000 },
    turtle: { minMs: 20000 },
    ziggurat: { minMs: 20000 },
  },
};

const MAX_MS = 6 * 60 * 60 * 1000;

export function isKnownVariant(game, variant) {
  // hasOwn：防止 '__proto__' / 'constructor' 之类的键命中原型链
  return Object.hasOwn(MINIGAME_VARIANTS, game) && Object.hasOwn(MINIGAME_VARIANTS[game], variant);
}

export function validateMinigameScore(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const { game, variant, timeMs } = body;
  if (typeof game !== 'string' || typeof variant !== 'string' || !isKnownVariant(game, variant)) {
    return { ok: false, error: 'Unknown game or variant' };
  }
  if (!Number.isInteger(timeMs) || timeMs < MINIGAME_VARIANTS[game][variant].minMs || timeMs > MAX_MS) {
    return { ok: false, error: 'Invalid time' };
  }
  return { ok: true, record: { game, variant, timeMs } };
}
