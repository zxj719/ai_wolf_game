# Zhaxiaoji Studio

本仓库已经从单一的 “Werewolf Pro” 游戏首页演化为一个**模块化个人主页平台**：以个人主页为壳，围绕 AI 狼人杀、小说工作台、和声实验、行情实验等多个并列模块组合。所有模块共享同一个登录态、同一个 i18n 语言切换、同一套 UI 基线，并通过 `ModuleRegistry` 注册到统一的 Router。

前端基于 `React 18 + Vite + TailwindCSS`，公开站点统一域名 `https://zhaxiaoji.com`，背后由 **两个后端** 共同支撑：

- **Cloudflare Workers + D1**：认证、用户数据、战绩、对局日志（`workers/auth/`）
- **Node Express + better-sqlite3**：行为树决策、LLM 润色、狼人会话代理、小说 Codex 工作流（`server/`，包名 `@wolfgame/bt-server`）

## 当前路由

路由按"模块平级"组织：所有模块都是 `/<module>`，旧路径（`/home`、`/wolfgame*`）通过 `LEGACY_PATH_MAP` 自动 301 到新路径。

| 路由 | 访问级别 | 说明 |
|------|----------|------|
| `/` | 公开 | 个人主页，自动汇总所有 `home.visible` 模块卡片 |
| `/login` · `/reset-password` · `/verify-email` | 公开 | 登录 / 注册 / 重置密码 / 邮箱验证 |
| `/werewolf` | 公开 | 狼人杀模块入口（hub） |
| `/werewolf/setup` | 登录 | 对局配置页 |
| `/werewolf/play` | 登录 | 对局主舞台 |
| `/novel` | 登录 | Meta Writing 小说工作台 + Codex 生成工作流 |
| `/sites` | 公开 | Projects & Labs Hub（行情/和声等实验入口） |
| `/chords` | 公开 | 和声分析实验 |
| `/stock` | 公开 | 实时行情 / 自选股 / 纸交易实验 |
| `/blog` | 公开 | 静态站入口 |

旧路径兼容映射在 [src/shell/paths.js](src/shell/paths.js)，路由匹配在 [src/shell/Router.jsx](src/shell/Router.jsx)。

## 架构概览

### 0. 应用根（Shell）

- [src/main.jsx](src/main.jsx) — React 挂载点，包裹 `ErrorBoundary` + `AuthProvider` + `AppShell`
- [src/AppShell.jsx](src/AppShell.jsx) — 应用根。组合 `ShellProvider` / `Router` / `GlobalOverlays`，**对任何具体模块一无所知**
- [src/shell/ModuleRegistry.js](src/shell/ModuleRegistry.js) — 模块总线，按顺序注册 `home / auth / werewolf / novel / sites`；`findRoute()` 按路径找模块，`homeCards()` 给首页生成卡片
- [src/shell/Router.jsx](src/shell/Router.jsx) — 单源路由器，处理懒加载、`requiresAuth` 守卫、`LEGACY_PATH_MAP` 重写
- [src/shell/ShellProvider.jsx](src/shell/ShellProvider.jsx) / [ShellContext.js](src/shell/ShellContext.js) — 跨模块共享：当前 `locale`、`auth`、`navigate`、`endGame` 等
- [src/shell/GlobalOverlays.jsx](src/shell/GlobalOverlays.jsx) — 跨模块浮层（当前承载 `LanguageToggle`）
- [src/shell/paths.js](src/shell/paths.js) — 路由常量、`AUTH_PATHS`、`LEGACY_PATH_MAP`、`normalizePath()`
- [src/shell/navGuards.js](src/shell/navGuards.js) — 守卫策略
- [src/shell/useAuthNav.js](src/shell/useAuthNav.js) / [useDocumentMeta.js](src/shell/useDocumentMeta.js) — 登录跳转与 SEO meta 注入

### 1. 模块层（modules/）

每个模块就是一个目录 + 一个默认导出的 `ModuleDescriptor`。新增模块 = 1 个目录 + 在 `ModuleRegistry` 里加一行。

