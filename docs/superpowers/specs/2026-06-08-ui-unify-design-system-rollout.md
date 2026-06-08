# 全站 UI 统一（设计系统铺开）设计方案

> 把已落地的 taste-skill 设计系统（`tokens.css` 双主题 + `.mac-*` token 驱动组件语言）
> **贯彻到所有模块**：token 化全部硬编码颜色、修复对比度、统一卡片/按钮/间距，做到
> **light/dark 双档都正确、全局主题 toggle 全站可用**。各模块保留各自默认主题（werewolf=dark，
> 其余=light），但都必须在两档下可读。

**前置已完成：** Phase F（主题系统）、M1a（狼人杀竞技场颜色 token）、M1b（狼人杀手机端）、
ThemeScope 跨主题前景色修复、狼人杀 hub/setup token 化 —— 均已并入 main。

## 目标（用户确认）

1. **统一目标**：贯彻现有设计系统到所有模块（非重设计、非"外观完全一致"、非仅修 bug）。
2. **主题范围**：双档都正确，全局 light/dark/system toggle 在每个页面都完美工作。
3. **推进顺序**：高曝光/活跃优先 —— Auth → werewolf 收尾 → Home → Novel → Chat → Chords → Stock。
4. **执行方式**：playbook 驱动、逐模块、语义感知（approach C）。每模块一个 phase，
   独立可发布，逐个 token 化 + 双档验证 + 守门测试 + commit。

## 现状审计（硬编码颜色实例数，2026-06-08 grep）

| 区域 | ~实例 | 说明 |
|---|---|---|
| Stock（StockPage/PaperTrading/screener/orderbook/detail/charts…） | ~193 | 未动；含涨跌语义色 + 图表 |
| Werewolf 收尾（ReplayViewer 54 / GameHistoryTable 48 / SidePanels 38 / UserStats 33 / TokenManager 32 / GameLog / SpeechPanel / QueueGate） | ~220 | M1a 只做了主竞技场 |
| Chords（ChordsPage 90 / StemPlayer） | ~103 | 未动 |
| Novel（NovelWorkspace） | ~77 | 部分 |
| Auth（AuthShell/Login/Register/Forgot/Reset/Verify） | ~39 | 已知 AuthShell 深底深字 |
| Chat（chat 模块组件） | ~15 | 基本 ok |

模块主题声明：werewolf=`dark`，其余 6 个=`light`（`src/modules/*/index.js`）。

## Tokenization Playbook（所有 phase 共用规则）

### 中性色映射（约 80% 的量，也是深底深字/不一致的来源）

| 硬编码 | Token |
|---|---|
| `text-slate/zinc/gray-900..700` | `text-ink` |
| `text-slate/zinc/gray-600..500` | `text-ink-muted` |
| `text-slate/zinc/gray-400..300` | `text-ink-faint` |
| `bg-white` / `bg-white/xx` / `bg-slate/zinc-50..100` | `bg-bg-raised`（卡片）/ `bg-bg-sunken`（内嵌） |
| `bg-slate/zinc-800..950`（按深色设计的 surface） | `bg-bg-raised` / `bg-bg` |
| `border-slate/zinc-200..300` | `border-line` / `border-line-strong` |
| 选中态 `bg-slate-900` / `bg-indigo-*` | `bg-accent` + `border-accent` |

**铁律：卡片的 surface + 文字 + 边框作为一个整体一起 token 化**，绝不只换文字
（white-island 教训：白卡上只把文字换亮 = 浅底浅字）。

### 语义色 allowlist（映射到"含义"token，绝不降级为中性 ink）

- **Stock 涨跌**：红/绿 → `--market-up` / `--market-down`（A股红涨绿跌；顺手修已知的浅色档反色）
- **Werewolf 身份色**：→ `role-*` / `role-*-soft`（把 M1a 延伸到 ReplayViewer/GameHistoryTable/SidePanels/UserStats/GameLog）
- **状态语义**：success/danger/warning → 对应 token
- **图表**（candlestick 填充、坐标轴/网格）：涨跌用 market token；轴/网格用 `line`/`ink-faint`
- **数据驱动的内联色**（头像 `backgroundColor`、生成资产）：**不动**
- **Tailwind `/opacity` 陷阱**：禁止 `bg-token/20`（CSS 变量 token 上静默失效）；用预烘焙的 `*-soft` token

## Phase 拆分（逐模块，按确认顺序）

| Phase | 范围 | ~实例 |
|---|---|---|
| P1 | **Auth**（LoginForm / RegisterForm / AuthShell 深底深字 / Forgot / Reset / Verify / AuthPage） | ~39 |
| P2 | **Werewolf 收尾**（ReplayViewer / GameHistoryTable / SidePanels / UserStats / TokenManager / GameLog / SpeechPanel / QueueGate） | ~220 |
| P3 | **Home**（Dashboard / HomePortalCard / IdeaMasonry / SitesPage） | ~45 |
| P4 | **Novel**（NovelWorkspace） | ~77 |
| P5 | **Chat**（chat 模块组件） | ~15 |
| P6 | **Chords**（ChordsPage / StemPlayer） | ~103 |
| P7 | **Stock**（StockPage / PaperTrading / screener / orderbook / detail / charts… + market token 接线） | ~193 |

每 phase：按 playbook token 化 → 双档验证 → 守门测试 → commit。phase 之间独立可发布、易回滚。

## 双档验证协议（每个 phase）

1. `npm run build` 干净（check-build 0 泄漏）+ `npm test` 全绿
2. 浏览器：该模块在 **light 和 dark** 两档各截图（toggle 切换），抽查 1–2 处文字/背景计算色对比度
3. 每模块一个 `*Tokens.test.jsx` 守门测试：渲染含 `text-ink`/`bg-bg-raised`，且 **无** `text-slate-\d` / `bg-white/7\d` 回归
4. grep 审计：非语义硬编码中性色 → 0

> 注：browse 无法维持狼人杀对局会话（[[feedback_browse_limitations]]）；对走不到的活体页面，
> 用渲染逻辑/守门测试 + 可达页面截图兜底，与 M1b 一致。

## 风险与缓解

- **语义色误伤**（market/role/chart）→ 显式 allowlist + 人工复核每个红/绿/身份色，绝不批量替换
- **Stock 浅色档反色**（已知）→ P7 一并修，接 `--market-up/down`
- **`.mac-*` 交互** → 保留 `.mac-*`（token 驱动，不做 codemod）；只修周边硬编码 Tailwind
- **每模块大 diff** → 一模块一 commit，截图为证，易回滚
- **图表在 dark**（candlestick/stock）→ 验证 canvas/SVG 颜色取自 token 或主题合适值
- **继承前景色**（已由 ThemeScope 修复，见 [[feedback_themescope_must_set_color]]）→ 新增组件仍须显式 token，不靠继承

## DoD（整体铺开）

- 每个模块在 **light 和 dark** 两档都可读、配色一致；全局主题 toggle 全站可用
- `npm run build` + `npm test` 全绿
- grep 审计：零非语义硬编码颜色
- 每个 phase 有 before/after 双档截图

## 不做（YAGNI / 范围外）

- 不做 `.mac-*` → `src/ui/<Button>` 的 JSX codemod（既定决策：`.mac-*` 改为 token 驱动即可）
- 不重设计新视觉语言
- 不动游戏状态机 / 业务逻辑 / 后端
- 狼人杀「对游客开放真实 AI 调用」是另一独立诉求，不在本 UI 方案内
