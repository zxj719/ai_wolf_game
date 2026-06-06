# UI 重构 M1a（狼人杀颜色 token 化）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（或 executing-plans）。Steps 用 `- [ ]` 勾选框。

**Goal:** 把狼人杀模块 ~183 处硬编码颜色收敛到一套**游戏颜色 token 注册表**（角色/阶段/状态/动作），消除 5 处色彩语义重载（尤其修复「选中=靛蓝=夜晚背景」导致夜间选中不可见），并把游戏中性色统一到 Phase F 的 `--bg/--ink/--border` token。**保留每个角色现有色相**（信息设计，玩家已习惯），只做集中化 + 去重载，不重绘调色板。零功能/流程改动。

**Architecture:** 在 `tokens.css` 新增 `--role-* / --phase-* / --state-*` 游戏 token（dark-first，因狼人杀默认深色）；`tailwind.config.js` 暴露为 `text-role-wolf` / `bg-phase-night` / `ring-state-selected` 等类；然后逐组件把硬编码 Tailwind 色类按映射表替换为 token 类。中性色（zinc）→ 现有 `--bg/--ink/--border`（深色 token 值本就源自 zinc，近乎像素一致）。

**Tech Stack:** React 18 · Tailwind v3.3 · CSS 变量 · Vitest。

**参考：** [设计规范](../specs/2026-06-06-ui-refactor-taste-skill-design.md) · [Phase F 计划](2026-06-06-ui-refactor-phase-f-foundation.md)

---

## 颜色 Token 设计（M1a 的核心决策）

### 角色色（`--role-*`，保留现有色相，集中为 token）
| 角色 | token | 色相（沿用现状） |
|---|---|---|
| 狼人 wolf | `--role-wolf` | rose `#f43f5e` |
| 预言家 seer | `--role-seer` | purple `#a855f7` |
| 女巫 witch | `--role-witch` | emerald `#10b981` |
| 猎人 hunter | `--role-hunter` | orange `#f97316` |
| 守卫 guard | `--role-guard` | blue `#3b82f6` |
| 魔术师 magician | `--role-magician` | violet `#8b5cf6` |
| 骑士 knight | `--role-knight` | amber `#f59e0b` |
| 摄梦人 dreamweaver | `--role-dreamweaver` | fuchsia `#d946ef`（**去重载**：原本无独立色/借靛蓝） |
| 村民 villager | `--role-villager` | zinc `#a1a1aa`（中性） |

### 阶段色（`--phase-*`，背景/页眉）
| 阶段 | token | 色相 |
|---|---|---|
| 夜晚 night | `--phase-night` | indigo `#6366f1` |
| 白天 day | `--phase-day` | amber `#f59e0b` |
| 投票 vote | `--phase-vote` | orange `#f97316` |
| 公告/结算 announce | `--phase-resolution` | yellow `#eab308` |

### 状态色（`--state-*`，高亮/结果）
| 状态 | token | 色相 | 说明 |
|---|---|---|---|
| 选中目标 selected | `--state-selected` | **cyan `#06b6d4`** | **关键去重载**：从靛蓝改青色，夜晚背景上清晰可见 |
| 发言中 speaking | `--state-speaking` | emerald `#10b981` | ring 高亮 |
| 死亡 dead | `--state-dead` | zinc `#71717a` + grayscale | |
| 好人胜 win-good | `--state-win-good` | emerald `#10b981` | |
| 坏人胜 win-evil | `--state-win-evil` | rose `#f43f5e` | |
| AI 思考 thinking | `--state-thinking` | purple `#a855f7` | |

### 动作色（复用上面，不新增）
袭击=`--role-wolf`/danger，解药=`--state-speaking`(emerald)，毒药=`--role-seer`(purple)，守护=`--role-guard`，开枪=`--role-hunter`，投票=`--phase-vote`，弃票=`--ink-faint`。

