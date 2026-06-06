# 前端 UI 重构设计规范 — taste-skill 落地

> 日期：2026-06-06 · 状态：已批准方向，待文档审阅
> 参考：`C:\Users\xingj\Documents\agent\taste-skill`（redesign-skill + 核心 taste-skill v2）

## 1. 目标

把现有 7 模块前端收敛为**风格统一、电脑/手机统一**的界面，落地 taste-skill 的反模板（anti-slop）规则，并完成 Phase 1 已铺好但未推进的设计系统迁移——以**视觉打磨 + 响应式**为深度，**不强制**把 `.mac-*` JSX 改写为 `<Button>` 组件。

不破坏任何现有功能；与现有 React 18 + Vite + Tailwind v3 技术栈协同，不迁移框架。

## 2. 设计判读（Design Read）

> 多模块产品应用（AI 狼人杀为旗舰 + 生产力工具集），面向中文 consumer/prosumer，采用「干净 macOS 浅色语言 + 沉浸深色游戏语言」双轨，落在 Tailwind v3 + 现有 token 系统 + 全局明暗切换 + 单一锁定强调色（深色琥珀 / 浅色蓝）+ 克制动效。

### 三旋钮定档（taste-skill Dials）

| 界面族 | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|
| 狼人杀（游戏） | 5 | 6 | 6 |
| 生产力模块 | 4 | 3 | 4 |

## 3. 已批准的四项基础决策

1. **范围**：全部 7 模块（狼人杀 / 首页 / 认证 / 小说 / 聊天 / 弦谱 / 股票）。
2. **主题策略**：全局明暗切换（方案 A）——全局 toggle + 模块默认主题；用户未手动设置时跟随模块默认（狼人杀默认深色、生产力默认浅色），手动设置后用户偏好覆盖全站，存 localStorage。
3. **强调色**：按主题分——深色 `--accent` = 琥珀 `#d97706`，浅色 `--accent` = macOS 蓝 `#0a84ff`。全站唯一品牌强调色，禁止 AI 紫。
4. **深度**：视觉打磨 + 响应式起步；用「token 驱动的 `.mac-*` CSS」替代全量 JSX codemod。

## 4. 统一 Token 系统（单一真相源）

所有业务组件只引用 token 类（`bg-bg` `bg-bg-raised` `text-ink` `text-ink-muted` `text-accent` `border-line` `rounded-card` `shadow-card`），不再出现硬编码 `bg-zinc-950` / `text-amber-600` / `bg-indigo-600`。toggle 翻转根节点 `[data-theme]`，token 自动换值。

### 4.1 颜色（修订 `src/styles/tokens.css`）

| Token | light | dark | 备注 |
|---|---|---|---|
| `--bg` | `#f3f4f6` | `#09090b` | 页面底 |
| `--bg-raised` | `#ffffff` | `#18181b` | 卡片/面板 |
| `--bg-sunken` | `#e5e7eb` | `#050506` | ✱ 改掉纯黑 `#000000` |
| `--ink` / `--ink-muted` / `--ink-faint` | `#18181b` / `#52525b` / `#a1a1aa` | `#fafafa` / `#a1a1aa` / `#71717a` | 文字三级 |
| `--border` / `--border-strong` | `#e4e4e7` / `#d4d4d8` | `#27272a` / `#3f3f46` | 边框两级 |
| `--accent` | `#0a84ff` | `#d97706` | 唯一品牌强调色 |
| `--accent-hover` / `--accent-soft` | `#0070e0` / `#dbeafe` | `#b45309` / `#78350f` | |
| `--danger` / `--success` / `--warning` | `#ef4444` / `#10b981` / `#f59e0b` | 同左（深色亮度可 +5%） | **UI 语义**，全站一致 |
| `--market-up` / `--market-down` | `#ef4444` / `#10b981` | 同左 | ✱ **A 股语义**（红涨绿跌），仅股票模块，与 UI 语义解耦 |
| `--shadow-card` / `--shadow-pop` | 阴影染**蓝**微调 | 阴影染**暖**微调 | ✱ 不用纯黑投影 |

