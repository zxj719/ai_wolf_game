# 变更日志 (Changelog)

本文件记录项目的重要变更，包括功能更新、Bug 修复和数据库迁移等。

## [2026-02-07] SPA 路由回退 + Changelog 编码修复

### 修复
- **/login 等前端路由返回 Not found**
  - Worker 非 `/api/*` 请求现在走静态资源并回退到 `/index.html`
- **Changelog 中文乱码**
  - 统一为 UTF-8 编码，中文正常显示
- **AI 模型排行榜筛选过长**
  - 移除“全部角色”选项
- **部署失败：_redirects 无限循环**
  - 移除 `public/_redirects`，改由 Worker 负责 SPA 回退
- **头像被数据库覆盖**
  - 已有开局头像时不再从数据库覆盖

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `workers/auth/index.js` | 修改 | 非 API 路由静态资源与 SPA 回退 |
| `CHANGELOG.md` | 修改 | UTF-8 编码修复 |
| `src/components/ModelLeaderboard.jsx` | 修改 | 移除“全部角色”筛选 |
| `public/_redirects` | 删除 | 避免 Cloudflare _redirects 规则循环 |
| `src/services/avatarService.js` | 修改 | 保留开局头像，不再覆盖 |

## [2026-02-06] 页面路由管理 + 退出即停机制

### 新功能
- **前端路由映射**
  - 登录页 `/login`、主页 `/home`、自定义局 `/wolfgame/custom`、对局 `/wolfgame/play`、博客 `/sites` 统一由 SPA 管理
  - 仪表盘“我的博客”入口切换为 `/sites` 内嵌展示
- **返回按钮覆盖**
  - 自定义局、对局、博客页新增“返回首页/返回登录”按钮
- **退出即停**
  - 离开对局页立即终止游戏并取消 API 请求

### 行为优化
- **AI 调用防护**
  - 增加 `gameActiveRef` 守卫，阻断退出后继续触发日/夜流程

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 增加路由状态、退出逻辑与返回按钮传递 |
| `src/components/Dashboard.jsx` | 修改 | 博客入口改为 `/sites` |
| `src/components/SetupScreen.jsx` | 修改 | 自定义界面新增返回按钮 |
| `src/components/GameArena.jsx` | 修改 | 对局界面新增返回按钮 |
| `src/components/SitesPage.jsx` | 新增 | 博客嵌入页 |
| `src/hooks/useAI.js` | 修改 | 新增 `gameActiveRef` 防止退出后调用 |
| `src/hooks/useDayFlow.js` | 修改 | 流程退出守卫 |

## [2026-02-06] 路由改造 + 域名统一 + 令牌安全策略

### 新功能

- **路由结构明确化**
  - `/login` → 登录后 `/home`
  - `/home` 入口：`/sites`、`/wolfgame/custom`
  - `/wolfgame/custom` 配置后进入 `/wolfgame/play`
  - `/wolfgame/play` “结束并返回主页”终止游戏
  - `/sites` 站点聚合页可返回 `/home`
- **新增 Sites 聚合页**
  - 独立页面承载外部站点入口，风格与主页一致
- **SPA 路由回退支持**
  - 新增 `_redirects` 支持直接访问深层路径

### 安全与一致性

