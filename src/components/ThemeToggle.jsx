import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * 主题三态切换：system → light → dark → system。
 * 受控组件：pref 由 ShellProvider 提供，点击回调 onChange(next)。
 */
const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: Monitor, light: Sun, dark: Moon };
const LABEL = {
  system: { zh: '跟随系统', en: 'System' },
  light: { zh: '浅色', en: 'Light' },
  dark: { zh: '深色', en: 'Dark' },
};

export function ThemeToggle({ pref = 'system', onChange, locale = 'zh' }) {
  const Icon = ICON[pref] ?? Monitor;
  const label = (LABEL[pref] ?? LABEL.system)[locale === 'en' ? 'en' : 'zh'];
  return (
    <button
      type="button"
      data-pref={pref}
      aria-label={label}
      title={label}
      onClick={() => onChange?.(NEXT[pref] ?? 'system')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-button border border-line bg-bg-raised text-ink-muted shadow-card transition-colors duration-200 hover:text-ink hover:bg-bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.96]"
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

export default ThemeToggle;
