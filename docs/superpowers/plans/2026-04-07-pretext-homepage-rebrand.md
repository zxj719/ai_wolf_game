# Pretext Homepage Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand `battle-web` into `Zhaxiaoji Studio`, make the React shell a personal homepage that still links into the werewolf game and other tools, and remove the werewolf leaderboard from the user-facing flow.

**Architecture:** Keep the werewolf game engine and existing `/wolfgame/*` flow intact. Rebuild the shell layer around it: make `/home` publicly accessible, redesign the dashboard into a personal landing page, refresh `/sites` into a lab/projects hub, and use `@chenglou/pretext` only where it brings real value: hero headline balancing and text-card layout on the homepage.

**Tech Stack:** React 18, Vite 5, TailwindCSS, manual history router, `@chenglou/pretext`

---

### Task 1: Add Pretext Foundation

**Files:**
- Modify: `package.json`
- Create: `src/hooks/useElementWidth.js`
- Create: `src/hooks/useBalancedHeadline.js`
- Create: `src/components/home/BalancedHeadline.jsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Add the dependency**

```json
{
  "dependencies": {
    "@chenglou/pretext": "^0.4.0"
  }
}
```

- [ ] **Step 2: Add a width observer hook for responsive text layout**

```js
import { useEffect, useRef, useState } from 'react';

export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(node);
    setWidth(Math.floor(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
```

- [ ] **Step 3: Add a pretext-powered balancing hook**

```js
import { useEffect, useMemo, useState } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

export function useBalancedHeadline(text, font, width, lineHeight) {
  const prepared = useMemo(() => {
    if (!text || !font) return null;
    return prepareWithSegments(text, font);
  }, [text, font]);

  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!prepared || width <= 0) {
      setLines([]);
      return;
    }
    const result = layoutWithLines(prepared, width, lineHeight);
    setLines(result.lines ?? []);
  }, [prepared, width, lineHeight]);

  return lines;
}
```

- [ ] **Step 4: Wrap the hook in a small reusable homepage component**

```jsx
export function BalancedHeadline({ text, className, lineClassName, font, lineHeight }) {
  // measure width
  // ask pretext for line strings
  // render each line in its own block/span
}
```

- [ ] **Step 5: Verify the new dependency and helper files compile**

Run: `npm.cmd run build`
Expected: Vite build completes without import errors from `@chenglou/pretext`

### Task 2: Rebrand The Shell And Open The Homepage

**Files:**
- Modify: `package.json`
- Modify: `index.html`
- Modify: `src/hooks/useAppRouter.js`
- Modify: `src/App.jsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Rename the package and site metadata**

```json
{
  "name": "zhaxiaoji-home"
}
```

```html
<title>Zhaxiaoji Studio | 个人主页、实验与 AI 狼人杀</title>
<meta name="description" content="Zhaxiaoji Studio 的个人主页，收纳 AI 狼人杀、实验站、实时行情与正在进行的项目。" />
```

- [ ] **Step 2: Make `/home` the public landing route instead of forcing unauthenticated users to `/login`**

```js
const PUBLIC_ROUTES = new Set([ROUTES.HOME, ROUTES.SITES, ROUTES.LOGIN, ROUTES.RESET, ROUTES.VERIFY]);
```

```js
if (!isAuthed && normalizedPath === '/') {
  navigate(ROUTES.HOME, { replace: true });
}
```

- [ ] **Step 3: Update App route branches so the homepage renders for everyone**

```jsx
if (isHomeRoute) {
  return <Dashboard ... />;
}

if (!isAuthed && isAuthRoute) {
  return <AuthPage ... />;
}
```

- [ ] **Step 4: Replace “Werewolf Pro” route meta with the new brand copy**

```js
title: 'Zhaxiaoji Studio | 个人主页、实验与 AI 狼人杀'
```

- [ ] **Step 5: Verify route/meta changes do not break the SPA shell**

Run: `npm.cmd run build`
Expected: build succeeds and generated `dist/index.html` contains the new brand title

### Task 3: Rebuild Dashboard As The Personal Homepage

**Files:**
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/index.css`
- Create: `src/components/home/HomePortalCard.jsx`
- Create: `src/components/home/IdeaMasonry.jsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Replace the dashboard’s current “logged-in control panel” framing with a public personal homepage**

```jsx
<section>
  <BalancedHeadline text="把游戏、实验和长期项目放在同一个入口里。" />
  <p>Zhaxiaoji Studio 的个人主页。</p>
</section>
```

- [ ] **Step 2: Add intentional visual direction via CSS variables and type choices**

```css
:root {
  --page-bg: #f4efe7;
  --ink: #1c1917;
  --accent: #0f766e;
  --warm: #c2410c;
}
```

- [ ] **Step 3: Replace the leaderboard area with text-driven idea/project cards**

```jsx
<IdeaMasonry
  items={[
    { title: 'AI 狼人杀', description: '保留原有推理流程与游客模式。' },
    { title: '实验站', description: '静态站、观点页与记录页继续沿用。' },
    { title: '实时行情', description: '把交易和观察工具保留为长期栏目。' }
  ]}
/>
```

- [ ] **Step 4: Keep auth actions contextual instead of dominant**

```jsx
{user ? <button onClick={onLogout}>退出</button> : <button onClick={onLogin}>登录</button>}
```

- [ ] **Step 5: Verify the homepage bundle still builds after the redesign**

Run: `npm.cmd run build`
Expected: `Dashboard` chunk builds and no import remains for `ModelLeaderboard`

### Task 4: Refresh Sites And Remove Leaderboard Flow

**Files:**
- Modify: `src/components/SitesPage.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/Dashboard.jsx`
- Optional cleanup: `src/components/ModelLeaderboard.jsx`
- Optional cleanup: `src/services/authService.js`
- Test: `npm.cmd run build`

- [ ] **Step 1: Reframe `/sites` as a lab/projects hub instead of a generic site list**

```jsx
<h1>Projects & Labs</h1>
<p>这里汇总个人站、实时行情和持续实验。</p>
```

- [ ] **Step 2: Remove the homepage leaderboard mount completely**

```jsx
// delete: import { ModelLeaderboard } from './ModelLeaderboard';
// delete: <ModelLeaderboard />
```

- [ ] **Step 3: Stop posting model leaderboard stats after each game**

```js
// keep per-player model usage for in-game display
// remove authService.submitModelStats(...) from App end-game effect
```

- [ ] **Step 4: Remove leftover copy that still promises “排行榜”**

```jsx
<p>对局结束后可以查看自己的战绩与复盘记录。</p>
```

- [ ] **Step 5: Verify the werewolf flow still compiles without the leaderboard path**

Run: `npm.cmd run build`
Expected: build succeeds and search for `ModelLeaderboard` only finds deleted/unused references

### Task 5: Final Verification

**Files:**
- Modify: `public/about.html`
- Modify: `public/privacy.html`
- Modify: `public/terms.html`
- Test: `npm.cmd run build`
- Test: `npm.cmd run test`

- [ ] **Step 1: Update static footer-linked pages to the new brand**

```html
<title>About | Zhaxiaoji Studio</title>
```

- [ ] **Step 2: Run production build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 3: Run unit tests**

Run: `npm.cmd run test`
Expected: PASS with existing 48 tests

- [ ] **Step 4: Spot check the renamed app shell**

Run: `rg -n "Werewolf Pro|ModelLeaderboard|排行榜" src index.html public`
Expected: no user-facing homepage references remain unless intentionally kept for werewolf history/stats copy

