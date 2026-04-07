# Wolfgame Hub Visual Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the public `/wolfgame` hub into the same editorial visual system as the new homepage while keeping existing werewolf setup/play flows and account actions unchanged.

**Architecture:** Keep the route tree and gameplay shell untouched. Limit UI work to the hub surface, reusing the homepage's shared visual primitives such as `page-orbit`, `paper-panel`, `font-display`, and existing pretext-backed components where they improve the information layout.

**Tech Stack:** React, Vite, TailwindCSS, `lucide-react`, `@chenglou/pretext`

---

### Task 1: Lock the Hub Refactor Scope

**Files:**
- Modify: `src/components/WolfgameHub.jsx`
- Reference: `src/components/Dashboard.jsx`
- Reference: `src/components/home/BalancedHeadline.jsx`
- Reference: `src/components/home/HomePortalCard.jsx`
- Reference: `src/components/home/IdeaMasonry.jsx`
- Reference: `src/index.css`

- [ ] Confirm `WolfgameHub.jsx` is the only write target for the visual refactor.
- [ ] Preserve all existing hub actions: back home, guest play, logged-in stats, token manager, login CTA.
- [ ] Preserve the public/private route contract already implemented in `src/hooks/useAppRouter.js`.

### Task 2: Rebuild the Hub Surface in Homepage Style

**Files:**
- Modify: `src/components/WolfgameHub.jsx`

- [ ] Replace the current zinc-only shell with the homepage visual language: `bg-[var(--homepage-bg)]`, `page-orbit`, lighter paper panels, serif headline, and warmer accents.
- [ ] Use a stronger hero structure so the page reads as a module landing page rather than a setup screen.
- [ ] Make the public IA explicit in copy: `/wolfgame` is the public hub; `/wolfgame/custom` and `/wolfgame/play` are the next-step routes.
- [ ] Keep token manager and stats modals working exactly as before.

### Task 3: Reuse Shared Editorial Components Where They Add Value

**Files:**
- Modify: `src/components/WolfgameHub.jsx`

- [ ] Reuse `BalancedHeadline` for the hero title so the hub matches the homepage's pretext-driven typography.
- [ ] Reuse either `HomePortalCard` or `IdeaMasonry` for supporting content blocks when that improves consistency without forcing awkward content.
- [ ] Avoid changing shared components unless a hard blocker appears; prefer composition inside the hub page.

### Task 4: Verify and Prepare for Deploy

**Files:**
- Modify: `src/components/WolfgameHub.jsx`

- [ ] Run `npm.cmd run build` and confirm the build succeeds.
- [ ] Run `npm.cmd run test` and confirm all tests still pass.
- [ ] If verification passes, deploy with `npm.cmd run deploy`.
- [ ] After deploy, report the commands run and any deployment URL or status output that matters.
