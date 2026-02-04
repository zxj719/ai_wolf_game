# 深度思考平台 - 项目架构报告

> 打破信息茧房，聚焦价值观点，打造有思维深度的信息平台

---

## 一、项目概述

### 1.1 愿景

构建一个**反推荐算法**的个人信息平台，通过 AI 技术整合多元信息源，帮助用户：

- 🔓 **打破信息茧房** - 主动获取多元观点，而非被动接受推荐
- 🎯 **聚焦价值观点** - AI 提取核心论点，过滤噪音
- 🧠 **培养深度思考** - 去娱乐化，专注有价值的信息

### 1.2 当前状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 🎮 AI 狼人杀 | ✅ 已上线 | 完整的人机对战游戏 |
| 👤 用户系统 | ✅ 已上线 | 注册/登录/令牌管理 |
| 📝 个人博客 | ✅ 已上线 | 静态页面展示 |
| 📰 信息聚合 | 🔜 规划中 | RSS + AI 整合 |

---

## 二、当前技术架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户浏览器                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare CDN (边缘分发)                   │
│                     zhaxiaoji.com                            │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│     静态资源 (Vite)       │    │   Cloudflare Workers     │
│  - React SPA             │    │   (API 后端)              │
│  - TailwindCSS           │    │  - /api/auth/*           │
│  - 博客静态页面           │    │  - /api/user/*           │
└──────────────────────────┘    └──────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                    ┌──────────────────┐          ┌──────────────────┐
                    │   Cloudflare D1   │          │   ModelScope AI  │
                    │   (SQLite 数据库)  │          │   (AI API 服务)   │
                    └──────────────────┘          └──────────────────┘
```

### 2.2 技术栈详情

| 层级 | 技术选型 | 选择理由 |
|------|----------|----------|
| **前端框架** | React 18 + Vite 5 | 快速热更新，生态丰富 |
| **样式方案** | TailwindCSS 3 | 原子化 CSS，暗色主题 |
| **图标库** | lucide-react | 轻量，风格统一 |
| **后端运行时** | Cloudflare Workers | 边缘计算，零冷启动 |
| **数据库** | Cloudflare D1 | SQLite 兼容，免运维 |
| **AI 服务** | ModelScope API | OpenAI 兼容格式，成本可控 |
| **部署** | Cloudflare Pages | 全球 CDN，自动 HTTPS |

### 2.3 目录结构

```
battle-web/
├── src/                          # 前端源码
│   ├── App.jsx                   # 主应用入口，路由控制
│   ├── main.jsx                  # React 挂载点
│   ├── useWerewolfGame.js        # 游戏核心状态 Hook
│   │
│   ├── components/               # UI 组件
│   │   ├── Dashboard.jsx         # 个人主页仪表盘
│   │   ├── GameArena.jsx         # 游戏主界面
│   │   ├── SetupScreen.jsx       # 游戏设置页
│   │   ├── TokenManager.jsx      # API 令牌管理
│   │   ├── UserStats.jsx         # 用户战绩统计
│   │   ├── Auth/                 # 认证相关组件
│   │   │   ├── AuthPage.jsx      # 认证页面容器
│   │   │   ├── LoginForm.jsx     # 登录表单
│   │   │   ├── RegisterForm.jsx  # 注册表单
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useAI.js              # AI 调用封装
│   │   ├── useDayFlow.js         # 白天流程控制
│   │   ├── useNightFlow.js       # 夜间流程控制
│   │   └── ...
│   │
│   ├── services/                 # 业务服务
│   │   ├── aiClient.js           # AI API 客户端
│   │   ├── aiPrompts.js          # AI 提示词模板
│   │   ├── authService.js        # 认证服务
│   │   └── ...
│   │
│   ├── config/                   # 配置文件
│   │   ├── aiConfig.js           # AI 配置
│   │   └── roles.js              # 角色定义
│   │
│   └── contexts/                 # React Context
│       └── AuthContext.jsx       # 认证状态上下文
│
├── workers/auth/                 # Cloudflare Workers 后端
│   ├── index.js                  # 路由入口
│   ├── handlers.js               # API 处理函数
│   ├── jwt.js                    # JWT 工具
│   ├── password.js               # 密码哈希
│   ├── middleware.js             # 中间件
│   └── email.js                  # 邮件发送
│
├── site/                         # 静态博客页面
│   └── ...
│
├── .claude/                      # Claude Code 配置
│   ├── settings.local.json       # 本地设置
│   └── commands/                 # 自定义命令
│
├── schema.sql                    # 数据库 Schema
├── wrangler.toml                 # Cloudflare 配置
├── CLAUDE.md                     # 项目上下文文档
└── package.json                  # 依赖配置
```

---

## 三、已实现功能

### 3.1 AI 狼人杀游戏

核心玩法完整实现：

| 功能 | 描述 |
|------|------|
| **游戏模式** | 人机对战、纯 AI 观战 |
| **角色系统** | 狼人、预言家、女巫、守卫、猎人、村民 |
| **游戏流程** | 夜间行动 → 白天发言 → 投票表决 → 胜负判定 |
| **AI 决策** | 基于 ModelScope 大模型，每个角色有独立决策逻辑 |
| **发言系统** | AI 生成符合角色身份的发言内容 |
| **投票系统** | 智能投票，基于逻辑推理 |

### 3.2 用户认证系统

完整的用户管理：

| 功能 | 描述 |
|------|------|
| **注册/登录** | 邮箱 + 密码认证 |
| **JWT 会话** | 安全的无状态认证 |
| **令牌管理** | ModelScope API Token 绑定与验证 |
| **验证流程** | 实际 AI 调用验证（非仅格式检查） |

### 3.3 个人仪表盘

用户入口页面：

| 功能 | 描述 |
|------|------|
| **功能导航** | 快速进入狼人杀 / 博客 |
| **状态展示** | Token 配置状态、账户信息 |
| **游客模式** | 无需登录可体验游戏 |

### 3.4 数据库设计

当前 Schema：

```sql
-- 用户表
users (
  id, username, email, password_hash,
  email_verified, modelscope_token, token_verified_at,
  created_at, updated_at, last_login
)

-- 游戏历史
game_history (
  id, user_id, role, result, game_mode,
  duration_seconds, created_at
)

-- 用户统计
user_stats (
  user_id, total_games, wins, losses, win_rate
)

-- 验证令牌
verification_tokens (
  id, user_id, token, type, expires_at, created_at
)
```

---

## 四、架构演进规划

### 4.1 目标架构

为支持信息聚合等新功能，需要扩展为模块化架构：

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 SPA (React)                        │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │ Dashboard │ Werewolf │   Blog   │ InfoHub  │  Future  │  │
│  │  仪表盘   │  狼人杀   │   博客   │ 信息聚合  │   ...    │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (统一 API 网关)              │
│                                                             │
│  /api/auth/*    认证服务                                    │
│  /api/game/*    游戏服务                                    │
│  /api/blog/*    博客服务                                    │
│  /api/feed/*    RSS 聚合服务 (新增)                          │
│  /api/ai/*      AI 处理服务 (新增)                          │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
    │   D1    │   │   KV    │   │   R2    │   │  Queue  │
    │ 结构数据 │   │  缓存   │   │ 文件存储 │   │ 异步队列 │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Cron Triggers   │
                    │ 定时 RSS 抓取    │
                    │ 定时 AI 处理     │
                    └─────────────────┘
```

### 4.2 新增 Cloudflare 服务说明

| 服务 | 用途 | 预计用量 |
|------|------|----------|
| **KV** | 会话缓存、热门内容缓存 | ~500MB |
| **R2** | 原始文章存储、图片存储 | ~5GB |
| **Queue** | AI 处理异步队列 | ~10万条/月 |
| **Cron** | 定时 RSS 抓取 | 每30分钟 |

---

## 五、下一步计划：信息聚合功能

### 5.1 功能设计

**核心理念 → 技术实现**

| 理念 | 技术方案 |
|------|----------|
| 反推荐算法 | 用户自选 RSS 源，无个性化推荐 |
| 打破信息茧房 | 强制展示多元观点，AI 标注立场 |
| 聚焦价值观点 | AI 摘要 + 关键论点提取 |
| 去娱乐化 | 源质量评分，过滤低质内容 |

### 5.2 数据流设计

```
RSS源 ──→ Cron抓取 ──→ 原始存储(R2) ──→ AI处理队列
                                            │
                                            ▼
用户阅读 ←── 聚合展示 ←── 结构化存储(D1) ←── AI整合结果
```

### 5.3 数据库扩展

```sql
-- RSS 源管理
CREATE TABLE feed_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,                    -- 科技/财经/时政/...
  quality_score REAL DEFAULT 5.0,   -- 源质量评分 1-10
  last_fetched TIMESTAMP,
  fetch_interval INTEGER DEFAULT 30, -- 抓取间隔（分钟）
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 文章存储
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  author TEXT,
  content_hash TEXT,                -- 内容哈希，去重用
  raw_content_r2_key TEXT,          -- R2 存储键
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed INTEGER DEFAULT 0,      -- 是否已 AI 处理
  FOREIGN KEY (source_id) REFERENCES feed_sources(id)
);

-- AI 分析结果
CREATE TABLE article_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER UNIQUE NOT NULL,
  summary TEXT,                     -- 一句话摘要
  key_points TEXT,                  -- JSON: 核心论点列表
  stance_tags TEXT,                 -- JSON: 立场标签
  quality_score REAL,               -- 内容质量评分
  topics TEXT,                      -- JSON: 话题标签
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- 用户订阅
CREATE TABLE user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (source_id) REFERENCES feed_sources(id),
  UNIQUE(user_id, source_id)
);

-- 用户阅读记录
CREATE TABLE user_reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_bookmarked INTEGER DEFAULT 0,
  note TEXT,                        -- 用户批注
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- 索引
CREATE INDEX idx_articles_source ON articles(source_id, published_at DESC);
CREATE INDEX idx_articles_processed ON articles(processed, fetched_at);
CREATE INDEX idx_analysis_topics ON article_analysis(topics);
CREATE INDEX idx_reading_user ON user_reading_history(user_id, read_at DESC);
```

### 5.4 AI 处理 Prompt

```
你是一个信息分析助手，任务是分析文章并提取结构化信息。

分析要求：
1. 客观中立，不带个人立场
2. 提取核心观点，忽略修辞和情绪
3. 识别论证的逻辑结构

输出格式（JSON）：
{
  "summary": "一句话概括文章核心观点（<50字）",
  "key_points": [
    "核心论点1",
    "核心论点2",
    "核心论点3"
  ],
  "stance_tags": {
    "political": "left|center|right|neutral",
    "tone": "optimistic|pessimistic|neutral",
    "style": "academic|journalistic|opinion"
  },
  "quality_score": 7.5,  // 1-10，基于论证深度和数据支撑
  "topics": ["科技", "AI", "政策"]
}
```

### 5.5 实施路线图

#### 第一阶段：基础设施（1-2 天）

- [ ] 重构 Workers 为模块化架构
- [ ] 配置 Cloudflare KV 缓存
- [ ] 配置 Cloudflare R2 存储
- [ ] 扩展数据库 Schema

#### 第二阶段：RSS 抓取系统（2-3 天）

- [ ] 实现 RSS/Atom 解析器
- [ ] 创建 Cron Trigger 定时任务
- [ ] 实现内容去重逻辑
- [ ] 构建源管理 API

#### 第三阶段：AI 整合处理（2-3 天）

- [ ] 设计并测试分析 Prompt
- [ ] 实现 Cloudflare Queue 异步处理
- [ ] 批量处理优化
- [ ] 错误重试机制

#### 第四阶段：前端展示（2-3 天）

- [ ] InfoHub 组件开发
  - [ ] 时间线视图
  - [ ] 话题聚合视图
  - [ ] 多元观点对比
- [ ] 源管理界面
- [ ] 阅读体验优化

#### 第五阶段：智能增强（可选）

- [ ] 观点图谱可视化
- [ ] 深度报告生成
- [ ] 个人知识库 / 批注系统

---

## 六、资源与成本估算

### 6.1 Cloudflare 服务用量

| 服务 | 免费额度 | 预计用量 | 是否足够 |
|------|----------|----------|----------|
| Workers | 10万次/天 | ~5万次/天 | ✅ 足够 |
| D1 | 5GB 存储 | ~1GB | ✅ 足够 |
| KV | 1GB 存储 | ~500MB | ✅ 足够 |
| R2 | 10GB 存储 | ~5GB | ✅ 足够 |
| Queue | 100万条/月 | ~10万条 | ✅ 足够 |

### 6.2 AI API 成本

| 场景 | Token 消耗 | 频率 | 月成本 |
|------|-----------|------|--------|
| 狼人杀游戏 | ~5000/局 | ~100局 | ~¥10 |
| 文章分析 | ~2000/篇 | ~1000篇 | ~¥20 |
| **合计** | - | - | **~¥30-50** |

---

## 七、技术决策说明

### 7.1 为什么选择 Cloudflare 全家桶？

| 优势 | 说明 |
|------|------|
| **零冷启动** | Workers 边缘执行，比传统 Serverless 快 10x |
| **统一计费** | D1/KV/R2/Queue 一个账单，成本透明 |
| **全球分发** | 用户访问最近节点，延迟 <50ms |
| **免费额度** | 个人项目完全免费运行 |
| **简化运维** | 无需管理服务器、数据库实例 |

### 7.2 为什么不用其他方案？

| 方案 | 不选择原因 |
|------|-----------|
| Vercel + Supabase | 数据库在固定区域，延迟较高 |
| AWS Lambda | 冷启动明显，配置复杂 |
| 自建服务器 | 运维成本高，需要处理扩展 |
| Firebase | 国内访问受限 |

---

## 八、开发规范

### 8.1 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 组件 | PascalCase | `GameArena.jsx` |
| Hooks | camelCase + use | `useAI.js` |
| 服务 | camelCase | `authService.js` |
| 常量 | UPPER_SNAKE | `ROLE_DEFINITIONS` |

### 8.2 样式规范

```
主题：暗色优先
背景：bg-zinc-950 / bg-zinc-900
文字：text-zinc-100 / text-zinc-400
主色：amber-600 / amber-500
辅色：blue-600 / green-600
边框：border-zinc-700 / border-zinc-800
卡片：bg-zinc-900 rounded-xl border border-zinc-700
```

### 8.3 Git 提交规范

```
feat: 新功能
fix: 修复 Bug
docs: 文档更新
style: 样式调整
refactor: 代码重构
perf: 性能优化
```

---

## 九、附录

### 9.1 环境变量

| 变量 | 用途 | 位置 |
|------|------|------|
| `VITE_API_KEY` | 前端默认 AI 令牌 | `.env` |
| `JWT_SECRET` | JWT 签名密钥 | Workers Secret |
| `RESEND_API_KEY` | 邮件服务 | Workers Secret |

### 9.2 常用命令

```bash
# 开发
npm run dev

# 构建
npm run build

# 部署
npm run deploy

# 查看 Workers 日志
wrangler tail
```

### 9.3 调试技巧

| 场景 | 控制台搜索关键词 |
|------|------------------|
| 夜间流程 | `[夜间行动]` |
| 发言控制 | `[发言控制]` |
| AI 决策 | `[狼人AI]` `[预言家AI]` |
| 胜负判定 | `[GameCheck]` |

---

**文档版本**: v1.0
**最后更新**: 2026-02-04
**维护者**: zhaxiaoji
