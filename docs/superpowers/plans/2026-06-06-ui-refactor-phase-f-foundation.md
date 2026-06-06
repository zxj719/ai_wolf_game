# UI 重构 Phase F（地基）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立全站统一的设计系统地基——修订 token、加全局明暗切换（用户偏好 > 模块默认 > 系统）、让所有 `.mac-*` 组件自动适配双主题、防 FOUC——为后续逐模块打磨（M1–M4）铺好可复用基座，零功能回归。

**Architecture:** 新增纯函数 `resolveTheme()` 与持久化 helper（镜像现有 `i18n/locale.js` 模式）；`ShellProvider` 持有 `themePref` 跨模块状态（镜像 `locale`）；`Router` 用 `resolveTheme` 取代裸 `module.theme`；`ThemeToggle` 挂进 `GlobalOverlays`；`tokens.css` + `legacy-mac.css` 增加 `[data-theme="dark"]` 覆盖，使旧 `.mac-*` 类无需改 JSX 即随主题切换；`index.html` 内联脚本在 React 挂载前设 `<html data-theme>` 防闪烁。

**Tech Stack:** React 18 · Vite 5 · TailwindCSS v3.3 · Vitest（jsdom, globals）· CSS 自定义属性双主题。

**参考规范：** [docs/superpowers/specs/2026-06-06-ui-refactor-taste-skill-design.md](../specs/2026-06-06-ui-refactor-taste-skill-design.md)

---

## 关键约定（先读）

- 存储 key：`wolfgame-theme`（与 `wolfgame-locale` 同前缀）。取值 `'light' | 'dark' | 'system'`，默认 `'system'`。
- 解析优先级：**用户显式偏好（light/dark）> 模块默认主题 > 系统 `prefers-color-scheme`**。`'system'` 偏好表示「不显式」，因此落到模块默认。
- 每个 Task 末尾 `npm run build` 必须通过（含 `scripts/check-build.mjs` 守门）。
- 不改任何业务逻辑、不动游戏状态机、不碰后端。

---

## Task 1: 主题解析与持久化 helper（TDD）

**Files:**
- Create: `src/shell/theme.js`
- Test: `src/shell/__tests__/theme.test.js`

- [ ] **Step 1: 写失败测试**

Create `src/shell/__tests__/theme.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  DEFAULT_THEME_PREF,
  normalizeThemePref,
  readStoredThemePref,
  writeStoredThemePref,
  resolveTheme,
} from '../theme.js';

describe('normalizeThemePref', () => {
  it('keeps valid prefs', () => {
    expect(normalizeThemePref('light')).toBe('light');
    expect(normalizeThemePref('dark')).toBe('dark');
    expect(normalizeThemePref('system')).toBe('system');
  });
  it('falls back to default for junk', () => {
    expect(normalizeThemePref('purple')).toBe(DEFAULT_THEME_PREF);
    expect(normalizeThemePref(null)).toBe(DEFAULT_THEME_PREF);
  });
});

describe('resolveTheme', () => {
  it('explicit user pref wins over module default', () => {
    expect(resolveTheme({ userPref: 'light', moduleDefault: 'dark' })).toBe('light');
    expect(resolveTheme({ userPref: 'dark', moduleDefault: 'light' })).toBe('dark');
  });
  it('system pref follows module default when present', () => {
    expect(resolveTheme({ userPref: 'system', moduleDefault: 'dark' })).toBe('dark');
    expect(resolveTheme({ userPref: 'system', moduleDefault: 'light' })).toBe('light');
  });
  it('falls back to systemTheme when no module default', () => {
    expect(resolveTheme({ userPref: 'system', moduleDefault: null, systemTheme: 'dark' })).toBe('dark');
    expect(resolveTheme({ userPref: 'system', moduleDefault: undefined, systemTheme: 'light' })).toBe('light');
  });
});

describe('storage round-trip', () => {
  beforeEach(() => window.localStorage.clear());
  it('reads default when empty', () => {
    expect(readStoredThemePref()).toBe(DEFAULT_THEME_PREF);
  });
  it('persists and reads back', () => {
    writeStoredThemePref('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredThemePref()).toBe('dark');
  });
  it('normalizes junk on read', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'banana');
    expect(readStoredThemePref()).toBe(DEFAULT_THEME_PREF);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/shell/__tests__/theme.test.js`
