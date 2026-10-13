import { lazy, Suspense } from 'react';
import { useShell } from './ShellContext';
import { LanguageToggle } from '../components/LanguageToggle';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { getUiCopy } from '../i18n/locale.js';
import { ROUTES } from './paths';

// 全站约战邀请（首页 / 小游戏 / 聊天页）；懒加载，不进主包
const GameInviteListener = lazy(() => import('../modules/games/duel/GameInviteListener'));

/**
 * 全局浮层 — 跨模块可见的 LanguageToggle（仅首页）+ 好友约战邀请通知。
 *
 * TokenManager / UserStats 暂时留在 WerewolfModule 内部（它们唯一的消费者是
 * 狼人杀 setup 页）。后续若有别的模块需要，再抽入这里并把 verifyModelscopeToken
 * 的触发也挪上来。
 *
 * 狼人杀 setup/play 路径有自己的 routeToolbar 已经包含了 LanguageToggle，
 * 这里在那两个路径上不再渲染语言浮层，避免 `.mac-floating-toolbar` 双元素重叠。
 */
export function GlobalOverlays() {
  const { locale, setLocale, currentPath, themePref, setThemePref, user } = useShell();
  const ui = getUiCopy(locale);
  const label = ui?.app?.localeLabel ?? (locale === 'zh' ? '界面语言' : 'Interface language');

  return (
    <>
      {currentPath === ROUTES.HOME && (
        <div className="mac-floating-toolbar">
          <ThemeToggle pref={themePref} onChange={setThemePref} locale={locale} />
          <LanguageToggle locale={locale} onChange={setLocale} label={label} />
        </div>
      )}
      {user && (
        <Suspense fallback={null}>
          <GameInviteListener />
        </Suspense>
      )}
    </>
  );
}

export default GlobalOverlays;
