# Zhaxiaoji Studio

当前仓库已经不是单一的 “Werewolf Pro” 游戏首页，而是一个以个人主页为外壳、以 AI 狼人杀为核心可玩模块、并保留 Projects & Labs 入口的混合型站点。

前端基于 `React 18 + Vite`，公开站点与 Cloudflare Workers 后端共用 `https://zhaxiaoji.com` 域名。首页、狼人杀模块页和项目实验页已经完成信息架构重组；狼人杀排行榜前端入口已移除。

## 当前路由

| 路由 | 访问级别 | 说明 |
|------|----------|------|
| `/home` | 公开 | 个人主页，聚合狼人杀入口、Projects & Labs、静态站入口 |
| `/wolfgame` | 公开 | 狼人杀模块页，解释玩法、游客试玩、登录与记录能力 |
| `/wolfgame/custom` | 游客或登录 | 对局设置页 |
| `/wolfgame/play` | 游客或登录 | 对局页 |
| `/sites` | 公开 | Projects & Labs Hub，承载静态站与实时行情实验 |
| `/login` | 公开 | 登录 / 注册入口 |
| `/reset-password` | 公开 | 重置密码 |
| `/verify-email` | 公开 | 验证邮箱 |

路由守卫逻辑在 [src/hooks/useAppRouter.js](src/hooks/useAppRouter.js)。

## 架构概览

### 1. 应用壳层

- [src/App.jsx](src/App.jsx)
  - 应用组合根。
  - 负责懒加载页面组件、设置 SEO meta、衔接认证态和游客态。
  - 通过 `useAppRouter` 管理公开页、私有页和狼人杀流程页切换。
  - 在对局结束后保存战绩、提交完整游戏日志。

- [src/hooks/useAppRouter.js](src/hooks/useAppRouter.js)
  - 定义所有前端路由常量。
  - 区分 `PUBLIC_ROUTES` 和 `PRIVATE_ROUTES`。
  - 处理 `/` 到 `/home` 的归一化、未授权访问拦截、从公开页返回时自动结束游戏。

- [src/contexts/AuthContext.jsx](src/contexts/AuthContext.jsx)
  - 管理 JWT 登录态、用户信息、ModelScope token 状态。
  - 提供注册、登录、登出、更新资料、保存 / 验证 ModelScope token 等能力。

### 2. 公开页面层

- [src/components/Dashboard.jsx](src/components/Dashboard.jsx)
  - 公开首页。
  - 使用 `@chenglou/pretext` 相关组件重做排版。
  - 负责展示个人主页 hero、狼人杀入口、Projects & Labs 入口、登录 / 游客入口、个人战绩 / token 管理入口。

- [src/components/WolfgameHub.jsx](src/components/WolfgameHub.jsx)
  - 公开狼人杀模块页。
  - 说明 `/wolfgame`、`/wolfgame/custom`、`/wolfgame/play` 的入口关系。
  - 承担游客试玩、登录、查看战绩、配置 token 的聚合入口。

- [src/components/SitesPage.jsx](src/components/SitesPage.jsx)
  - Projects & Labs Hub。
  - 当前承载静态个人站入口和实时行情实验入口。
  - 行情实验进一步落到 `src/components/Stock/*`。

### 3. 狼人杀游戏层

- [src/components/SetupScreen.jsx](src/components/SetupScreen.jsx)
  - 对局配置页。
  - 负责模式选择、角色选择、自定义阵容、胜利条件等设置。

- [src/components/GameArena.jsx](src/components/GameArena.jsx)
  - 对局主舞台。
  - 组合头部、玩家视图、发言、行动、投票、日志、历史等子组件。

- [src/useWerewolfGame.js](src/useWerewolfGame.js)
  - 核心 reducer。
  - 维护 `phase`、`nightStep`、`players`、`speechHistory`、`voteHistory`、`deathHistory`、`nightActionHistory`、`modelUsage` 等全局游戏状态。