Expected: FAIL — `Failed to resolve import '../theme.js'`.

- [ ] **Step 3: 实现 `src/shell/theme.js`**

```js
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/shell/__tests__/theme.test.js`
Expected: PASS（全部用例绿）。

- [ ] **Step 5: 提交**

```bash
git add src/shell/theme.js src/shell/__tests__/theme.test.js
git commit -m "feat(theme): resolveTheme + 偏好持久化 helper (Phase F)"
```

---

## Task 2: ShellProvider 注入主题偏好状态

**Files:**
- Modify: `src/shell/ShellProvider.jsx`

镜像现有 `locale` 的写法（state + 持久化 effect + storage 同步 + 暴露进 context）。

- [ ] **Step 1: 引入 theme helper**

在 `src/shell/ShellProvider.jsx` 顶部 import 区（locale import 下一行）追加：

```jsx
import { THEME_STORAGE_KEY, readStoredThemePref, writeStoredThemePref, normalizeThemePref } from './theme.js';
```

- [ ] **Step 2: 加 state（在 `const [locale, setLocaleState] = ...` 之后）**

```jsx
  const [themePref, setThemePrefState] = useState(() => readStoredThemePref());
```

- [ ] **Step 3: 持久化 + setter（在 `setLocale` 定义之后追加）**

```jsx
  useEffect(() => {
    writeStoredThemePref(themePref);
  }, [themePref]);

  const setThemePref = useCallback((next) => {
    setThemePrefState(normalizeThemePref(next));
  }, []);
```

- [ ] **Step 4: 跨标签页同步（在 locale 的 storage effect 之后追加）**

```jsx
  useEffect(() => {
    const onThemeStorage = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemePrefState(normalizeThemePref(event.newValue));
    };
    window.addEventListener('storage', onThemeStorage);
    return () => window.removeEventListener('storage', onThemeStorage);
  }, []);
```

- [ ] **Step 5: 暴露进 context value**

在 `value` 的 `useMemo` 对象里，`setLocale,` 之后加 `themePref,` 与 `setThemePref,`；并把这两个加入依赖数组：

```jsx
      // 国际化
      locale,
      setLocale,
      // 主题
      themePref,
      setThemePref,
```

依赖数组（`[ user, isGuestMode, locale, setLocale, ... ]`）加入 `themePref, setThemePref,`。

- [ ] **Step 6: 验证构建**

Run: `npm run build`
Expected: 构建通过，无报错。

- [ ] **Step 7: 提交**

```bash
git add src/shell/ShellProvider.jsx
git commit -m "feat(theme): ShellProvider 持有 themePref 跨模块状态 (Phase F)"
```

---

## Task 3: Router 用 resolveTheme 取代裸 module.theme

**Files:**
- Modify: `src/shell/Router.jsx`

- [ ] **Step 1: import**

在 `src/shell/Router.jsx` 顶部追加：

```jsx
import { resolveTheme, getSystemTheme } from './theme.js';
```

- [ ] **Step 2: 从 useShell 取 themePref**

把 `const { currentPath, user, isGuestMode, navigate, locale } = useShell();`
改为：

```jsx
  const { currentPath, user, isGuestMode, navigate, locale, themePref } = useShell();
```

- [ ] **Step 3: 解析 theme**

把 `const theme = match.module?.theme ?? 'light';`（约 82 行）改为：

```jsx
  const theme = resolveTheme({
    userPref: themePref,
    moduleDefault: match.module?.theme ?? null,
    systemTheme: getSystemTheme(),
  });
```

- [ ] **Step 4: 验证构建**

Run: `npm run build`
Expected: 通过。

- [ ] **Step 5: 提交**

```bash
git add src/shell/Router.jsx
git commit -m "feat(theme): Router 按偏好解析主题 (Phase F)"
```

---

## Task 4: ThemeToggle 组件（TDD）+ 挂入 GlobalOverlays

**Files:**
- Create: `src/components/ThemeToggle.jsx`
- Test: `src/components/__tests__/themeToggle.test.jsx`
- Modify: `src/shell/GlobalOverlays.jsx`

