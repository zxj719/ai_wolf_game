# Phase 2 Wolfgame IA Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated werewolf landing page under the new personal homepage architecture and fully remove the leftover leaderboard plumbing from the frontend code path.

**Architecture:** Keep the current homepage and projects hub from phase 1, then carve werewolf into its own public-facing route so the information architecture reads as homepage -> module hub -> game setup/play. In parallel, delete stale leaderboard component/service helpers and old lifecycle code that still references model leaderboard submission.

**Tech Stack:** React 18, Vite 5, TailwindCSS, manual history router, `@chenglou/pretext`

---

### Task 1: Add Dedicated Wolfgame Route

**Files:**
- Create: `src/components/WolfgameHub.jsx`
- Modify: `src/hooks/useAppRouter.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Dashboard.jsx`
- Test: `npm.cmd run build`

- [ ] **Step 1: Add a new route constant and route guards**

```js
export const ROUTES = {
  WOLFGAME: '/wolfgame',
  CUSTOM: '/wolfgame/custom',
  PLAY: '/wolfgame/play'
};
```

- [ ] **Step 2: Create a public werewolf landing page**

```jsx
export function WolfgameHub({ onStartGame, onBackHome, onLogin, onGuestPlay, ... }) {
  return (
    <div>
      <h1>AI 狼人杀</h1>
      <p>把玩法说明、游客试玩、令牌管理和战绩入口放进独立模块页。</p>
    </div>
  );
}
```

- [ ] **Step 3: Wire the new route into `App.jsx`**

```jsx
if (isWolfgameRoute) {
  return <WolfgameHub ... />;
}
```

- [ ] **Step 4: Change homepage CTAs to enter the werewolf hub instead of jumping straight into setup**

```jsx
primaryAction={{ label: '进入狼人杀模块', onClick: onEnterWolfgame }}
```

- [ ] **Step 5: Verify the new route compiles**

Run: `npm.cmd run build`
Expected: build succeeds and a `WolfgameHub` chunk is produced or included in the main bundle

### Task 2: Remove Leaderboard Residue

**Files:**
- Delete: `src/components/ModelLeaderboard.jsx`
- Modify: `src/services/authService.js`
- Modify: `src/hooks/useGameLifecycle.js`
- Modify: `src/useWerewolfGame.js`
- Optional: `src/services/gameService.js`
- Test: `rg -n "ModelLeaderboard|submitModelStats|getModelLeaderboard" src`

- [ ] **Step 1: Remove the unused leaderboard component file**

```bash
git rm src/components/ModelLeaderboard.jsx
```

- [ ] **Step 2: Remove old leaderboard helper methods from `authService`**

```js
// delete submitModelStats
// delete getModelLeaderboard
```

- [ ] **Step 3: Remove stale lifecycle submission code**

```js
// delete authService import
// delete modelUsage-based submitModelStats branch
```

- [ ] **Step 4: Retitle `modelUsage` comments so they describe in-game display only**

```js
// AI model usage tracking for in-game display and post-game review
```

- [ ] **Step 5: Verify no active leaderboard frontend path remains**

Run: `rg -n "ModelLeaderboard|submitModelStats|getModelLeaderboard" src`
Expected: no matches, or only comments intentionally left during cleanup review

### Task 3: Verify Phase 2

**Files:**
- Test: `npm.cmd run build`
- Test: `npm.cmd run test`

- [ ] **Step 1: Run production build**

Run: `npm.cmd run build`
Expected: PASS

- [ ] **Step 2: Run unit tests**

Run: `npm.cmd run test`
Expected: PASS with existing 48 tests

- [ ] **Step 3: Spot check route and copy residue**

Run: `rg -n "Werewolf Pro|排行榜|/wolfgame'" src index.html public`
Expected: no stale homepage/leaderboard branding remains, and `/wolfgame` route is present where expected

