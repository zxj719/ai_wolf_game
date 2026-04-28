import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

const NovelWorkspace = lazy(() =>
  import('../../components/NovelWorkspace').then((m) => ({ default: m.NovelWorkspace }))
);

function Loader() {
  return (
    <div className="mac-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="mac-window px-8 py-6 text-sm text-slate-500">Loading...</div>
    </div>
  );
}

export default function NovelRoute() {
  const { navigate } = useShell();
  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <NovelWorkspace onBack={onBack} />
      </Suspense>
    </div>
  );
}
