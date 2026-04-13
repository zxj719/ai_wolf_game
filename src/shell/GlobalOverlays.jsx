import { Suspense, lazy } from 'react';
import { useShell } from './ShellContext';
import { LanguageToggle } from '../components/LanguageToggle';
import { getUiCopy } from '../i18n/locale.js';

const TokenManager = lazy(() =>
  import('../components/TokenManager').then((m) => ({ default: m.TokenManager }))
);
const UserStats = lazy(() =>
  import('../components/UserStats').then((m) => ({ default: m.UserStats }))
);

/**
 * 全局浮层集合 — 跨模块可见的 UI：语言切换 + TokenManager + UserStats。
 *
 * 模块内部通过 useShell().openTokenManager() 唤起，不直接依赖这些组件；
 * 这样 TokenManager 的实现（例如换成 Modal 原语）不会波及任何模块。
 */
export function GlobalOverlays() {
  const {
    locale,
    setLocale,
    showTokenManager,
    closeTokenManager,
    showStats,
    closeStats,
  } = useShell();

  const ui = getUiCopy(locale);
  const label = ui?.app?.localeLabel ?? (locale === 'zh' ? '界面语言' : 'Interface language');

  return (
    <>
      <div className="mac-floating-toolbar">
        <LanguageToggle locale={locale} onChange={setLocale} label={label} />
      </div>

      {showTokenManager && (
        <Suspense fallback={null}>
          <TokenManager onClose={closeTokenManager} />
        </Suspense>
      )}

      {showStats && (
        <Suspense fallback={null}>
          <UserStats onClose={closeStats} />
        </Suspense>
      )}
    </>
  );
}

export default GlobalOverlays;