行为：三态循环 `system → light → dark → system`，显示当前态图标，点击调用 `onChange(next)`。

- [ ] **Step 1: 写失败测试**

> 注：本项目**未安装** `@testing-library`。现有测试（如 `startFlow.test.jsx`）用原生 `react-dom/client` `createRoot` + React `act`。本测试沿用同一模式，不引入新依赖。

Create `src/components/__tests__/themeToggle.test.jsx`:

```jsx
import React, { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ThemeToggle } from '../ThemeToggle.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(ui); });
  return {
    button: () => container.querySelector('button'),
    unmount() { act(() => root.unmount()); container.remove(); },
  };
}

describe('ThemeToggle', () => {
  it('reflects current pref via data-pref', () => {
    const h = mount(<ThemeToggle pref="dark" onChange={() => {}} />);
    expect(h.button().getAttribute('data-pref')).toBe('dark');
    h.unmount();
  });

  it('cycles system -> light -> dark -> system on click', () => {
    for (const [pref, next] of [['system', 'light'], ['light', 'dark'], ['dark', 'system']]) {
      const onChange = vi.fn();
      const h = mount(<ThemeToggle pref={pref} onChange={onChange} />);
      act(() => { h.button().click(); });
      expect(onChange).toHaveBeenCalledWith(next);
      h.unmount();
    }
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node node_modules/vitest/vitest.mjs run src/components/__tests__/themeToggle.test.jsx`
Expected: FAIL — 无法解析 `../ThemeToggle.jsx`。

- [ ] **Step 3: 实现 `src/components/ThemeToggle.jsx`**

```jsx
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
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}

export default ThemeToggle;
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node node_modules/vitest/vitest.mjs run src/components/__tests__/themeToggle.test.jsx`
Expected: PASS。

- [ ] **Step 5: 挂入 GlobalOverlays**

在 `src/shell/GlobalOverlays.jsx`：import 区加 `import { ThemeToggle } from '../components/ThemeToggle.jsx';`；从 `useShell()` 解构追加 `themePref, setThemePref`；在返回的 `.mac-floating-toolbar` 里 `<LanguageToggle .../>` 之前加：

```jsx
      <ThemeToggle pref={themePref} onChange={setThemePref} locale={locale} />
```

修改后该 return 块：

```jsx
  return (
    <div className="mac-floating-toolbar">
      <ThemeToggle pref={themePref} onChange={setThemePref} locale={locale} />
      <LanguageToggle locale={locale} onChange={setLocale} label={label} />
    </div>
  );
```

并把解构行改为：

```jsx
  const { locale, setLocale, currentPath, themePref, setThemePref } = useShell();
```

- [ ] **Step 6: 验证构建 + 全量测试**

Run: `npm run build && node node_modules/vitest/vitest.mjs run`
Expected: 构建通过；测试全绿。

- [ ] **Step 7: 提交**

```bash
git add src/components/ThemeToggle.jsx src/components/__tests__/themeToggle.test.jsx src/shell/GlobalOverlays.jsx
git commit -m "feat(theme): ThemeToggle 三态切换 + 挂入 GlobalOverlays (Phase F)"
```

---

## Task 5: 防 FOUC —— 内联脚本在 React 挂载前设 `<html data-theme>`

**Files:**
- Modify: `index.html`

原理：用户全局偏好为 light/dark 时，在首帧前把 `data-theme` 写到 `<html>`，使页面级 `var(--bg)` 立即正确，消除白屏闪烁。`system` 偏好不写（交给模块默认，由 ThemeScope 在 React 内处理）。

- [ ] **Step 1: 在 `<head>` 末尾（`</head>` 之前）插入内联脚本**

```html
    <script>
      // 防 FOUC：仅当用户显式选了 light/dark 时提前置于 <html>。
      // 与 src/shell/theme.js 的 THEME_STORAGE_KEY='wolfgame-theme' 保持一致。
      (function () {
        try {
          var p = localStorage.getItem('wolfgame-theme');
          if (p === 'light' || p === 'dark') {
            document.documentElement.setAttribute('data-theme', p);
          }
        } catch (e) {}
      })();
    </script>
```

