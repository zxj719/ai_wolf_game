# UI 重构 M1b（狼人杀手机端重做）设计与实施方案

> 本文是**设计 + 架构方案**（非纯机械任务）。实施时实现者需先通读 `CirclePlayerLayout.jsx` 全文以补齐每个动作按钮/发言的接线细节。建议在**全新会话**执行以保证质量（结构性改动、~900 行有状态组件）。

**Goal:** 手机端（<640px）用「**玩家卡片网格 + 底部固定行动抽屉**」取代当前 `.circle-layout { transform: scale(0.6) }` 硬缩放；桌面/平板（≥640px）圆桌**零改动**。复用现有所有动作处理器、投票流程、夜间行动状态、发言逻辑，不改游戏状态机。

**已定布局决策（用户确认）：** 卡片网格 + 底部行动抽屉。手机上玩家排成 2–3 列紧凑卡片网格；夜间行动/投票/确认按钮固定在屏幕底部的抽屉里（拇指可达）；发言气泡走顶部可滚动条。

## 现状结构（已读）
- `CirclePlayerLayout.jsx`：容器 `relative w-full aspect-square max-w-5xl`（431 行）；中心阶段面板绝对居中（433–439）；玩家用 `getPlayerPosition(index,total)`（268–273：angle→x/y 百分比）**绝对定位**环绕。
- 每玩家卡片含：角色图标（`getRoleIcon`，已 token 化）、`findCardIndicator`（夜间行动徽章）、`findVoteIndicator`（投票徽章）、存活/死亡/选中/发言态样式。
- 选中、发言、死亡态已在 M1a token 化（`ring-state-selected-soft`、`ring-state-speaking`、grayscale）。
- resize 监听（262）+ ResizeObserver（259）驱动 `layoutStyle`（CSS 变量 `--panel-size`/`--icon-size` 等）。
- 缩放 hack 在 `src/styles/game-animations.css:133-142`（768px→0.8，640px→0.6，作用于 `.circle-layout`）。

## 架构方案

### 1. 视口判定 hook
新建 `src/hooks/useIsMobile.js`：`matchMedia('(max-width: 639px)')` + resize 监听，返回布尔。SSR 安全（默认 false）。单测：mock matchMedia。

### 2. 组件拆分（从 CirclePlayerLayout 抽出可复用单元）
当前 CirclePlayerLayout 一个文件做太多事。M1b 抽出：
- `PlayerCard.jsx`（无定位的纯卡片：图标/编号/名字/角色/徽章/存活态/点击）——桌面圆桌与手机网格**共用**。圆桌负责绝对定位的外壳，网格负责 grid 单元的外壳，内部都渲染 `<PlayerCard>`。这样去重并让两套布局视觉一致。
- `MobilePlayerGrid.jsx`：`grid grid-cols-2 xs:grid-cols-3 gap-2`，map 玩家 → `<PlayerCard>`；中心阶段信息移到网格上方的紧凑条（phase pill）。
- `MobileActionDrawer.jsx`：`fixed bottom-0 inset-x-0 z-40` 抽屉，含安全区 `pb-[env(safe-area-inset-bottom)]`；根据当前 phase/角色渲染对应行动按钮（夜间行动/投票/确认/弃票/猎人开枪等）——**复用 CirclePlayerLayout 现有的按钮 onClick 处理器与禁用逻辑**，只是换容器。触控目标 ≥44px。
- 发言：手机端 `SpeechBubble` 改为顶部 `overflow-x-auto` 横向条或贴在被选玩家卡上方（实现时定）。

### 3. 渲染分流
CirclePlayerLayout 顶部 `const isMobile = useIsMobile();`：
```jsx
if (isMobile) {
  return <MobilePlayerGrid ...sharedProps /> + <MobileActionDrawer ...sharedHandlers />;
}
// 否则现有圆桌 render 原样不动
```
所有 props/handlers/state 来自同一父级，不复制状态。

### 4. 清理
删除 `game-animations.css:133-142` 的 `.circle-layout` 640px scale(0.6)（被网格取代）；768px→0.8 可保留（平板圆桌缩放仍合理）或调整。

## 实施任务（执行会话细化为 bite-sized）
1. `useIsMobile` hook + 单测。
2. 抽 `PlayerCard.jsx`（从圆桌内联卡片提取，桌面改用它，视觉零变化 + 测试快照）。
3. `MobilePlayerGrid.jsx`。
4. `MobileActionDrawer.jsx`（复用按钮处理器）。
5. CirclePlayerLayout 渲染分流 + 发言手机化。
6. 删除 scale(0.6) hack。
7. 验收：build + 测试；`/browse`（或本地）在 390×844 跑一局游客对局，确认网格可点、抽屉按钮可操作、夜间选中青色可见、无溢出；桌面 1440 圆桌**零回归**（截图对比）。

## 风险
- 最高风险任务（结构性、有状态、~900 行）。缓解：先抽 `PlayerCard` 让桌面零视觉变化（可截图回归），再加手机分支；手机分支是**新增代码路径**，桌面 render 一行不改。
- 发言在手机的位置需实现时迭代（顶部条 vs 贴卡），留给执行会话定。

## DoD
- 手机 <640px：卡片网格 + 底部抽屉可完整玩一局；触控目标 ≥44px；选中态可见。
- 桌面 ≥640px：圆桌零回归（截图对比一致）。
- build + 258+ 测试全绿；`.circle-layout` scale(0.6) hack 移除。