```js
// modules/<name>/index.js
export default {
  id: 'werewolf',
  title: { zh: '狼人杀', en: 'Werewolf' },
  blurb: { zh: '...', en: '...' },
  theme: 'dark',                // 'light' | 'dark'
  backend: 'cf-workers',        // 用于 services/api/registry 路由
  routes: [{ path, component, requiresAuth }],
  home: { visible: true, order: 10 },
};
```

| 模块 | 描述符 | 主组件 |
|------|--------|--------|
| `home` | [src/modules/home/index.js](src/modules/home/index.js) | [HomeRoute.jsx](src/modules/home/HomeRoute.jsx) → [Dashboard.jsx](src/components/Dashboard.jsx) |
| `auth` | [src/modules/auth/index.js](src/modules/auth/index.js) | [AuthRoute.jsx](src/modules/auth/AuthRoute.jsx) → `components/Auth/*` |
| `werewolf` | [src/modules/werewolf/index.js](src/modules/werewolf/index.js) | [WerewolfModule.jsx](src/modules/werewolf/WerewolfModule.jsx) — 跨 hub/setup/play 共享 instance，跨路径不 unmount |
| `novel` | [src/modules/novel/index.js](src/modules/novel/index.js) | [NovelRoute.jsx](src/modules/novel/NovelRoute.jsx) → [NovelWorkspace.jsx](src/components/NovelWorkspace.jsx) |
| `sites` | [src/modules/sites/index.js](src/modules/sites/index.js) | [SitesRoute.jsx](src/modules/sites/SitesRoute.jsx) → [SitesPage.jsx](src/components/SitesPage.jsx) |

`title` / `blurb` 是 `{ zh, en }`，i18n 通过 ShellContext 注入。

### 2. i18n

会话级语言切换（中文 / English），状态持久化到 `localStorage`，模块组件自行从 `useShell()` 读取。

- [src/i18n/locale.js](src/i18n/locale.js) — 语言常量、角色 / 胜利模式翻译表、`SUPPORTED_LOCALES`
- [src/components/LanguageToggle.jsx](src/components/LanguageToggle.jsx) — 全局语言切换（挂在 `GlobalOverlays`）
- 模块描述符 `title.zh/en` & `blurb.zh/en` 直接被 `Dashboard` 卡片墙读取

### 3. 狼人杀模块（核心可玩功能）

游戏内核仍由 `useWerewolfGame` reducer 驱动；夜晚 / 白天 / 发言被拆成独立 hook。

- [src/components/SetupScreen.jsx](src/components/SetupScreen.jsx) — 模式 / 角色 / 阵容配置
- [src/components/GameArena.jsx](src/components/GameArena.jsx) — 对局主舞台
- [src/useWerewolfGame.js](src/useWerewolfGame.js) — 核心 reducer
- [src/hooks/useDayFlow.js](src/hooks/useDayFlow.js) — 白天发言 / 投票 / 放逐 / 猎人开枪 / 进入下一夜
- [src/hooks/useNightFlow.js](src/hooks/useNightFlow.js) — 守卫 / 狼人 / 预言家 / 女巫等夜间结算
- [src/hooks/useSpeechFlow.js](src/hooks/useSpeechFlow.js) — 发言阶段推进
- [src/hooks/useGameLifecycle.js](src/hooks/useGameLifecycle.js) — 请求中断 / 战绩落库等外围

### 4. AI 与决策层

AI 已从"前端直连 LLM"演进为**两段式管线**：行为树决定结构化动作 → LLM 润色成自然语言。

