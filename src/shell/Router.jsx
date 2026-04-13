import { Suspense, useMemo, useRef, useEffect } from 'react';
import modules, { findRoute } from './ModuleRegistry';
import { useShell } from './ShellContext';
import { ThemeScope } from './ThemeScope';
import { resolveNavigation } from './navGuards';
import { ROUTES } from './paths';
import { useDocumentMeta } from './useDocumentMeta';

function DefaultLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-ink-muted">
      Loading…
    </div>
  );
}

/**
 * Registry 驱动的路由器。
 *
 * 流程：
 *   1. 从 currentPath 解析出 { module, route }
 *   2. navGuards 判断要不要重定向（登录/未登录/匹配失败）
 *   3. 上一个 route 的 onLeave(ctx) 触发（用于狼人杀 endGame 这类清理）
 *   4. 渲染 <ThemeScope theme={module.theme}><Suspense>{Component}</Suspense></ThemeScope>
 *
 * Phase 2a：文件已就绪但未挂入 main.jsx。Phase 2b 再切换入口。
 */
export function Router({ authRoutes = [], homeRoute, fallback = <DefaultLoader /> }) {
  const { currentPath, user, isGuestMode, navigate, locale } = useShell();
  const isAuthed = Boolean(user) || isGuestMode;

  const match = useMemo(() => {
    const hit = findRoute(currentPath);
    if (hit) return hit;
    const auth = authRoutes.find((r) => r.path === currentPath);
    if (auth) return { module: null, route: auth };
    if (homeRoute && currentPath === ROUTES.HOME) {
      return { module: homeRoute.module ?? null, route: homeRoute };
    }
    return null;
  }, [currentPath, authRoutes, homeRoute]);

  // 守卫：决定渲染还是跳转
  const decision = resolveNavigation({
    route: match?.route ?? null,
    isAuthed,
    normalizedPath: currentPath,
  });

  useEffect(() => {
    if (decision.kind === 'redirect') {
      navigate(decision.to, { replace: decision.replace });
    }
  }, [decision, navigate]);

  // onLeave: 前一个 route 离场时调用（给 werewolf endGame 这类清理留口子）
  const prevRef = useRef(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev.route?.onLeave && prev.route !== match?.route) {
      try { prev.route.onLeave({ module: prev.module }); } catch (e) { /* swallow */ }
    }
    prevRef.current = match;
  }, [match]);

  // 元信息
  const localized = (field) => {
    if (!field) return undefined;
    if (typeof field === 'string') return field;
    return field[locale] ?? field.zh ?? field.en;
  };
  useDocumentMeta({
    title: localized(match?.module?.title),
    description: localized(match?.module?.blurb),
    pathname: currentPath,
  });

  if (decision.kind === 'redirect') return fallback;
  if (!match) return fallback;

  const Component = match.route.component;
  const theme = match.module?.theme ?? 'light';

  return (
    <ThemeScope theme={theme} className="min-h-screen">
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </ThemeScope>
  );
}

export default Router;
