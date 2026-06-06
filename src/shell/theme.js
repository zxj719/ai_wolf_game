/**
 * 主题偏好解析与持久化。镜像 src/i18n/locale.js 的模式。
 *
 * 取值：
 *   themePref: 'light' | 'dark' | 'system'  —— 用户偏好，存 localStorage
 *   theme（解析后）: 'light' | 'dark'        —— 实际应用到 [data-theme]
 *
 * 优先级：用户显式(light/dark) > 模块默认 > 系统 prefers-color-scheme
 */
export const THEME_STORAGE_KEY = 'wolfgame-theme';
export const DEFAULT_THEME_PREF = 'system';
export const THEME_PREF_VALUES = ['light', 'dark', 'system'];

export function normalizeThemePref(pref) {
  return THEME_PREF_VALUES.includes(pref) ? pref : DEFAULT_THEME_PREF;
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme({ userPref, moduleDefault, systemTheme } = {}) {
  if (userPref === 'light' || userPref === 'dark') return userPref;
  if (moduleDefault === 'light' || moduleDefault === 'dark') return moduleDefault;
  return systemTheme === 'dark' ? 'dark' : 'light';
}

export function readStoredThemePref() {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_THEME_PREF;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return normalizeThemePref(stored);
}

export function writeStoredThemePref(pref) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemePref(pref));
}

/**
 * 把全局主题偏好同步到 <html data-theme>，与 index.html 的防 FOUC 脚本逻辑一致：
 * 仅显式 light/dark 写属性；'system' 移除属性（交回 :root / 模块默认）。
 * 供 ShellProvider 在 themePref 变化时调用，实现运行时即时切换（无需刷新）。
 */
export function applyDocumentThemePref(pref) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (pref === 'light' || pref === 'dark') {
    root.setAttribute('data-theme', pref);
  } else {
    root.removeAttribute('data-theme');
  }
}