✱ = 相对现状的修订点。新增 `--market-up/down` token，股票模块从硬编码 `#22c55e/#ef4444` 切换为引用它。

### 4.2 圆角阶梯（SHAPE LOCK）

四档封顶，全站仅用这四个；审计 `grep 'rounded-\['` 必须归零。容器圆角 ≥ 内部元素圆角。

| 类 | 值 | 用途 |
|---|---|---|
| `rounded-input` | 8px | 输入框、小徽章 |
| `rounded-button` | 10px | 按钮 |
| `rounded-card` | 16px | 卡片/面板/模态/气泡 |
| `rounded-pill` | 9999px | 胶囊/头像/圆点 |

在 `tailwind.config.js` 的 `borderRadius` 增补 `input`，并把现有任意值与 `rounded-lg/xl/2xl` 收敛到这四档。

### 4.3 字体与字号阶梯

保留 `SF Pro Display/Text + PingFang SC`（合规：taste-skill 只劝退 Inter 默认）。新增语义阶梯与数据对齐：

- Display（页面主标题）：`text-3xl md:text-4xl font-semibold tracking-tight`，`--font-display`
- Title（区块标题）：`text-xl font-semibold`
- Body：`text-sm md:text-base text-ink-muted leading-relaxed`
- Label/Eyebrow：`text-xs uppercase tracking-wide text-ink-faint`（每 3 区块 ≤ 1 个 eyebrow）
- 数据/数字：追加 `tabular-nums`（股价、胜率、倒计时、票数）
- 字重收敛到 `400 / 500 / 600`；弃用满屏 `font-black`（仅游戏「GAME OVER」等戏剧时刻例外保留）

## 5. 主题切换架构（方案 A）

- `src/shell/ThemeScope.jsx` 在模块根节点写 `[data-theme]`。
- 新增全局 `ThemeToggle`（顶部/设置入口），写入 `localStorage` key（如 `ui-theme`：`light | dark | system`，默认 `system`）。
- 解析优先级：**用户显式偏好 > 模块默认主题（ModuleRegistry 声明）> 系统 `prefers-color-scheme`**。
- 狼人杀模块默认 `dark`；生产力模块默认 `light`。用户一旦手动 toggle，则覆盖全站模块默认。
- 切换时为根节点加 `transition: background-color/color 200ms`，避免闪烁；首帧用内联脚本提前设属性，避免 FOUC。

## 6. 逐模块打磨清单（taste-skill 审计落地）

对每个模块统一执行（taste-skill Fix Priority：字体 → 颜色 → 状态 → 布局间距 → 组件 → 状态 → 字号）：

1. **颜色 token 化**：硬编码色 → token 类；`.mac-*` CSS 改为引用 `var(--*)`（一次性覆盖所有 mac 组件）。
2. **圆角收敛**：任意值与 `rounded-lg/xl/2xl` → 四档 token。
3. **交互全态**：补 `hover`（背景位移/轻微 scale）、`active`（`-translate-y-[1px]` 或 `scale-[0.98]`）、`focus-visible` 焦点环、`loading`（骨架屏而非转圈）、`empty`（构图化空态）、`error`（行内，非 `alert()`）。
4. **响应式**：见第 7 节，每个多列布局显式声明 `<768px` 塌缩。
5. **a11y**：按钮文字对比度 ≥ WCAG AA；触控目标 ≥ 44px；表单 label 在 input 之上。

### 模块专项

- **狼人杀**（GameArena / CirclePlayerLayout / ActionPanel / SetupScreen / VotePanel / SpeechBubble）：颜色 token 化是重灾区（当前 ~5%）；角色/阶段语义色（狼=danger、预言家=accent/info、女巫=warning…）映射到 token，不再裸用 amber/indigo/emerald/rose；手机端布局重做（第 7 节）。
- **首页/Dashboard**：`.mac-*` token 化后即适配双主题；卡片墙间距与圆角统一。
- **认证**：表单 label-above-input、焦点环、行内错误、对比度。
- **小说**：响应式已较好，主要做颜色 token 化与圆角收敛。
- **聊天**：token 化 + 双主题验证。
- **弦谱**：能量徽章内联色 → token；圆角收敛。
- **股票**：✱ 修复主题倒错——尊重 ThemeScope，深色卡片改用 `bg-bg-raised`；涨跌色改用 `--market-up/down`；移动端卡片刚性宽度 `min-w-[…]` 改弹性。

