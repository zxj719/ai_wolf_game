/**
 * 路由常量与路径归一化 — 从 useAppRouter 抽出的纯粹部分。
 *
 * 新路径体系体现"所有模块平级"：狼人杀、音乐、股市、博客都是 /<module>，
 * home（个人主页入口）位于 /。旧路径（/home、/wolfgame、/sites）通过
 * LEGACY_PATH_MAP 做 301 式重定向兼容，Phase 5 删除。
 */

export const ROUTES = {
  // 系统级
  HOME:   '/',
  LOGIN:  '/login',
  RESET:  '/reset-password',
  VERIFY: '/verify-email',

  // 狼人杀模块
  WEREWOLF:       '/werewolf',
  WEREWOLF_SETUP: '/werewolf/setup',
  WEREWOLF_PLAY:  '/werewolf/play',

  // 其它并列模块
  CHORDS: '/chords',
  STOCK:  '/stock',
  BLOG:   '/blog',
};

export const AUTH_PATHS = new Set([ROUTES.LOGIN, ROUTES.RESET, ROUTES.VERIFY]);

/**
 * 旧路径 → 新路径。Router 在解析时先查这里，若命中则 replaceState 到新路径。
 */
export const LEGACY_PATH_MAP = {
  '/home':            ROUTES.HOME,
  '/wolfgame':        ROUTES.WEREWOLF,
  '/wolfgame/custom': ROUTES.WEREWOLF_SETUP,
  '/wolfgame/play':   ROUTES.WEREWOLF_PLAY,
  '/sites':           ROUTES.HOME,
};

export function normalizePath(path = '') {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function resolveLegacyPath(path) {
  const normalized = normalizePath(path);
  return LEGACY_PATH_MAP[normalized] ?? null;
}
