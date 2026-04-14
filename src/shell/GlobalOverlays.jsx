import { useShell } from './ShellContext';
import { LanguageToggle } from '../components/LanguageToggle';
import { getUiCopy } from '../i18n/locale.js';
import { ROUTES } from './paths';

/**
 * 全局浮层 — 当前仅负责跨模块可见的 LanguageToggle。
 *
 * TokenManager / UserStats 暂时留在 WerewolfModule 内部（它们唯一的消费者是
 * 狼人杀 setup 页）。后续若有别的模块需要，再抽入这里并把 verifyModelscopeToken
 * 的触发也挪上来。
 *
 * 狼人杀 setup/play 路径有自己的 routeToolbar 已经包含了 LanguageToggle，
 * 这里在那两个路径上不再渲染语言浮层，避免 `.mac-floating-toolbar` 双元素重叠。
 */
export function GlobalOverlays() {
  const { locale, setLocale, currentPath } = useShell();
  const ui = getUiCopy(locale);
  const label = ui?.app?.localeLabel ?? (locale === 'zh' ? '界面语言' : 'Interface language');

  const suppressLocaleOverlay =
    currentPath === ROUTES.WEREWOLF_SETUP || currentPath === ROUTES.WEREWOLF_PLAY;
  if (suppressLocaleOverlay) return null;

  return (
    <div className="mac-floating-toolbar">
      <LanguageToggle locale={locale} onChange={setLocale} label={label} />
    </div>
  );
}

export default GlobalOverlays;
