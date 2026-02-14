import { useState, useEffect, useCallback } from 'react';

export const ROUTES = {
  LOGIN: '/login',
  HOME: '/home',
  CUSTOM: '/wolfgame/custom',
  PLAY: '/wolfgame/play',
  SITES: '/sites',
  RESET: '/reset-password',
  VERIFY: '/verify-email'
};

const AUTH_ROUTES = new Set([ROUTES.LOGIN, ROUTES.RESET, ROUTES.VERIFY]);
const APP_ROUTES = new Set([ROUTES.HOME, ROUTES.SITES, ROUTES.CUSTOM, ROUTES.PLAY]);

export function normalizePath(path = '') {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * useAppRouter - 管理应用路由和导航
 */
export function useAppRouter({ user, isGuestMode, isGameActive, endGame, gameMode, phase }) {
  const [currentPath, setCurrentPath] = useState(() => normalizePath(window.location.pathname));

  const navigate = useCallback((path, { replace = false } = {}) => {
    const nextPath = normalizePath(path);
    const current = normalizePath(window.location.pathname);
    if (nextPath === current && !replace) {
      setCurrentPath(nextPath);
      return;
    }
    if (replace) {
      window.history.replaceState({}, '', nextPath);
    } else {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentPath(nextPath);
  }, []);

  // popstate 监听
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const normalizedPath = normalizePath(currentPath);
  const isAuthRoute = AUTH_ROUTES.has(normalizedPath);
  const isHomeRoute = normalizedPath === ROUTES.HOME;
  const isCustomRoute = normalizedPath === ROUTES.CUSTOM;
  const isPlayRoute = normalizedPath === ROUTES.PLAY;
  const isSitesRoute = normalizedPath === ROUTES.SITES;
  const isAuthed = !!user || isGuestMode;

  // 认证路由重定向
  useEffect(() => {
    if (!isAuthed) {
      if (!isAuthRoute) {
        navigate(ROUTES.LOGIN, { replace: true });
      }
      return;
    }
    if (normalizedPath === '/' || isAuthRoute) {
      navigate(ROUTES.HOME, { replace: true });
      return;
    }
    if (!APP_ROUTES.has(normalizedPath)) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [isAuthed, normalizedPath, isAuthRoute]);

  // 返回首页/站点时自动结束游戏
  useEffect(() => {
    if ((isHomeRoute || isSitesRoute) && isGameActive) {
      endGame();
    }
  }, [isHomeRoute, isSitesRoute, isGameActive]);

  // gameMode 设置后跳转到 play
  useEffect(() => {
    if (gameMode && isCustomRoute) {
      navigate(ROUTES.PLAY, { replace: true });
    }
  }, [gameMode, isCustomRoute]);

  // 无 gameMode 时回到 custom
  useEffect(() => {
    if (isPlayRoute && !gameMode && phase === 'setup') {
      navigate(ROUTES.CUSTOM, { replace: true });
    }
  }, [isPlayRoute, gameMode, phase]);

  return {
    navigate,
    currentPath,
    isAuthRoute,
    isHomeRoute,
    isCustomRoute,
    isPlayRoute,
    isSitesRoute,
    isAuthed,
  };
}