- **登录 Token 永不过期**
- **ModelScope 令牌失效自动清空**
- **统一 API 域名与数据库入口**
  - 明确 `https://zhaxiaoji.com` 为唯一线上域名
  - 移除 `workers/auth/wrangler.toml`，避免误部署到旧 Worker
  - 头像服务改为跟随 `VITE_AUTH_API_URL`，不再指向 `*.workers.dev`

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.jsx` | 修改 | 路由与退出游戏流程 |
| `src/components/Dashboard.jsx` | 修改 | 首页入口拆分 |
| `src/components/SitesPage.jsx` | 新增 | 站点聚合页 |
| `public/_redirects` | 新增 | SPA 路由回退 |
| `workers/auth/jwt.js` | 修改 | JWT 永不过期 |
| `workers/auth/handlers.js` | 修改 | 令牌失效自动清空 |
| `src/contexts/AuthContext.jsx` | 修改 | 前端同步清空令牌 |
| `src/services/avatarService.js` | 修改 | 统一 API Base |
| `workers/auth/wrangler.toml` | 删除 | 避免误部署旧 Worker |
| `.claude/commands/deploy.md` | 修改 | 域名与 API 约定 |
| `.codex/rules/default.rules` | 修改 | 域名约束 |
| `AGENTS.md` | 修改 | 域名约定 |
| CLAUDE.md | 修改 | 域名约定 |


## [2026-02-06] 自定义模式独占 + 天亮结算阶段 + AI 逻辑约束 + Codex 项目配置

### 新功能

- **自定义局成为唯一模式**
  - 移除 6/8 人预设局，仅保留自定义配置（角色数/夜晚顺序自动生成）
  - 设置界面增加“免费算力平台”提示（慢/掉线/需耐心等待）

- **新增 `day_resolution` 结算阶段**
  - 夜晚结束后先进入结算阶段，支持猎人连锁开枪完整结算后再开始白天讨论

- **AI 模型与推理表增强**
  - 角色卡显示每名 AI 实际使用的模型（自动 fallback 后也会更新）
  - `identity_table` 增加 role pool 硬约束 + 本地清洗，避免推理出本局不存在的身份
  - 新增 GLM-4.7 / GLM-4.7-Flash 作为可选模型

### Bug 修复

- **猎人行动记录缺失/错归夜晚**
  - 猎人开枪记录持久化为白天行动，导出与历史表可正确显示

- **历史表渲染崩溃**
  - 修复 thought/identity_table 为对象导致的 React 渲染错误（统一 stringify）

### 工具与文档

- **新增 Codex 项目配套文件**
  - 增加 `AGENTS.md`、`.codex/` 规则/配置与 `.agents/skills/*`（对齐 `.claude/commands/*` 工作流）

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 移除 6/8 人预设，仅保留自定义 setup |
| `src/components/SetupScreen.jsx` | 修改 | 自定义-only UI + 免费算力平台提示 |
| `src/components/CirclePlayerLayout.jsx` | 修改 | Game Over 显示胜负；角色卡显示实际模型 |
| `src/App.jsx` | 修改 | 固定使用自定义 setup；移除预设切换状态 |
| `src/hooks/useDayFlow.js` | 修改 | 猎人连锁开枪结算；行动记录持久化 |
| `src/hooks/useAI.js` | 修改 | `identity_table` 清洗 + 模型追踪回调 |
| `src/services/identityTableSanitizer.js` | 新建 | 基于角色池的 `identity_table` 纠偏 |
| `src/services/aiPrompts.js` | 修改 | role pool 约束提示 |
| `src/config/aiConfig.js` | 修改 | 增加 GLM-4.7/Flash 模型 |
| `src/components/GameHistoryTable.jsx` | 修改 | thought/object 安全渲染 |
| `AGENTS.md` | 新建 | Codex 项目指南 |
| `.codex/` | 新建 | Codex 项目配置与 rules |
| `.agents/skills/*` | 新建 | Codex skills（对齐 Claude commands） |
| `.gitignore` | 修改 | 忽略 Codex 运行态文件 |

---

## [2026-02-06] 游戏规则强制执行 + 页面关闭处理 + 数据库头像系统

### 新功能

- **页面关闭时终止对战**
  - 添加全局 AbortController 管理 API 请求
  - 页面关闭/隐藏时自动取消所有进行中的 API 调用
  - 页面恢复可见时重置 AbortController

- **狼人禁止空刀**
  - AI 提示词明确强制 "狼人每晚必须袭击一名玩家"
  - 后端逻辑：AI 返回无效时随机选择目标
  - 移除 UI 中的 "空刀" 按钮

- **猎人必须开枪**
  - AI 提示词明确 "猎人死亡时必须开枪"（毒死除外）
  - 后端逻辑：AI 返回无效时随机选择目标
  - UI 禁用未选择目标时的开枪按钮

- **数据库头像系统**
  - 新建 `avatars` 表存储预生成头像
  - 添加 `/api/avatars` 和 `/api/avatars/batch` API
  - 前端 `avatarService.js` 从数据库获取头像
  - 创建 `scripts/generateAvatars.js` 生成脚本

- **AI 模型排行榜数据库**
  - 新建 `game_model_usage` 表记录每局模型使用
  - 新建 `ai_model_stats` 表聚合模型胜率统计

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/aiClient.js` | 修改 | 添加 AbortController 管理 |
| `src/App.jsx` | 修改 | 添加页面关闭/可见性处理 |
| `src/services/rolePrompts/werewolf.js` | 修改 | 添加禁止空刀规则 |
| `src/services/rolePrompts/hunter.js` | 修改 | 添加必须开枪规则 |
| `src/services/aiPrompts.js` | 修改 | 同步更新猎人提示词 |
| `src/hooks/useDayFlow.js` | 修改 | 强制狼人/猎人有效选择 |
| `src/hooks/useNightFlow.js` | 修改 | 强制狼人有效选择 |
| `src/components/ActionPanel.jsx` | 修改 | 移除空刀按钮，禁用无目标开枪 |
| `src/components/CirclePlayerLayout.jsx` | 修改 | 移除空刀按钮 |
| `src/services/rolePrompts/witch.js` | 修改 | 移除 "狼人空刀" 描述 |
| `src/services/avatarService.js` | 新建 | 头像服务（从数据库获取） |
| `src/useWerewolfGame.js` | 修改 | 使用 assignPlayerAvatars |
| `workers/auth/handlers.js` | 修改 | 添加头像 API 处理函数 |
| `workers/auth/index.js` | 修改 | 添加头像 API 路由 |
| `schema.sql` | 修改 | 添加 avatars、game_model_usage、ai_model_stats 表 |
| `scripts/generateAvatars.js` | 新建 | 头像生成脚本 |

### 数据库迁移
```sql
-- 预生成头像表
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, role, personality)
);

-- AI 模型游戏使用记录表
CREATE TABLE IF NOT EXISTS game_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT NOT NULL,
  player_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,
  game_mode TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI 模型统计聚合表
CREATE TABLE IF NOT EXISTS ai_model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  role TEXT NOT NULL,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_id, role)
);
```

---

## [2026-02-06] 猎人延迟开枪 + 行动板持久化 + 提示词渐进式披露

### 新功能

- **猎人延迟开枪机制**
  - 狼人袭击猎人后，如果好人占多数，猎人延迟到白天开枪
  - 支持连锁开枪：被带走的玩家如果也是猎人，可继续开枪（最大3层）
  - 新增 `isGoodMajority()` 函数判断阵营优势
  - 新增 `pendingHunterShoot` 状态管理延迟开枪

- **全AI模式行动板持久化**
  - 行动面板现在显示整局游戏的所有记录（不再每天刷新）
  - 投票结果作为系统公告显示在行动列表中
  - 按日/夜分组显示（N1 → D1 → N2 → D2...）
  - 每组有 sticky 标题带图标（🌙第1夜 / ☀️第1天）

- **提示词渐进式披露架构**
  - 每个角色有独立的提示词模块（`src/services/rolePrompts/`）
  - 根据游戏配置动态调整提示内容（没有的角色不会被提及）
  - 守卫首夜策略根据有无女巫调整（同守同救提醒）
  - 狼人刀法优先级根据存在的角色动态生成

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/rolePrompts/index.js` | 新建 | 角色模块导出聚合器 |
| `src/services/rolePrompts/baseRules.js` | 新建 | 通用规则和辅助函数 |
| `src/services/rolePrompts/werewolf.js` | 新建 | 狼人提示词模块 |
| `src/services/rolePrompts/seer.js` | 新建 | 预言家提示词模块 |
| `src/services/rolePrompts/witch.js` | 新建 | 女巫提示词模块 |
| `src/services/rolePrompts/hunter.js` | 新建 | 猎人提示词模块 |
| `src/services/rolePrompts/guard.js` | 新建 | 守卫提示词模块 |
| `src/services/rolePrompts/villager.js` | 新建 | 村民提示词模块 |
| `src/services/promptFactory.js` | 新建 | 渐进式披露提示词工厂 |
| `src/services/aiPrompts.js` | 修改 | 集成渐进式披露架构 |
| `src/useWerewolfGame.js` | 修改 | 添加 `pendingHunterShoot` 状态 |
| `src/App.jsx` | 修改 | 添加 `isGoodMajority()` 和延迟开枪逻辑 |
| `src/hooks/useDayFlow.js` | 修改 | 实现连锁开枪机制 |
| `src/components/GameArena.jsx` | 修改 | `getAllActions()` 添加投票历史 |
| `src/components/SidePanels.jsx` | 修改 | 添加日/夜分组标题 |
| `CLAUDE.md` | 修改 | 更新目录结构和常见任务指南 |

### 技术细节
- 延迟开枪状态格式：`{ hunterId, source: 'night', chainDepth: 0 }`
- 连锁深度限制：`chainDepth > 3` 时停止递归
- 渐进式披露核心函数：`detectExistingRoles()` 返回 `{ hasWitch, hasGuard, hasHunter, hasSeer }`
- 条件化规则通过 `buildConditionalRules(existingRoles, gameSetup)` 动态生成

---

## [2026-02-05] 屠边/屠城模式 + AI身份推理表 + 思考过程记录

### Bug 修复
- **AI 模型排行榜网络错误**
  - 问题：排行榜显示"网络错误，请稍后重试"
  - 原因：数据库迁移 `002_add_model_stats.sql` 未执行，`ai_model_stats` 表不存在
  - 修复：执行数据库迁移创建表和索引

### 新功能
- **屠边/屠城胜利模式选择**
  - 屠边模式（默认）：狼人杀光所有村民或所有神职即可胜利
  - 屠城模式：狼人必须杀光所有好人（村民+神职）才能胜利
  - 在设置界面添加模式选择 UI
  - 根据模式动态调整 AI 提示词和策略建议

- **AI 身份推理表系统**
  - 每个 AI 维护自己的身份推理表（`identity_table`）
  - 记录对每个玩家的身份猜测、置信度（0-100%）和推理依据
  - AI 基于排除法和行为分析进行推理
  - 推理表在每次发言后更新，实现持续的身份追踪

- **AI 思考过程记录**
  - 发言历史中保存 AI 的 `thought`（思考过程）和 `identity_table`（推理表）
  - 导出的 txt 记录文件现在包含：
    - 💭 思考过程：AI 内部的分析和推理
    - 🗳️ 投票意向：AI 的投票目标
    - 📊 身份推理表：每个 AI 对场上玩家身份的最终判断

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 新增 `VICTORY_MODES` 胜利模式配置 |
| `src/components/SetupScreen.jsx` | 修改 | 添加胜利模式选择 UI |
| `src/App.jsx` | 修改 | 添加 `victoryMode` 状态，修改 `checkGameEnd` 和导出函数 |
| `src/services/aiPrompts.js` | 修改 | 添加 `VICTORY_MODE_PROMPTS`、`IDENTITY_TABLE_PROMPT`，修改输出格式 |
| `src/hooks/useAI.js` | 修改 | 添加 `identityTablesRef` 存储推理表，传递 `victoryMode` |
| `migrations/002_add_model_stats.sql` | 执行 | 创建 `ai_model_stats` 和 `game_model_usage` 表 |

### 技术细节
- 身份推理表格式：`{"玩家号": {"suspect": "角色猜测", "confidence": 0-100, "reason": "推理依据"}}`
- 胜利条件判断在 `checkGameEnd` 函数中根据 `victoryMode` 动态切换
- AI 提示词根据角色阵营显示不同的胜利目标和策略建议

---

## [2026-02-05] 自定义角色选择功能

### 新功能
- **自定义角色配置系统**
  - 玩家可自由选择参与游戏的角色，不再局限于固定模式
  - 新增 `RoleSelector` 组件，提供直观的角色选择界面
  - 角色分类展示：狼人阵营（红色）、神职角色（琥珀色）、好人阵营（绿色）
  - 唯一角色（预言家/女巫/守卫）使用开关选择，最多1个
  - 多选角色（狼人/村民/猎人）使用 +/- 按钮调整数量

- **角色元数据系统** (`ROLE_METADATA`)
  - 为每个角色定义约束条件（maxCount）和夜间行动顺序（nightOrder）
  - 支持动态生成夜间行动顺序 `generateNightSequence()`
  - 自动生成配置描述字符串 `generateDescription()`

- **配置验证系统**
  - 实时验证：总人数 4-10 人、至少1名狼人、好人数量多于狼人
  - 错误提示（红色）阻止开始游戏
  - 警告提示（琥珀色）仅提示但不阻止（如狼人比例偏高）

### 文件变更
| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/roles.js` | 修改 | 新增 ROLE_METADATA、验证函数、工具函数 |
| `src/components/RoleSelector.jsx` | 新建 | 角色选择器 UI 组件 |
| `src/components/SetupScreen.jsx` | 修改 | 集成自定义按钮和 RoleSelector |
| `src/App.jsx` | 修改 | 状态提升、传递新 props |
| `src/components/ModelLeaderboard.jsx` | 修复 | 修复 authService 导入错误 |

### 技术细节
- 夜间顺序根据 `nightOrder` 数值自动排序，添加新角色只需在 `ROLE_METADATA` 中定义
- 向后兼容：预设模式（8人局、6人局）完全保留
- 自定义配置在开始游戏时构建，复用现有的 `selectedSetup` 状态

---

## [2026-02-05] AI 模型排行榜系统 + 游戏逻辑优化

### 新功能
- **AI 模型排行榜系统**
  - 添加数据库表追踪每个 AI 模型在不同角色下的表现统计
  - 实现等概率随机模型选择机制，确保公平竞争
  - 游戏结束时自动上报模型使用数据和结果
  - 新增后端 API 端点：
    - `POST /api/model-stats` - 提交模型游戏统计
    - `GET /api/model-leaderboard` - 获取模型排行榜（支持按角色筛选和排序）
  - 新增前端排行榜组件 `ModelLeaderboard.jsx`
    - 显示模型胜率、总场次、胜负记录
    - 支持按角色筛选和多种排序方式（胜率/总场次/胜场）
    - 所有注册用户可见，集成到 Dashboard 主页

### 优化改进
- **AI 模型调用优化**
  - 修改 AI 客户端从基于玩家 ID 的轮询改为真随机选择
  - 添加模型使用追踪，每次 AI 调用记录使用的模型信息
  - 游戏状态新增 `modelUsage` 字段追踪整局游戏的模型使用

- **游戏逻辑改进**
  - 修复玩家模式下投票记录不显示问题
  - 添加身份推理系统，AI 可根据游戏配置推断角色身份
    - 示例："只有1号跳预言家，大概率是真预言家（本局只有1个预言家）"
  - 白天投票增加思考过程记录，显示投票原因
  - 优化投票流程为并行执行，大幅减少等待时间
  - 女巫策略调整为基于推理而非"上帝视角"
    - 不再直接告知好人/狼人剩余数量
    - 引导女巫通过时间线、历史死亡、查验记录自己推断局势

### 数据库变更
**迁移文件**: `migrations/002_add_model_stats.sql`

新增表：
1. **ai_model_stats** - AI 模型统计聚合表
   ```sql
   CREATE TABLE ai_model_stats (
     id INTEGER PRIMARY KEY,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     role TEXT NOT NULL,
     total_games INTEGER DEFAULT 0,
     wins INTEGER DEFAULT 0,
     losses INTEGER DEFAULT 0,
     win_rate REAL DEFAULT 0.0,
     created_at TIMESTAMP,
     updated_at TIMESTAMP,
     UNIQUE(model_id, role)
   );
   ```

2. **game_model_usage** - 游戏模型使用记录表
   ```sql
   CREATE TABLE game_model_usage (
     id INTEGER PRIMARY KEY,
     game_session_id TEXT NOT NULL,
     player_id INTEGER NOT NULL,
     role TEXT NOT NULL,
     model_id TEXT NOT NULL,
     model_name TEXT NOT NULL,
     result TEXT CHECK(result IN ('win', 'lose')),
     game_mode TEXT NOT NULL,
     duration_seconds INTEGER,
     created_at TIMESTAMP
   );
   ```

### 修改文件列表
**前端**:
- `src/services/aiClient.js` - 随机模型选择和信息追踪
- `src/hooks/useAI.js` - 模型使用回调
- `src/useWerewolfGame.js` - 模型追踪状态管理
- `src/App.jsx` - 游戏结束时上报统计
- `src/services/authService.js` - 新增 API 调用方法
- `src/components/ModelLeaderboard.jsx` - **新增**排行榜组件
- `src/components/Dashboard.jsx` - 集成排行榜组件
- `src/hooks/useDayFlow.js` - 优化投票逻辑为并行执行
- `src/services/aiPrompts.js` - 添加身份推理和女巫推理引导

**后端**:
- `workers/auth/handlers.js` - 新增统计处理逻辑
- `workers/auth/index.js` - 新增路由

### 部署命令
```bash
# 应用数据库迁移
npx wrangler d1 execute wolfgame-db --remote --file=migrations/002_add_model_stats.sql

# 构建并部署
npm run build
npm run deploy
```

### 验证命令
```bash
# 查看新表结构
npx wrangler d1 execute wolfgame-db --remote --command "SELECT sql FROM sqlite_master WHERE type='table' AND name IN ('ai_model_stats', 'game_model_usage');"

# 查看排行榜数据
npx wrangler d1 execute wolfgame-db --remote --command "SELECT * FROM ai_model_stats ORDER BY win_rate DESC LIMIT 10;"
```

---

## [2026-02-04] 修复 Cloudflare 部署和令牌验证功能

### 问题描述
- 用户登录后配置 ModelScope 令牌时报错 "Not found"
- Cloudflare 部署失败，错误: `binding DB of type d1 must have a valid id specified`

### 根本原因分析
1. **wrangler.toml 配置错误**
   - `database_id` 使用占位符 `"your-database-id-here"` 而非实际 ID
   - `database_name` 不匹配 (`wolfgame_db` vs 实际的 `wolfgame-db`)

2. **JWT_SECRET 未配置**
   - Cloudflare Workers Secret 未设置
   - 导致登录时 HMAC 签名失败 (key length = 0)

3. **数据库 Schema 不完整**
   - `users` 表缺少 `modelscope_token` 和 `token_verified_at` 列
   - 表结构与 `schema.sql` 定义不同步

### 修复内容

#### 1. 修复 wrangler.toml 配置
```toml
# 修改前
[[d1_databases]]
binding = "DB"
database_name = "wolfgame_db"
database_id = "your-database-id-here"

# 修改后
[[d1_databases]]
binding = "DB"
database_name = "wolfgame-db"
database_id = "f54315ad-c129-41e4-a23d-82463488d315"
```

#### 2. 配置 JWT_SECRET
```bash
npx wrangler secret put JWT_SECRET
# 输入 32 字节随机密钥
```

#### 3. 数据库迁移 - 添加令牌相关列
```sql
ALTER TABLE users ADD COLUMN modelscope_token TEXT;
ALTER TABLE users ADD COLUMN token_verified_at TIMESTAMP;
```

### 修复后的 users 表结构
| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| username | TEXT | 用户名 |
| email | TEXT | 邮箱 |
| password_hash | TEXT | 密码哈希 |
| email_verified | INTEGER | 邮箱验证状态 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |
| last_login | TIMESTAMP | 最后登录时间 |
| **modelscope_token** | TEXT | ModelScope API 令牌 (新增) |
| **token_verified_at** | TIMESTAMP | 令牌验证时间 (新增) |

### 验证命令
```bash
# 查看 D1 数据库列表
npx wrangler d1 list

# 查看 Secrets 配置
npx wrangler secret list

# 查看表结构
npx wrangler d1 execute wolfgame-db --remote --command "PRAGMA table_info(users);"

# 部署
npm run build && npm run deploy
```

### 经验教训
1. **配置文件检查**: 部署前确保 `wrangler.toml` 中没有占位符
2. **Secrets 管理**: Workers Secrets 需要单独配置，不能写在代码中
3. **数据库迁移**: 生产环境表结构变更需要手动执行 `ALTER TABLE`
4. **版本保留**: Cloudflare Workers 部署失败时旧版本继续运行，需注意新功能可能未上线

---

## 历史版本

### [2026-01-23] 初始版本
- 创建 D1 数据库 `wolfgame-db`
- 部署基础认证系统
- 实现用户注册/登录功能
