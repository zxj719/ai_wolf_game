import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

const BacktestTool = lazy(() =>
  import('../../components/BacktestTool').then((m) => ({ default: m.BacktestTool }))
);

function Loader() {
  return (
    <div className="mac-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="mac-window px-8 py-6 text-sm text-slate-500">Loading...</div>
    </div>
  );
}

export default function BacktestRoute() {
  const { navigate } = useShell();
  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <BacktestTool onBack={onBack} />
      </Suspense>
    </div>
  );
}
