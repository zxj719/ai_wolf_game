import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

const SitesPage = lazy(() =>
  import('../../components/SitesPage').then((m) => ({ default: m.SitesPage }))
);

function Loader() {
  return <div className="min-h-screen bg-bg text-ink-muted flex items-center justify-center">Loading…</div>;
}

/**
 * Sites 路由 — Phase 3 过渡封装。
 *
 * 继续复用 SitesPage 的内部切换器（chords/stock/static）。Phase 4 把它
 * 拆成 chords/stock/blog 三个独立模块，该文件同期删除。
 */
export default function SitesRoute() {
  const { locale, navigate } = useShell();
  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <SitesPage onBack={onBack} locale={locale} />
      </Suspense>
    </div>
  );
}