- [src/hooks/useDayFlow.js](src/hooks/useDayFlow.js)
  - 白天流程控制。
  - 负责发言顺序、投票、放逐、猎人开枪和进入下一夜。

- [src/hooks/useNightFlow.js](src/hooks/useNightFlow.js)
  - 夜晚流程控制。
  - 负责守卫、狼人、预言家、女巫等夜间行动推进与结算。

- [src/hooks/useSpeechFlow.js](src/hooks/useSpeechFlow.js)
  - 发言相关交互控制。
  - 负责用户发言、AI 发言、对决发言与阶段推进。

- [src/hooks/useGameLifecycle.js](src/hooks/useGameLifecycle.js)
  - 生命周期辅助逻辑。
  - 负责请求中断、记录保存等外围行为。

### 4. AI 与提示词层

- [src/hooks/useAI.js](src/hooks/useAI.js)
  - AI 调用统一入口。
  - 组装当前局面上下文，向模型发起请求，并跟踪模型使用情况。

- [src/hooks/useAIModels.js](src/hooks/useAIModels.js)
  - 模型列表与禁用模型追踪。

- [src/services/aiClient.js](src/services/aiClient.js)
  - 与上游 LLM API 交互的低层客户端。

- [src/services/aiPrompts.js](src/services/aiPrompts.js)
  - 狼人杀主提示词模板与约束。