- [ ] **Step 2: 验证脚本无语法错误（构建会内联到 prod HTML）**

Run: `npm run build`
Expected: 通过。`index.html` 经 Vite 处理无报错。

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat(theme): 内联脚本防 FOUC (Phase F)"
```

> 注：`scripts/inject-html.mjs` 在部署时读取 `index.html` 注入 Worker，本脚本会随之带入生产。无需改 inject 脚本。

---

## Task 6: tokens.css 修订 + tailwind 圆角档位

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `tailwind.config.js`

落地规范 4.1/4.2：off-black 凹陷面、market 涨跌色、阴影染背景色调、`rounded-input` 档位。

- [ ] **Step 1: 修订 `src/styles/tokens.css` 的 light 块**

把 light 块（`:root,[data-theme="light"]`）中：
- `--bg-sunken: #e5e7eb;` 保持。
- 在 `--warning: #f59e0b;` 之后追加 market 语义色：

```css
  /* 市场语义（A股：红涨绿跌）—— 与 UI 语义色解耦，仅股票模块使用 */
  --market-up:   #ef4444;
  --market-down: #10b981;
```

- 把阴影改为染蓝微调：

```css
  --shadow-card: 0 1px 2px rgb(10 36 64 / 0.06), 0 0 0 1px rgb(10 36 64 / 0.04);
  --shadow-pop:  0 20px 48px rgb(10 36 64 / 0.12);
```

- [ ] **Step 2: 修订 dark 块（`[data-theme="dark"]`）**

- 把 `--bg-sunken: #000000;` 改为 `--bg-sunken: #050506;`（禁止纯黑）。
- 在 `--warning: #f59e0b;` 之后追加：

```css
  --market-up:   #f87171;
  --market-down: #34d399;
```

- 把阴影改为染暖微调：

```css
  --shadow-card: 0 1px 2px rgb(20 12 0 / 0.5), 0 0 0 1px rgb(255 255 255 / 0.04);
  --shadow-pop:  0 24px 56px rgb(0 0 0 / 0.65);
```

- 在圆角段（若 dark 块没有则在 light 块）确认存在 `--radius-input`。在 light 块的 `--radius-button: 10px;` 之后加：

```css
  --radius-input:  8px;
```

- [ ] **Step 2b: 把 light 块同样补 `--radius-input`（若上一步加在 dark 块需对齐）**

确保 `--radius-input: 8px;` 在 light 块（`:root,[data-theme="light"]`）出现一次。dark 块继承同值，无需重复（圆角不随主题变）。

- [ ] **Step 3: tailwind.config.js 增 `input` 圆角 + market 颜色**

在 `borderRadius` 对象（已有 `card`/`button`）加：

```js
        input:  'var(--radius-input)',
        pill:   'var(--radius-pill)',
```

在 `colors` 对象加 market 命名空间（在 `warning` 之后）：

```js
        market: {
          up:   'var(--market-up)',
          down: 'var(--market-down)',
        },
```

- [ ] **Step 4: 验证构建**

Run: `npm run build`
Expected: 通过。`grep -n "market-up" dist/assets/*.css` 应能在产物中找到（确认 token 生效）。

- [ ] **Step 5: 提交**

```bash
git add src/styles/tokens.css tailwind.config.js
git commit -m "feat(tokens): off-black 凹陷面 + market 涨跌色 + 染色阴影 + rounded-input (Phase F)"
```

---

## Task 7: legacy-mac.css 双主题化（核心杠杆）+ base.css 防闪

**Files:**
- Modify: `src/styles/legacy-mac.css`
- Modify: `src/styles/base.css`

目标：旧 `.mac-*` 组件**不改 JSX** 即随 `[data-theme]` 切换。手法：把 `:root` 里的 `--mac-*`/`--homepage-*` 变量加一份 `[data-theme="dark"]` 覆盖；并把 `.mac-*` 规则里**硬编码**的 `rgba(15,23,42,…)` / `rgba(255,255,255,…)` 改为引用变量。

- [ ] **Step 1: 在 legacy-mac.css 的 `@layer base` 内、`:root{...}` 之后追加 dark 覆盖**

