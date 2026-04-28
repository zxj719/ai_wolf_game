import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthNav } from '../../shell/useAuthNav';
import { ROUTES } from '../../shell/paths';

const Dashboard = lazy(() =>
  import('../../components/Dashboard').then((m) => ({ default: m.Dashboard }))
);

function HomeLoader() {
  return <div className="min-h-screen bg-bg text-ink-muted flex items-center justify-center">Loading…</div>;
}

/**
 * Home 路由 — Phase 3：暂时仍渲染旧 Dashboard；Phase 4 会换成
 * Registry 驱动的卡片墙 (modules/home/HomeModule.jsx)。
 *
 * 桥接层把 Shell 能力映射成 Dashboard 期望的 props。
 */
export default function HomeRoute() {
  const { locale, user, isGuestMode, setIsGuestMode, navigate } = useShell();
  const { logout } = useAuth();
  const { enterGuestMode, handleLogout } = useAuthNav({ navigate, logout, setIsGuestMode });

  const onEnterWolfgame = useCallback(() => {
    if (user || isGuestMode) {
      navigate(ROUTES.WEREWOLF_SETUP);
    } else {
      enterGuestMode();
      navigate(ROUTES.WEREWOLF_SETUP);
    }
  }, [user, isGuestMode, navigate, enterGuestMode]);

  const onEnterSites = useCallback(() => navigate(ROUTES.SITES), [navigate]);
  const onEnterNovel = useCallback(() => navigate(ROUTES.NOVEL), [navigate]);
  const onLogin = useCallback(() => {
    if (isGuestMode) {
      setIsGuestMode(false);
      navigate(ROUTES.LOGIN, { replace: true });
    } else {
      navigate(ROUTES.LOGIN);
    }
  }, [isGuestMode, navigate, setIsGuestMode]);

  const onGuestPlay = useCallback(() => {
    enterGuestMode();
  }, [enterGuestMode]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<HomeLoader />}>
        <Dashboard
          locale={locale}
          onEnterWolfgame={onEnterWolfgame}
          onEnterSites={onEnterSites}
          onEnterNovel={onEnterNovel}
          onLogout={handleLogout}
          isGuestMode={isGuestMode}
          onLogin={onLogin}
          onGuestPlay={onGuestPlay}
        />
      </Suspense>
    </div>
  );
}
