/**
 * 导航守卫 — 给定 route + 认证状态，决定允许渲染还是重定向。
 *
 * 从 useAppRouter 的混合逻辑中抽出的纯函数，便于单测与复用。
 */

import { ROUTES, AUTH_PATHS } from './paths';

/**
 * @param {object} args
 * @param {object|null} args.route     匹配到的 route descriptor（requiresAuth/...）
 * @param {boolean} args.isAuthed      用户已登录 or 游客模式
 * @param {string}  args.normalizedPath 当前归一化路径
 * @returns {{kind: 'render'} | {kind: 'redirect', to: string, replace: boolean}}
 */
export function resolveNavigation({ route, isAuthed, normalizedPath }) {
  // 未知路径 → 回首页
  if (!route) {
    return { kind: 'redirect', to: ROUTES.HOME, replace: true };
  }

  // 需要鉴权但未登录 → 跳登录
  if (route.requiresAuth && !isAuthed) {
    return { kind: 'redirect', to: ROUTES.LOGIN, replace: true };
  }

  // 已登录但访问认证页 → 回首页
  if (isAuthed && AUTH_PATHS.has(normalizedPath)) {
    return { kind: 'redirect', to: ROUTES.HOME, replace: true };
  }

  return { kind: 'render' };
}