```css
  [data-theme="dark"] {
    --homepage-bg: #09090b;
    --homepage-ink: #fafafa;
    --homepage-paper: rgba(24, 24, 27, 0.84);
    --homepage-line: rgba(255, 255, 255, 0.08);
    --homepage-shadow: rgba(0, 0, 0, 0.5);

    --mac-ink: #fafafa;
    --mac-muted: #a1a1aa;
    --mac-line: rgba(255, 255, 255, 0.10);
    --mac-surface: rgba(24, 24, 27, 0.80);
    --mac-surface-strong: rgba(24, 24, 27, 0.92);
    --mac-panel: rgba(24, 24, 27, 0.68);
    --mac-panel-strong: rgba(24, 24, 27, 0.88);
    --mac-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
    --mac-shadow-soft: 0 8px 24px rgba(0, 0, 0, 0.45);
    --mac-primary: #d97706;
    --mac-primary-strong: #b45309;
    --mac-accent: #d97706;
    --mac-success: #34d399;
    --mac-danger: #f87171;
  }
```

- [ ] **Step 2: 新增三个变量到 light `:root`（供下面替换硬编码用）**

在 legacy-mac.css 的 light `:root` 块末尾（`--mac-danger` 之后）加：

```css
    --mac-line-soft: rgba(15, 23, 42, 0.06);
    --mac-surface-faint: rgba(255, 255, 255, 0.58);
    --mac-placeholder: #98a2b3;
    --mac-segment-active-bg: rgba(17, 24, 39, 0.88);
```

并在 Step 1 的 dark 块追加对应值：

```css
    --mac-line-soft: rgba(255, 255, 255, 0.07);
    --mac-surface-faint: rgba(24, 24, 27, 0.50);
    --mac-placeholder: #71717a;
    --mac-segment-active-bg: rgba(250, 250, 250, 0.92);
```

- [ ] **Step 3: 把 `.mac-*` 规则中的硬编码替换为变量**

在 `@layer components` 内逐处替换（仅改色值，不改布局）：

- `.mac-panel` 的 `border: 1px solid rgba(15, 23, 42, 0.06);` → `border: 1px solid var(--mac-line-soft);`
- `.mac-toolbar` 的 `border-bottom: 1px solid rgba(15, 23, 42, 0.06);` → `border-bottom: 1px solid var(--mac-line-soft);`
- `.mac-eyebrow` 的 `color: #6b7280;` → `color: var(--mac-muted);`
- `.mac-badge`：`background: rgba(255,255,255,0.72);` → `background: var(--mac-surface);`；`border: 1px solid rgba(15,23,42,0.06);` → `border: 1px solid var(--mac-line-soft);`；`color: #475467;` → `color: var(--mac-muted);`
- `.mac-button-secondary`：`background: rgba(255,255,255,0.72);` → `background: var(--mac-surface);`；`border-color: rgba(15,23,42,0.08);` → `border-color: var(--mac-line);`
- `.mac-button-ghost`：`background: rgba(255,255,255,0.46);` → `background: var(--mac-surface-faint);`；`border-color: rgba(15,23,42,0.05);` → `border-color: var(--mac-line-soft);`；`color: #667085;` → `color: var(--mac-muted);`
- `.mac-input, .mac-textarea, .mac-select`：`background: rgba(255,255,255,0.9);` → `background: var(--mac-surface-strong);`；`border: 1px solid rgba(15,23,42,0.08);` → `border: 1px solid var(--mac-line);`；`box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);` → 删除该 inset 高光行（深色下泛白）。
- `.mac-input::placeholder, .mac-textarea::placeholder`：`color: #98a2b3;` → `color: var(--mac-placeholder);`
- `.mac-icon-tile`：`background: rgba(255,255,255,0.78);` → `background: var(--mac-surface);`；`border: 1px solid rgba(15,23,42,0.06);` → `border: 1px solid var(--mac-line-soft);`；`color: #344054;` → `color: var(--mac-ink);`
- `.mac-list-row`：`border: 1px solid rgba(15,23,42,0.06);` → `border: 1px solid var(--mac-line-soft);`
- `.mac-muted-card`：`background: rgba(255,255,255,0.58);` → `background: var(--mac-surface-faint);`；`border: 1px solid rgba(15,23,42,0.05);` → `border: 1px solid var(--mac-line-soft);`
- `.mac-segmented-control`：`background: rgba(255,255,255,0.74);` → `background: var(--mac-surface);`；`border: 1px solid rgba(15,23,42,0.06);` → `border: 1px solid var(--mac-line-soft);`
- `.mac-segment.is-active`：`background: rgba(17,24,39,0.88);` → `background: var(--mac-segment-active-bg);`；`color: white;` → `color: var(--homepage-bg);`
- `.mac-app-shell` 的 `@apply ... text-slate-900;` → 改为 `@apply relative min-h-screen;` 并新增一行 `color: var(--mac-ink);`（去掉写死的 slate-900）。