## 7. 响应式 / 移动端策略

- 全局：禁用 `h-screen` 满高 → `min-h-[100dvh]`（taste-skill 视口稳定）；多列优先 CSS Grid 而非 flex 百分比数学；标准断点 `sm640 md768 lg1024 xl1280`。
- **狼人杀圆桌**（核心）：
  - 桌面/平板（≥640px）：保留圆形牌桌布局。
  - 手机（<640px）：替换 `scale(0.6)` 硬缩放为**真实移动布局**——玩家紧凑卡片网格（2–3 列）+ 底部固定行动抽屉（夜间行动/投票按钮），复用同一 `PlayerCard`。发言气泡改为顶部滚动条或行内。
  - 移除 CSS-only media query 缩放，迁移为 Tailwind 响应式类，逻辑可读可测。
- 触控目标 ≥ 44px；可点击玩家卡在手机上有足够间距防误触。

## 8. 实施分期

- **Phase F — 地基**：修订 `tokens.css`（3 处✱）；`tailwind.config.js` 增 `rounded-input` 与字号/`tabular-nums` 工具；`legacy-mac.css` 全量 token 驱动；实现 `ThemeToggle` + 持久化 + 模块默认主题解析 + 防 FOUC；审计 `src/ui/*` 9 个原语确保 100% token。
- **Phase M1 — 狼人杀（旗舰）**：颜色 token 化 + 移动端圆桌重做 + 交互全态。
- **Phase M2 — 首页 + 认证**：高频入口，`.mac-*` 验证 + 表单态。
- **Phase M3 — 小说 + 聊天**。
- **Phase M4 — 弦谱 + 股票**（含股票主题倒错修复 + market token）。
- **Phase V — 验收**：见第 9 节。

每个 Phase：`npm run build` 通过 → 无功能回归 → 原子提交 → `CHANGELOG.md` 顶部记录。

## 9. 验收标准（taste-skill Pre-Flight + 项目守门）

- `npm run build` 通过；`scripts/check-build.mjs` 无 localhost 泄漏。
- 审计归零：`grep -r 'rounded-\[' src/components`（圆角任意值）= 0；业务组件中硬编码 `bg-zinc-/text-amber-/bg-indigo-/bg-emerald-/bg-rose-` 等品牌色 ≈ 0（语义/市场色经 token）。
- 双主题：每个模块在 light 与 dark 下均无对比度失败、无主题倒错区块（taste-skill Theme Lock）。
- 响应式：用 `/browse` 在桌面（1440）与手机（390）两视口对每个模块截图，无溢出/重叠/不可点；狼人杀手机端可正常完成一局关键操作。
- 交互态：关键按钮具备 hover/active/focus；主要异步区有 loading/empty/error。
- 颜色一致性锁：全站单一强调色（按主题）；语义色统一；市场色仅股票。

## 10. 不在本次范围（YAGNI）

- 不做 `.mac-*` → `<Button>/<Card>` 的全量 JSX codemod（Phase 5 留待后续）。
- 不引入动画库（Motion/Framer）；动效用 CSS transition 即可满足当前档位。
- 不改后端、不改游戏逻辑/状态机、不动 Workers/ECS。
- 不替换字体（保留 SF Pro + PingFang）。

## 11. 风险与缓解

- **回归风险（全模块面广）**：分期 + 每 Phase 后 build + browse 双视口截图比对；改动以 className 替换为主，结构尽量不动。
- **`.mac-*` token 化可能影响浅色既有观感**：先在 Phase F 单独验证 mac 组件双主题，再推模块。
- **狼人杀移动端重做是唯一结构性改动**：隔离为独立子任务，桌面布局零改动，移动布局加在响应式分支内。