### 中性色映射（统一到 Phase F token）
| 现状 | → token 类 |
|---|---|
| `bg-zinc-950` | `bg-bg` |
| `bg-zinc-900` / `bg-zinc-900/95` | `bg-bg-raised` |
| `bg-zinc-800` | `bg-bg-raised`（或 `bg-bg-sunken` 视层级） |
| `text-zinc-100` | `text-ink` |
| `text-zinc-300/400` | `text-ink-muted` |
| `text-zinc-500/600` | `text-ink-faint` |
| `border-zinc-700/800` | `border-line-strong` / `border-line` |

> 说明：深色 token（`--bg #09090b`、`--bg-raised #18181b`、`--ink #fafafa`）本就源自 zinc-950/900/50，映射后近乎像素一致，风险极低。

### 透明度处理
许多用 `/20 /40 /50`（如 `bg-rose-500/20`）。Tailwind 任意透明度对 CSS-var 颜色支持有限。约定：token 颜色类用于**实色**；半透明叠加（如选中卡片淡色背景）改用内联 `style={{ backgroundColor: 'color-mix(in srgb, var(--role-wolf) 20%, transparent)' }}` 或预定义 `--role-wolf-soft` 软色 token。本计划为每个 role/state 额外定义一个 `*-soft`（同色 12% 混入背景）token，供淡底使用，避免散落 `color-mix`。

---

## Task 1: 定义游戏颜色 token + tailwind 映射

**Files:** `src/styles/tokens.css`, `tailwind.config.js`

- [ ] **Step 1: 在 `tokens.css` 的 `[data-theme="dark"]` 块末尾（圆角段之前）新增游戏 token 段**

```css
  /* —— 狼人杀游戏色（M1a）—— */
  /* 角色（实色 + soft 淡底） */
  --role-wolf:        #fb7185;  --role-wolf-soft:        rgb(244 63 94 / 0.18);
  --role-seer:        #c084fc;  --role-seer-soft:        rgb(168 85 247 / 0.18);
  --role-witch:       #34d399;  --role-witch-soft:       rgb(16 185 129 / 0.18);
  --role-hunter:      #fb923c;  --role-hunter-soft:      rgb(249 115 22 / 0.18);
  --role-guard:       #60a5fa;  --role-guard-soft:       rgb(59 130 246 / 0.18);
  --role-magician:    #a78bfa;  --role-magician-soft:    rgb(139 92 246 / 0.18);
  --role-knight:      #fbbf24;  --role-knight-soft:      rgb(245 158 11 / 0.18);
  --role-dreamweaver: #e879f9;  --role-dreamweaver-soft: rgb(217 70 239 / 0.18);
  --role-villager:    #a1a1aa;  --role-villager-soft:    rgb(161 161 170 / 0.18);
  /* 阶段 */
  --phase-night:      #818cf8;  --phase-night-bg:        #1e1b4b;
  --phase-day:        #fbbf24;  --phase-day-bg:          rgb(120 53 15 / 0.20);
  --phase-vote:       #fb923c;
  --phase-resolution: #facc15;
  /* 状态 */
  --state-selected:   #22d3ee;  --state-selected-soft:   rgb(6 182 212 / 0.22);
  --state-speaking:   #34d399;
  --state-dead:       #71717a;
  --state-win-good:   #34d399;
  --state-win-evil:   #fb7185;
  --state-thinking:   #c084fc;
```

（说明：深色下采用 400 档亮色相以保证暗底可读；soft 用 18–22% alpha。）

