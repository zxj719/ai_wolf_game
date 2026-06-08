# 全站 UI 统一（设计系统铺开）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 taste-skill 设计系统 token 化铺到所有模块，做到 light/dark 双档都可读、全局主题 toggle 全站可用。

**Architecture:** playbook 驱动、逐模块、语义感知。每个模块一个 phase：按映射表 token 化硬编码颜色 → 保护语义色（market/role/status/chart）→ build + token 守门测试 + 双档抽查 → commit。各 phase 独立可发布。

**Tech Stack:** React + TailwindCSS（CSS 变量 token，`tokens.css` 双主题）；vitest（createRoot+act）；现有 `.mac-*` token 驱动组件保留。

**Spec:** [docs/superpowers/specs/2026-06-08-ui-unify-design-system-rollout.md](../specs/2026-06-08-ui-unify-design-system-rollout.md)

---

## 共用映射（Playbook）—— 每个 phase 都按此执行

**中性色（按整卡 surface+text+border 一起换）：**
- `text-{slate,zinc,gray,neutral}-{900,800,700}` → `text-ink`
- `text-{slate,zinc,gray,neutral}-{600,500}` → `text-ink-muted`
- `text-{slate,zinc,gray,neutral}-{400,300}` → `text-ink-faint`
- `bg-white` / `bg-white/NN` / `bg-{slate,zinc,gray}-{50,100}` → `bg-bg-raised`（卡）/ `bg-bg-sunken`（内嵌）
- `bg-{slate,zinc}-{800,900,950}`（深色 surface） → `bg-bg-raised` / `bg-bg`
- `border-{slate,zinc,gray}-{200,300}` → `border-line` / `border-line-strong`
- 选中态 `bg-slate-900` / `bg-indigo-*` → `bg-accent` + `border-accent`

**语义色 allowlist（映射到含义 token，绝不降级中性）：**
- 涨跌红/绿 → `text-market-up`/`text-market-down`（+`bg`/`border` 同名）
- 身份色 → `role-*` / `role-*-soft`
- 状态 → `success`/`danger`/`warning`
- 图表轴/网格 → `line`/`ink-faint`；涨跌 → market token
- 头像 inline `backgroundColor`（数据驱动）→ 不动
- 禁止 `bg-token/NN`（CSS 变量 token 上 `/opacity` 静默失效）→ 用 `*-soft`

**每个 phase 收尾验证（统一）：**
1. `npm run build` → 末尾 `check-build ✅`
2. 新增/更新该模块 `*Tokens.test.jsx` 守门测试（含 `text-ink`/`bg-bg-raised`，无 `text-slate-\d`/`bg-white/7\d`）
3. `npm test` → 全绿
4. grep 审计该模块：`grep -rE 'text-(slate|zinc|gray)-[0-9]|bg-white(/|[^-])|border-(slate|zinc)-[0-9]'`（仅剩语义/选中态 allowlist 命中）
5. `git add` 该模块文件 + commit（`fix(ui): <module> token 化（双档可读）`）

---

## Task P1: Auth 模块 token 化

**Files:**
- Modify: `src/components/Auth/AuthShell.jsx`（已知 `text-slate-950` 深底深字）
- Modify: `src/components/Auth/LoginForm.jsx`
- Modify: `src/components/Auth/RegisterForm.jsx`
- Modify: `src/components/Auth/ForgotPasswordForm.jsx`
- Modify: `src/components/Auth/ResetPasswordForm.jsx`
- Modify: `src/components/Auth/VerifyEmailPage.jsx`
- Modify: `src/components/Auth/AuthPage.jsx`
- Test: `src/components/Auth/__tests__/authTokens.test.jsx`（新建）

- [ ] **Step 1:** grep 这些文件的硬编码颜色，逐个按 playbook 映射（auth 是 light 模块，语义色少；`text-rose-*`/`text-red-*` 错误提示 → `text-danger`，成功 → `text-success`）。
- [ ] **Step 2:** 写守门测试 `authTokens.test.jsx`：mount LoginForm，断言含 `text-ink`，不含 `text-slate-\d`。
- [ ] **Step 3:** `npm run build`；预期 `check-build ✅`。
- [ ] **Step 4:** `npm test`；预期全绿。
- [ ] **Step 5:** grep 审计 Auth 目录；预期仅 allowlist 命中。
- [ ] **Step 6:** commit `fix(ui): Auth token 化（登录页双档可读，修 AuthShell 深底深字）`。

## Task P2: Werewolf 收尾 token 化

**Files:**
- Modify: `src/components/ReplayViewer.jsx`、`GameHistoryTable.jsx`、`SidePanels.jsx`、`UserStats.jsx`、`TokenManager.jsx`、`GameLog.jsx`、`SpeechPanel.jsx`、`QueueGate.jsx`
- Test: `src/components/__tests__/werewolfPanelsTokens.test.jsx`（新建）

- [ ] **Step 1:** 按 playbook 映射中性色；**身份色保留/映射 `role-*`**（这些面板大量用 role 颜色显示玩家身份/行动）；袭击/查验/投票等用既有 role/phase token（参考 M1a 的 CirclePlayerLayout 写法）。
- [ ] **Step 2:** 守门测试：mount GameHistoryTable（或 GameLog）断言 token、无 slate。
- [ ] **Step 3:** `npm run build`。
- [ ] **Step 4:** `npm test`。
- [ ] **Step 5:** grep 审计这些文件；仅 role/phase/state allowlist 命中。
- [ ] **Step 6:** commit `fix(ui): 狼人杀 replay/history/log/panels token 化`。