> macOS 红黄绿圆点（`.mac-dot-*`）保持硬编码——它们是拟物窗口装饰，双主题都该是原色。

- [ ] **Step 4: base.css —— 页面底色随主题、装饰渐变仅浅色**

在 `src/styles/base.css` 的 `@layer base` 中：

把 `html { background: var(--homepage-bg); }` 改为：

```css
  html {
    background-color: var(--bg);
  }
```

把 `body { background: <三层渐变>; color: var(--mac-ink); ... }` 改为：装饰渐变仅在非深色时出现，深色用纯底色。替换为：

```css
  body {
    background-color: var(--bg);
    color: var(--mac-ink);
    font-family: var(--font-sans);
  }

  html:not([data-theme="dark"]) body {
    background:
      radial-gradient(circle at top center, rgba(255, 255, 255, 0.92), transparent 42%),
      radial-gradient(circle at bottom left, rgba(225, 229, 237, 0.6), transparent 28%),
      linear-gradient(180deg, #f7f7f8 0%, #eff1f4 100%);
  }
```

并把 `body::before { background: rgba(255,255,255,0.8); }` 与 `body::after` 的两个发光球，用 `html:not([data-theme="dark"])` 前缀限定为仅浅色（深色下不显示白色光球）：把这两条规则的选择器从 `body::before`/`body::after` 改为 `html:not([data-theme="dark"]) body::before` / `html:not([data-theme="dark"]) body::after`。

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Expected: 通过，无 PostCSS/Tailwind `@apply` 报错。

- [ ] **Step 6: 提交**

```bash
git add src/styles/legacy-mac.css src/styles/base.css
git commit -m "feat(theme): legacy .mac-* 双主题化 + 页面底色随主题 (Phase F)"
```

---

## Task 8: src/ui 原语主题审计

**Files:**
- Inspect: `src/ui/Button.jsx` `Card.jsx` `Input.jsx` `Badge.jsx` `Modal.jsx` `PageShell.jsx` `Toolbar.jsx` `Spinner.jsx` `Skeleton.jsx`

确认 9 个原语只用 token 类（`bg-bg*` `text-ink*` `border-line*` `bg-accent*` `rounded-card/button/input/pill` `shadow-card/pop`），无硬编码 `zinc/slate/amber/indigo/blue` 与无 `rounded-[…]` 任意值。

- [ ] **Step 1: 扫描硬编码色与任意圆角**

Run（Git Bash）:
```bash
grep -rnE "(bg|text|border|ring)-(zinc|slate|amber|indigo|blue|emerald|rose|gray|red|green)-[0-9]|rounded-\[" src/ui/
```
Expected: 理想为空。每一处命中 → 记录文件:行。

- [ ] **Step 2: 修复命中项**

对每处命中按映射替换为 token 类：
- 中性背景 `bg-zinc-*/slate-*/gray-*` → `bg-bg` / `bg-bg-raised` / `bg-bg-sunken`
- 文字 `text-zinc-*/slate-*/gray-*` → `text-ink` / `text-ink-muted` / `text-ink-faint`
- 边框 `border-zinc-*/slate-*` → `border-line` / `border-line-strong`
- 强调 `bg-blue-*/indigo-*/amber-*` → `bg-accent` / `text-accent`
- 任意圆角 `rounded-[Npx]` → 最接近档位：`rounded-input`(8) / `rounded-button`(10) / `rounded-card`(16) / `rounded-pill`
若 Step 1 为空，跳过本步。

