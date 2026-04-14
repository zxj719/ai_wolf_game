import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthNav } from '../../shell/useAuthNav';

const AuthPage = lazy(() =>
  import('../../components/Auth').then((m) => ({ default: m.AuthPage }))
);

function Loader() {
  return <div className="min-h-screen bg-bg text-ink-muted flex items-center justify-center">Loading…</div>;
}

/**
 * Auth 路由 — 登录 / 重置密码 / 邮箱验证 的统一入口。
 *
 * AuthPage 自身会根据 URL 决定渲染哪个子页（login / reset / verify），
 * 这里只负责把 Shell 能力桥接成它需要的 props。
 */
export default function AuthRoute() {
  const { locale, navigate, setIsGuestMode } = useShell();
  const { logout } = useAuth();
  const { enterGuestMode } = useAuthNav({ navigate, logout, setIsGuestMode });

  const onGuestPlay = useCallback(() => {
    enterGuestMode();
  }, [enterGuestMode]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <AuthPage onGuestPlay={onGuestPlay} locale={locale} />
      </Suspense>
    </div>
  );
}
