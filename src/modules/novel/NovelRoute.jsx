import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';
import { QueueGate } from '../../components/QueueGate';

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
  const onPreempted = useCallback(() => navigate(ROUTES.HOME, { replace: true }), [navigate]);

  return (
    <div className="mac-app-shell">
      {/* readOnly=true because only admin uses Codex (which would consume ECS).
          Admin bypasses queue anyway. Non-admins are read-only browsers, so no
          lock is needed — this lets guests and regular users open the workspace. */}
      <QueueGate resource="novel" onPreempted={onPreempted} readOnly>
        <Suspense fallback={<Loader />}>
          <NovelWorkspace onBack={onBack} />
        </Suspense>
      </QueueGate>
    </div>
  );
}