## Task P3: Home 模块 token 化

**Files:**
- Modify: `src/components/Dashboard.jsx`、`src/components/home/HomePortalCard.jsx`、`src/components/home/IdeaMasonry.jsx`、`src/components/SitesPage.jsx`
- Test: `src/components/__tests__/homeTokens.test.jsx`（新建）

- [ ] **Step 1:** 按 playbook 映射（home 是 light 模块、canonical mac 风；多为 `text-slate-900`/`bg-white`）。
- [ ] **Step 2:** 守门测试：mount Dashboard，断言 token、无 slate。
- [ ] **Step 3-6:** build → test → grep 审计 → commit `fix(ui): Home/Dashboard token 化`。

## Task P4: Novel 模块 token 化

**Files:**
- Modify: `src/components/NovelWorkspace.jsx`
- Test: `src/components/__tests__/novelTokens.test.jsx`（新建）

- [ ] **Step 1:** 按 playbook 映射（~77 实例，多 `text-slate-900/950/400`、`bg-white`、tab `text-slate-400`/`text-slate-900`）。Codex 对话区/只读区都覆盖。
- [ ] **Step 2:** 守门测试：mount BookshelfPage 或一个导出的子组件，断言 token。
- [ ] **Step 3-6:** build → test → grep → commit `fix(ui): Novel 工作台 token 化`。

## Task P5: Chat 模块 token 化

**Files:**
- Modify: `src/modules/chat/components/*.jsx`（VideoCallPanel、AddFriend、ConversationView、MessageInput、MessageList、FriendRequests、FriendList、DraggablePiP）、`src/modules/chat/ChatRoute.jsx`
- Test: `src/modules/chat/__tests__/chatTokens.test.jsx`（新建）

- [ ] **Step 1:** 按 playbook 映射（量小 ~15）。在线/离线状态点等 → success/ink-faint。
- [ ] **Step 2:** 守门测试。
- [ ] **Step 3-6:** build → test → grep → commit `fix(ui): Chat 模块 token 化`。

## Task P6: Chords 模块 token 化

**Files:**
- Modify: `src/components/ChordsPage.jsx`、`src/components/StemPlayer.jsx`
- Test: `src/components/__tests__/chordsTokens.test.jsx`（新建）

- [ ] **Step 1:** 按 playbook 映射（~103 实例，大量 `text-slate-900`/`bg-white`；播放器进度/波形 → accent/line）。
- [ ] **Step 2:** 守门测试。
- [ ] **Step 3-6:** build → test → grep → commit `fix(ui): Chords/StemPlayer token 化`。

## Task P7: Stock 模块 token 化（+ market token 接线）

**Files:**
- Modify: `src/components/Stock/*.jsx`（StockPage、PaperTrading、StockScreener、TradePanel、OrderBook、StockDetail、WatchlistTags、QuoteBar、BatchAddModal、CandlestickChart、WatchlistSorter）
- Test: `src/components/Stock/__tests__/stockTokens.test.jsx`（新建）

- [ ] **Step 1:** 中性色按 playbook；**涨跌红绿 → `--market-up/down` token**（A股红涨绿跌），顺手修已知浅色档反色；CandlestickChart 的涨跌填充取 market token，轴/网格取 line/ink-faint。
- [ ] **Step 2:** 守门测试：mount QuoteBar 或 OrderBook，断言中性用 token、涨跌用 market token、无裸 slate。
- [ ] **Step 3:** `npm run build`。
- [ ] **Step 4:** `npm test`。
- [ ] **Step 5:** grep 审计 Stock 目录；仅 market/语义 allowlist 命中。
- [ ] **Step 6:** commit `fix(ui): Stock 模块 token 化 + market 涨跌色接线（修反色）`。

## Task P8: 全站收尾验证

- [ ] **Step 1:** 全仓 grep 审计：`grep -rnE 'text-(slate|zinc|gray|neutral)-[0-9]|bg-white(/|\b)' src --include=*.jsx | grep -v __tests__`，确认仅剩语义 allowlist（market/role/status）与必要例外，记录残留清单。
- [ ] **Step 2:** `npm run build` + `npm test` 全绿。
- [ ] **Step 3:** 浏览器：首页 + 每模块入口在 light/dark 两档抽查截图（可达页面）；werewolf 对局走守门测试兜底。
- [ ] **Step 4:** 更新 CHANGELOG（一条总结 + per-phase 文件表）。
- [ ] **Step 5:** 合并到 main（用户既定：本地合并），更新 memory（M2/M3/M4 完成）。

---

## Self-Review

- **Spec coverage:** P1–P7 覆盖 spec 全部 7 个模块；playbook 映射表 + 语义 allowlist 内联；双档验证协议落到每个 phase 的 build/test/grep/守门测试；DoD 落到 P8。✓
- **Placeholder scan:** 颜色映射为机械规则（playbook 表），非 placeholder；每 phase 有具体文件清单 + 具体验证命令。✓
- **一致性:** 守门测试命名 `<module>Tokens.test.jsx` 一致；commit 前缀 `fix(ui):` 一致；映射规则全程同一张表。✓