- [ ] **Step 3: 验证构建 + 测试**

Run: `npm run build && node node_modules/vitest/vitest.mjs run`
Expected: 通过、全绿。

- [ ] **Step 4: 提交（若有改动）**

```bash
git add src/ui/
git commit -m "refactor(ui): 原语 100% token 化审计 (Phase F)"
```
若无改动则跳过提交。

---

## Task 9: Phase F 验收（双主题 × 双视口）

**Files:** 无（验证 + 截图证据）

- [ ] **Step 1: 全量构建 + 测试 + 守门**

Run: `npm run build && node node_modules/vitest/vitest.mjs run`
Expected: 构建通过（`scripts/check-build.mjs` 无 localhost 泄漏）；测试全绿。

- [ ] **Step 2: 启动 dev 并用 /browse 截图双主题**

启动：`npm run dev`（端口 3000）。用 `/browse` 技能依次：
1. 打开 `http://localhost:3000/home`（默认浅色），截图 desktop(1440) 与 mobile(390)。
2. 点右上 ThemeToggle 两次切到 dark，刷新确认无 FOUC 白闪，截图 desktop 与 mobile。
3. 打开 `http://localhost:3000/werewolf`，确认默认仍是深色沉浸（模块默认）。
4. 全局切回 system，确认狼人杀深色、首页浅色。

Expected：首页/认证类 `.mac-*` 界面在 dark 下文字/边框/输入框对比度正常，无残留白底块；无主题倒错区块。

- [ ] **Step 3: 静态审计（地基不引入新违规）**

Run:
```bash
grep -rnE "rounded-\[" src/ui/ && echo "FAIL: ui 仍有任意圆角" || echo "OK: ui 圆角已档位化"
```
Expected: 打印 `OK`。

- [ ] **Step 4: 记录 CHANGELOG**

在 `CHANGELOG.md` 顶部加：

```markdown
## [2026-06-06] UI 重构 Phase F — 设计系统地基

### 新功能
- **全局明暗切换**: 用户偏好 > 模块默认 > 系统；偏好持久化、防 FOUC。
- **设计 token 修订**: off-black 凹陷面、market 涨跌色、染色阴影、rounded-input 档位。
- **legacy .mac-* 双主题化**: 旧组件无需改 JSX 即随主题切换。

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/shell/theme.js` | 新建 | resolveTheme + 偏好持久化 |
| `src/components/ThemeToggle.jsx` | 新建 | 三态切换组件 |
| `src/shell/ShellProvider.jsx` | 修改 | themePref 状态 |
| `src/shell/Router.jsx` | 修改 | 按偏好解析主题 |
| `src/shell/GlobalOverlays.jsx` | 修改 | 挂载 ThemeToggle |
| `index.html` | 修改 | 防 FOUC 内联脚本 |
| `src/styles/tokens.css` | 修改 | token 修订 |
| `src/styles/legacy-mac.css` | 修改 | 双主题变量 |
| `src/styles/base.css` | 修改 | 页面底色随主题 |
| `tailwind.config.js` | 修改 | rounded-input + market 色 |
```

- [ ] **Step 5: 提交**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog Phase F 设计系统地基"
```

---

## Phase F 完成判据（DoD）

- `npm run build` 与 `vitest run` 全绿。
- 全局 ThemeToggle 可在 system/light/dark 间切换并持久化；刷新无 FOUC。
- 狼人杀默认深色、生产力模块默认浅色；用户显式偏好覆盖全站。
- 首页/认证等 `.mac-*` 界面在深浅两主题下均无对比度/倒错问题。
- `src/ui/*` 与新增代码无硬编码品牌色、无 `rounded-[…]` 任意值。

## 不在 Phase F 范围（留给 M1–M4）

- 各业务组件（GameArena/Dashboard/Stock/…）内硬编码色 → token 的逐组件替换。
- 狼人杀手机端圆桌重做。
- 首页深色装饰层细化（当前深色用纯底色，足够通过验收；精修留 M2）。
- 股票模块 market 色接入与主题倒错修复（留 M4）。
- `.mac-*` → `<Button>/<Card>` 的 JSX codemod（Phase 5，本次明确不做）。
```

