import { useCallback, useMemo, useState, useEffect } from 'react';
import { ShellContext } from './ShellContext';
import { useAuth } from '../contexts/AuthContext';
import { readStoredLocale, writeStoredLocale } from '../i18n/locale.js';
import { createApiClient } from '../services/api/client';
import { getToken as getStoredAuthToken } from '../utils/authToken';
import { normalizePath, resolveLegacyPath } from './paths';

/**
 * ShellProvider — 汇总跨模块能力，向子树暴露 useShell()。
 *
 * 职责边界：
 *   - 持有 locale / isGuestMode / currentPath 等 *跨模块* 状态
 *   - 提供 navigate()、openTokenManager/Stats 这类动作
 *   - 通过 api(backendKey) 工厂提供已注入 auth 的 fetch 客户端
 *
 * 不负责：
 *   - 狼人杀 / 音乐 / 股市等模块内部的状态（留给各 Module 根）
 *   - 实际路由匹配与组件渲染（由 Router 完成）
 */
export function ShellProvider({ children }) {
  const auth = useAuth();
  const { user } = auth;

  const [locale, setLocaleState] = useState(() => readStoredLocale());
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const [currentPath, setCurrentPath] = useState(() => {
    const raw = normalizePath(window.location.pathname);
    return resolveLegacyPath(raw) ?? raw;
  });

  useEffect(() => {
    const onPopState = () => {
      const raw = normalizePath(window.location.pathname);
      const mapped = resolveLegacyPath(raw);
      if (mapped) {
        window.history.replaceState({}, '', mapped);
        setCurrentPath(mapped);
      } else {
        setCurrentPath(raw);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const setLocale = useCallback((next) => {
    writeStoredLocale(next);
    setLocaleState(next);
  }, []);

  const navigate = useCallback((path, { replace = false } = {}) => {
    const normalized = normalizePath(path);
    const mapped = resolveLegacyPath(normalized) ?? normalized;
    if (mapped === normalizePath(window.location.pathname)) {
      setCurrentPath(mapped);
      return;
    }
    const fn = replace ? 'replaceState' : 'pushState';
    window.history[fn]({}, '', mapped);
    setCurrentPath(mapped);
  }, []);

  const openTokenManager = useCallback(() => setShowTokenManager(true), []);
  const closeTokenManager = useCallback(() => setShowTokenManager(false), []);
  const openStats = useCallback(() => setShowStats(true), []);
  const closeStats = useCallback(() => setShowStats(false), []);

  const api = useCallback(
    (backendKey = 'cf-workers') =>
      createApiClient(backendKey, { getAuthToken: () => getStoredAuthToken() }),
    []
  );

  const value = useMemo(
    () => ({
      // 身份
      user,
      isGuestMode,
      setIsGuestMode,
      // 国际化
      locale,
      setLocale,
      // 路由
      currentPath,
      navigate,
      // 全局 overlay
      showTokenManager,
      showStats,
      openTokenManager,
      closeTokenManager,
      openStats,
      closeStats,
      // 后端
      api,
    }),
    [
      user,
      isGuestMode,
      locale,
      setLocale,
      currentPath,
      navigate,
      showTokenManager,
      showStats,
      openTokenManager,
      closeTokenManager,
      openStats,
      closeStats,
      api,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}