- [ ] **Step 2: light 块也补一份**（游戏默认深色，但 toggle 后可能浅色显示，给浅色值，500/600 档更深以保证亮底可读）。在 light `:root,[data-theme="light"]` 圆角段之前加同名 token，值改用更深档：`--role-wolf:#e11d48; --role-seer:#9333ea; --role-witch:#059669; --role-hunter:#ea580c; --role-guard:#2563eb; --role-magician:#7c3aed; --role-knight:#d97706; --role-dreamweaver:#c026d3; --role-villager:#52525b;` 对应 `*-soft` 同色 0.14 alpha；`--phase-night:#4f46e5; --phase-night-bg:#e0e7ff; --phase-day:#d97706; --phase-day-bg:rgb(245 158 11 / 0.12); --phase-vote:#ea580c; --phase-resolution:#ca8a04; --state-selected:#0891b2; --state-selected-soft:rgb(8 145 178 / 0.16); --state-speaking:#059669; --state-dead:#a1a1aa; --state-win-good:#059669; --state-win-evil:#e11d48; --state-thinking:#9333ea;`

- [ ] **Step 3: `tailwind.config.js` 的 `colors` 增加游戏色命名空间**

```js
        role: {
          wolf: 'var(--role-wolf)', 'wolf-soft': 'var(--role-wolf-soft)',
          seer: 'var(--role-seer)', 'seer-soft': 'var(--role-seer-soft)',
          witch: 'var(--role-witch)', 'witch-soft': 'var(--role-witch-soft)',
          hunter: 'var(--role-hunter)', 'hunter-soft': 'var(--role-hunter-soft)',
          guard: 'var(--role-guard)', 'guard-soft': 'var(--role-guard-soft)',
          magician: 'var(--role-magician)', 'magician-soft': 'var(--role-magician-soft)',
          knight: 'var(--role-knight)', 'knight-soft': 'var(--role-knight-soft)',
          dreamweaver: 'var(--role-dreamweaver)', 'dreamweaver-soft': 'var(--role-dreamweaver-soft)',
          villager: 'var(--role-villager)', 'villager-soft': 'var(--role-villager-soft)',
        },
        phase: {
          night: 'var(--phase-night)', 'night-bg': 'var(--phase-night-bg)',
          day: 'var(--phase-day)', 'day-bg': 'var(--phase-day-bg)',
          vote: 'var(--phase-vote)', resolution: 'var(--phase-resolution)',
        },
        state: {
          selected: 'var(--state-selected)', 'selected-soft': 'var(--state-selected-soft)',
          speaking: 'var(--state-speaking)', dead: 'var(--state-dead)',
          'win-good': 'var(--state-win-good)', 'win-evil': 'var(--state-win-evil)',
          thinking: 'var(--state-thinking)',
        },
```

- [ ] **Step 4: 构建验证** `npm run build`，并 `grep -c "role-wolf" dist/assets/*.css`（确认 token 进产物）。
- [ ] **Step 5: 提交** `git add src/styles/tokens.css tailwind.config.js && git commit -m "feat(werewolf): 游戏颜色 token 注册表（角色/阶段/状态）(M1a)"`

---

## Task 2–9: 逐组件 token 化（每文件一个任务）

每个任务的统一做法：读文件 → 按「映射表」把硬编码色类替换为 token 类 → 不改结构/逻辑 → `npm run build` 通过 → 提交。映射规则：

- 角色色：`text-rose-500/400`→`text-role-wolf`；`text-purple-*`(seer)→`text-role-seer`；`text-emerald-*`(witch)→`text-role-witch`；`text-orange-*`(hunter)→`text-role-hunter`；`text-blue-*`(guard)→`text-role-guard`；`text-violet-*`(magician)→`text-role-magician`；摄梦人按钮 `bg-indigo-600`→`bg-role-dreamweaver`；`text-zinc-500`(villager)→`text-role-villager`。半透明底 `bg-rose-500/20`→`bg-role-wolf-soft`（同理各角色）。
- 阶段：夜 `from-indigo-950`→`from-phase-night-bg`、`text-indigo-400`→`text-phase-night`；昼 `from-amber-950/20`→`from-phase-day-bg`、`text-amber-400`→`text-phase-day`；投票 `text-orange-400`→`text-phase-vote`。
- 状态：选中 `border-indigo-500`/`ring-indigo-500/30`→`border-state-selected`/`ring-state-selected`（**关键去重载**）；发言 `ring-emerald-500`→`ring-state-speaking`；好人胜 `text-emerald-400`→`text-state-win-good`、坏人胜 `text-rose-400`→`text-state-win-evil`；AI 思考 `bg-purple-600/*`→`bg-state-thinking`。
- 中性：按上文「中性色映射」表 `zinc-*`→`bg/ink/border` token。
- 按钮：主 `bg-indigo-600`(确认)→`bg-accent`；成功 `bg-emerald-600`→`bg-success`；危险 `bg-rose-600`→`bg-danger`；次 `bg-zinc-700`→`bg-bg-raised border border-line`。