- 决策核心 [src/services/decisionEngine/](src/services/decisionEngine) — 行为树 `BehaviorTree`、`buildBlackboard`、按角色拆分的 trees（`werewolf/`、`seer/`、`witch/`、`hunter/`、`guard/`、`villager/`）
- 不变量 / 快照 [src/services/gameInvariants.js](src/services/gameInvariants.js) · [snapshotBuilder.js](src/services/snapshotBuilder.js) · [werewolfGameSnapshot.js](src/services/werewolfGameSnapshot.js)
- 动作队列 [src/services/actionQueue.js](src/services/actionQueue.js) — 幂等动作队列
- 提示词 [src/services/aiPrompts.js](src/services/aiPrompts.js) · [polishPrompts.js](src/services/polishPrompts.js) · [promptFactory.js](src/services/promptFactory.js) · [rolePrompts/](src/services/rolePrompts)
- 信任与推理 [trustScoring.js](src/services/trustScoring.js) · [bayesianInference.js](src/services/bayesianInference.js) · [deceptionDetection.js](src/services/deceptionDetection.js) · [dualSystem.js](src/services/dualSystem.js)
- 校验 / 清洗 [logicValidator.js](src/services/logicValidator.js) · [identityTableSanitizer.js](src/services/identityTableSanitizer.js) · [speechSummarizer.js](src/services/speechSummarizer.js) · [publicFacts.js](src/services/publicFacts.js)
- LLM 客户端 [aiClient.js](src/services/aiClient.js) · [btClient.js](src/services/btClient.js) · [werewolfAITransport.js](src/services/werewolfAITransport.js) · [werewolfSessionClient.js](src/services/werewolfSessionClient.js)
- AI Hook [src/hooks/useAI.js](src/hooks/useAI.js) · [useAIModels.js](src/hooks/useAIModels.js)

### 5. UI 基线 & pretext 排版

- [src/ui/](src/ui) — 共享 UI kit：`Button` / `Card` / `Input` / `Modal` / `PageShell` / `Toolbar` / `Spinner` / `Skeleton` / `Badge`
- [src/index.css](src/index.css) · [src/styles/](src/styles) — 纸感视觉系统 / `mac-segmented-control` / `paper-panel` 等
- [src/components/home/](src/components/home) — pretext 首页组件（`BalancedHeadline` / `IdeaMasonry` / `HomePortalCard`）
- [src/hooks/useBalancedHeadline.js](src/hooks/useBalancedHeadline.js) · [useElementWidth.js](src/hooks/useElementWidth.js)

## 后端

### Cloudflare Workers — 认证 / 数据

- [workers/auth/index.js](workers/auth/index.js) — Worker 路由入口
- [workers/auth/handlers.js](workers/auth/handlers.js) — 认证、用户、token、战绩、游戏日志的 API 处理
- [workers/auth/jwt.js](workers/auth/jwt.js) · [password.js](workers/auth/password.js) · [middleware.js](workers/auth/middleware.js) · [email.js](workers/auth/email.js)
- [wrangler.toml](wrangler.toml) — `main = "workers/auth/index.js"`，`[assets]` 同时发布 `dist/` 静态资源
- 数据库 schema 见 [schema.sql](schema.sql) / [migrations/](migrations)
- 前端调用：[src/services/authService.js](src/services/authService.js) · [gameService.js](src/services/gameService.js) · [submitGameLog.js](src/services/submitGameLog.js)

### Node Express — 行为树 / Codex / 会话代理（`server/`）

包名 `@wolfgame/bt-server`，依赖 `express + cors + better-sqlite3`，独立版本号，由 `npm run bt:patch` / `bt:minor` bump。

- [server/index.js](server/index.js) — Express 入口，挂载 `/bt/decide`、`/bt/wolf-speech`、`/bt/game/*`、`/bt/stats`、`/bt/export`、`/health`
- [server/db.js](server/db.js) — `better-sqlite3` 持久化（按版本统计胜率，导出对局日志）
- [server/werewolfSession.js](server/werewolfSession.js) — 狼人会话 AI 代理（隔离每个会话的私有上下文）
- [server/novelWorkspace.js](server/novelWorkspace.js) — `/novel/*` 接口：项目 / 章节读写、Codex 子进程调度（`spawn` 调用本地 `codex exec --full-auto`）
- 前端调用：[src/services/novelService.js](src/services/novelService.js) · [btClient.js](src/services/btClient.js) · [werewolfSessionClient.js](src/services/werewolfSessionClient.js)
- 进程管理：[ecosystem.config.cjs](ecosystem.config.cjs)（`pm2 start ecosystem.config.cjs`）

## 仓库内的次级子系统

- [src/components/Stock/](src/components/Stock) — 实时行情 / 自选股 / 深度 / 纸交易实验，从 `/sites` 与 `/stock` 进入
- [src/components/ChordsPage.jsx](src/components/ChordsPage.jsx) + [src/services/chordsAnalysis.js](src/services/chordsAnalysis.js) · [chordsService.js](src/services/chordsService.js) — 和声分析实验
- [src/agents/](src/agents) — `reviewPipeline` / `promptEngineer` / `bugHunter` / `testWriter` / `headlessGame` 等离线 agent
- [src/knowledge/](src/knowledge) — `case_library/` / `versions/` / `successful_prompts.json` / `model_weaknesses.json` 等评审产物

