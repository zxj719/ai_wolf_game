import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

const ChordsPage = lazy(() =>
  import('../../components/ChordsPage').then((m) => ({ default: m.ChordsPage }))
);

function Loader() {
  return <div className="min-h-screen bg-bg text-ink-muted flex items-center justify-center">Loading…</div>;
}

export default function ChordsRoute() {
  const { locale, navigate } = useShell();
  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <ChordsPage onBack={onBack} locale={locale} />
      </Suspense>
    </div>
  );
}