> 半透明任意值（`/20` 等）若映射到 `*-soft` token 不可用 Tailwind alpha 语法时，用对应 `bg-role-x-soft` 实色类（已是带 alpha 的 rgba）。

- [ ] **Task 2:** `src/components/CirclePlayerLayout.jsx`（~85 处，最大）。读文件 → 应用映射 → build → commit `refactor(werewolf): CirclePlayerLayout 颜色 token 化 (M1a)`
- [ ] **Task 3:** `src/components/PlayerCardList.jsx`（~18）→ commit
- [ ] **Task 4:** `src/components/GameArena.jsx`（~18，含夜/昼背景渐变）→ commit
- [ ] **Task 5:** `src/components/ActionPanel.jsx`（~12）→ commit
- [ ] **Task 6:** `src/components/SpeechBubble.jsx`（~14，夜/昼边框）→ commit
- [ ] **Task 7:** `src/components/GameHeader.jsx`（~8）→ commit
- [ ] **Task 8:** `src/components/VotePanel.jsx`（~6）→ commit
- [ ] **Task 9:** `src/styles/game-animations.css`（6 处 hex：`#6366f1`→`var(--phase-night)`、`#f59e0b`→`var(--phase-day)`、`#f43f5e`→`var(--role-wolf)` 等）→ commit

> SetupScreen.jsx / RoleSelector.jsx 是浅色 `.mac-*` 风格，属 M2（首页/认证族）的浅色统一范畴，**不在 M1a**（避免把游戏深色 token 强加到设置页浅色语境）。

---

## Task 10: M1a 验收

- [ ] **Step 1:** `npm run build && node node_modules/vitest/vitest.mjs run` 全绿。
- [ ] **Step 2:** 审计：`grep -rnE "(text|bg|border|ring|from|to)-(rose|purple|emerald|orange|violet|indigo|amber|sky)-[0-9]" src/components/CirclePlayerLayout.jsx src/components/GameArena.jsx src/components/ActionPanel.jsx src/components/SpeechBubble.jsx src/components/GameHeader.jsx src/components/VotePanel.jsx src/components/PlayerCardList.jsx` —— 理想趋近 0（残留需是有意保留并说明）。
- [ ] **Step 3:** `/browse` 起 dev、进入一局（游客模式），桌面 1440 截图夜晚 + 白天 + 投票阶段，确认：①各角色色清晰且唯一；②**夜晚选中目标用青色高亮清晰可见**（去重载验证）；③中性背景/文字对比正常。
- [ ] **Step 4:** CHANGELOG 顶部加 M1a 记录。
- [ ] **Step 5:** 提交 changelog。

## DoD
- 游戏组件硬编码品牌色趋近 0，全部经 `--role/--phase/--state` 或 Phase F 中性 token。
- 选中态去重载（青色），夜晚可见。
- build + 测试全绿；游戏视觉与改造前基本一致（仅选中色有意改变）。

## 不在 M1a（后续）
- **M1b：** 狼人杀手机端圆桌重做（结构性，单独计划，可能需快速设计确认）。
- SetupScreen/RoleSelector 浅色统一 → M2。
- 交互全态补齐（loading/empty/error）→ 可并入 M1b 或单列。