- [src/services/rolePrompts/*](src/services/rolePrompts)
  - 按角色拆分的补充提示词。

- [src/services/identityTableSanitizer.js](src/services/identityTableSanitizer.js)
  - 清洗和约束模型返回的身份推理表。

- [src/services/logicValidator.js](src/services/logicValidator.js)
  - 规则一致性与行为合法性校验。

项目里还保留了更早期的认知架构和实验组件，例如：

- `src/services/bayesianInference.js`
- `src/services/deceptionDetection.js`
- `src/services/dualSystem.js`
- `src/hooks/useDualSystem.js`
- `src/hooks/useTrustInference.js`

这些能力仍在仓库中，但当前首页重构不以它们为主叙事。

### 5. pretext 前端排版层

- [src/components/home/BalancedHeadline.jsx](src/components/home/BalancedHeadline.jsx)
  - 基于 `pretext` 做标题平衡换行。

- [src/components/home/IdeaMasonry.jsx](src/components/home/IdeaMasonry.jsx)
  - 用 `pretext` 测量文本高度，生成更稳定的卡片栅格。

- [src/components/home/HomePortalCard.jsx](src/components/home/HomePortalCard.jsx)
  - 首页和狼人杀模块页共享的入口卡片。

- [src/hooks/useBalancedHeadline.js](src/hooks/useBalancedHeadline.js)
  - `BalancedHeadline` 的布局计算 hook。

- [src/hooks/useElementWidth.js](src/hooks/useElementWidth.js)
  - 观察元素宽度，为 `pretext` 计算提供输入。

- [src/index.css](src/index.css)
  - 全局视觉基线。
  - 当前已包含 `Zhaxiaoji Studio` 的纸感背景、`page-orbit`、`paper-panel`、字体变量等视觉系统。

## 后端与部署

- [workers/auth/index.js](workers/auth/index.js)
  - Cloudflare Workers 入口。

- [workers/auth/handlers.js](workers/auth/handlers.js)
  - 认证相关业务 handler。

- [workers/auth/jwt.js](workers/auth/jwt.js)
  - JWT 生成与校验。

- [workers/auth/password.js](workers/auth/password.js)
  - 密码处理。

- [workers/auth/email.js](workers/auth/email.js)
  - 邮件相关流程。

- [workers/auth/middleware.js](workers/auth/middleware.js)
  - Worker 中间件。

- [wrangler.toml](wrangler.toml)
  - Cloudflare Workers 配置。
  - `main = "workers/auth/index.js"`，同时通过 `[assets]` 发布 `dist/` 静态资源。

## 数据与服务边界

- [src/services/authService.js](src/services/authService.js)
  - 前端对认证 Worker 的调用封装。

- [src/services/gameService.js](src/services/gameService.js)
  - 用户战绩读写接口。

- [src/services/submitGameLog.js](src/services/submitGameLog.js)
  - 对局结束后提交完整游戏日志，用于复盘 / 评审流水线。

- [src/utils/authToken.js](src/utils/authToken.js)
  - 本地 token 与用户缓存读写。

- [src/utils/exportGameLog.js](src/utils/exportGameLog.js)
  - 导出对局日志。

## 仓库里的次级子系统

当前仓库不只有主页和狼人杀，还包含两个相对独立的子系统：

- `src/components/Stock/*`
  - 实时行情 / 自选股 / 深度 / 纸交易实验。
  - 当前通过 `SitesPage` 进入，不在公开首页直接占主叙事。

- `src/agents/*`
  - review pipeline / prompt engineer / bug hunter / test writer 等 agent 实验。
  - 它们和本次主页重构不是同一条用户路径，但仍在仓库中。

## 当前目录地图

```text
src/
├── App.jsx                      # 应用壳层与页面装配
├── useWerewolfGame.js           # 核心游戏 reducer
├── contexts/
│   └── AuthContext.jsx          # 认证上下文
├── hooks/
│   ├── useAppRouter.js          # 前端路由与守卫
│   ├── useAI.js                 # AI 统一调用入口
│   ├── useAIModels.js           # 模型列表与禁用追踪
│   ├── useDayFlow.js            # 白天流程
│   ├── useNightFlow.js          # 夜晚流程
│   ├── useSpeechFlow.js         # 发言流程
│   ├── useGameLifecycle.js      # 生命周期外围逻辑
│   ├── useBalancedHeadline.js   # pretext 标题计算
│   └── useElementWidth.js       # 元素宽度测量
├── components/
│   ├── Dashboard.jsx            # 公开首页
│   ├── WolfgameHub.jsx          # 狼人杀模块页
│   ├── SitesPage.jsx            # Projects & Labs Hub
│   ├── SetupScreen.jsx          # 对局设置页
│   ├── GameArena.jsx            # 对局主舞台
│   ├── TokenManager.jsx         # token 管理弹层
│   ├── UserStats.jsx            # 用户战绩弹层
│   ├── home/                    # pretext 首页组件
│   ├── Stock/                   # 行情实验子系统
│   └── Auth/                    # 登录/注册/重置密码/验证邮箱
├── services/
│   ├── authService.js           # 认证 API
│   ├── gameService.js           # 战绩 API
│   ├── submitGameLog.js         # 对局日志提交
│   ├── aiClient.js              # LLM 客户端
│   ├── aiPrompts.js             # 主提示词
│   └── rolePrompts/             # 角色级提示词
├── config/
│   ├── aiConfig.js              # AI 服务配置
│   └── roles.js                 # 角色、阵容、胜利条件配置
└── utils/                       # 游戏/日志/认证辅助工具
```

## 运行命令

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run preview
npm.cmd run test
npm.cmd run deploy
```

## 当前测试

当前仓库至少有这几组自动化验证：

- [src/utils/__tests__/gameUtils.test.js](src/utils/__tests__/gameUtils.test.js)
- [src/services/__tests__/submitGameLog.test.js](src/services/__tests__/submitGameLog.test.js)
- [src/agents/shared/__tests__/validation.test.js](src/agents/shared/__tests__/validation.test.js)

## 说明

- 公开首页、狼人杀模块页和 Projects & Labs 已完成重构。
- 狼人杀排行榜前端已移除，不再作为公开入口的一部分。
- 原仓库可能仍有历史实验文件、知识库样本和 agent 产物；这些不影响当前主页 / 狼人杀 / Projects & Labs 的主路径结构。