这些子系统不在主路径主叙事中，但仍由仓库维护。

## 当前目录地图

```text
src/
├── main.jsx                         # React 挂载点
├── AppShell.jsx                     # 应用根（ShellProvider + Router + GlobalOverlays）
├── shell/                           # 应用壳层（Router、ModuleRegistry、ShellContext...）
├── modules/                         # 模块描述符 + 入口路由
│   ├── home/  auth/  werewolf/  novel/  sites/
├── components/                      # 业务组件（GameArena / NovelWorkspace / Dashboard...）
│   └── home/                        # pretext 首页组件
├── ui/                              # 共享 UI kit（Button/Card/Modal/PageShell...）
├── i18n/                            # locale 常量 + 角色翻译表
├── hooks/                           # useAI / useDayFlow / useNightFlow / ...
├── services/                        # 服务层
│   ├── decisionEngine/              # 行为树决策核心
│   ├── rolePrompts/                 # 角色级提示词
│   ├── api/                         # backend registry / fetch wrapper
│   └── *.js                         # 信任、推理、不变量、快照、动作队列、客户端...
├── contexts/AuthContext.jsx
├── config/  selectors/  utils/  styles/
├── agents/                          # 离线评审 / 测试 / 提示词工程 agent
├── knowledge/                       # case library / versions / 模型弱点知识
└── useWerewolfGame.js               # 核心游戏 reducer

server/                              # Node Express BT + Codex 后端（@wolfgame/bt-server）
├── index.js  db.js  werewolfSession.js  novelWorkspace.js
└── __tests__/

workers/auth/                        # Cloudflare Workers 认证 / D1 后端
ecosystem.config.cjs                 # pm2 进程编排
wrangler.toml  schema.sql  migrations/
```

## 运行命令

```bash
# 前端
npm.cmd run dev                # vite dev server
npm.cmd run build              # 产出 dist/
npm.cmd run preview            # 本地预览构建产物
npm.cmd run lint               # eslint
npm.cmd run test               # vitest run
npm.cmd run test:watch         # vitest --watch

# Cloudflare Workers
npm.cmd run dev:worker         # wrangler dev
npm.cmd run deploy             # wrangler deploy --assets ./dist

# Node BT/Codex 后端（server/）
node server/index.js           # 直接启动
pm2 start ecosystem.config.cjs # 生产部署
npm.cmd run bt:patch           # server/package.json 版本 patch
npm.cmd run bt:minor           # server/package.json 版本 minor

# 离线分析
npm.cmd run analyze            # scripts/analyze-games.js
npm.cmd run analyze:stats
```

## 当前测试

仓库分布在多个层级的自动化验证：

- 前端：[src/utils/__tests__/](src/utils/__tests__) · [src/services/__tests__/](src/services/__tests__) · [src/components/__tests__/](src/components/__tests__) · [src/i18n/__tests__/](src/i18n/__tests__)
- Agent 共享层：[src/agents/shared/__tests__/](src/agents/shared/__tests__)
- Node 后端：[server/__tests__/](server/__tests__)

## 域名与数据库唯一性（必须遵守）

- 线上统一域名：`https://zhaxiaoji.com`
- 前端 `VITE_AUTH_API_URL` 必须指向 `https://zhaxiaoji.com`（或同域）
- **禁止**任何 `*.workers.dev` 作为线上 API 入口，确保 D1 绑定唯一

## 说明

- 主页、狼人杀、Projects & Labs、小说工作台已完成模块化迁移；新增模块只需 `modules/<name>/` + `ModuleRegistry` 一行
- 路由旧路径（`/home`、`/wolfgame*`）仍可访问，由 `LEGACY_PATH_MAP` 重写到新路径，Phase 5 后将移除
- 狼人杀排行榜前端入口已移除，不再作为公开入口
- 仓库内仍保留 agent / knowledge / 实验性认知架构等历史产物，不在主路径主叙事中
