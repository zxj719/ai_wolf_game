import { useState, useEffect, useCallback } from 'react';

export const ROUTES = {
  LOGIN: '/login',
  HOME: '/home',
  WOLFGAME: '/wolfgame',
  CUSTOM: '/wolfgame/custom',
  PLAY: '/wolfgame/play',
  SITES: '/sites',
  RESET: '/reset-password',
  VERIFY: '/verify-email'
};

const AUTH_ROUTES = new Set([ROUTES.LOGIN, ROUTES.RESET, ROUTES.VERIFY]);
const PUBLIC_ROUTES = new Set([ROUTES.HOME, ROUTES.WOLFGAME, ROUTES.SITES, ...AUTH_ROUTES]);
const PRIVATE_ROUTES = new Set([ROUTES.CUSTOM, ROUTES.PLAY]);
const APP_ROUTES = new Set([...PUBLIC_ROUTES, ...PRIVATE_ROUTES]);

export function normalizePath(path = '') {
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

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
  const isWolfgameRoute = normalizedPath === ROUTES.WOLFGAME;
  const isCustomRoute = normalizedPath === ROUTES.CUSTOM;
  const isPlayRoute = normalizedPath === ROUTES.PLAY;
  const isSitesRoute = normalizedPath === ROUTES.SITES;
  const isAuthed = !!user || isGuestMode;

  useEffect(() => {
    if (normalizedPath === '/') {
      navigate(ROUTES.HOME, { replace: true });
      return;
    }

    if (!APP_ROUTES.has(normalizedPath)) {
      navigate(ROUTES.HOME, { replace: true });
      return;
    }

    if (!isAuthed && PRIVATE_ROUTES.has(normalizedPath)) {
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    if (isAuthed && isAuthRoute) {
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [isAuthed, isAuthRoute, navigate, normalizedPath]);

  useEffect(() => {
    if ((isHomeRoute || isWolfgameRoute || isSitesRoute) && isGameActive) {
      endGame();
    }
  }, [endGame, isGameActive, isHomeRoute, isSitesRoute, isWolfgameRoute]);

  useEffect(() => {
    if (gameMode && isCustomRoute) {
      navigate(ROUTES.PLAY, { replace: true });
    }
  }, [gameMode, isCustomRoute, navigate]);

  useEffect(() => {
    if (isPlayRoute && !gameMode && phase === 'setup') {
      navigate(ROUTES.CUSTOM, { replace: true });
    }
  }, [gameMode, isPlayRoute, navigate, phase]);

  return {
    navigate,
    currentPath,
    isAuthRoute,
    isHomeRoute,
    isWolfgameRoute,
    isCustomRoute,
    isPlayRoute,
    isSitesRoute,
    isAuthed,
  };
}
