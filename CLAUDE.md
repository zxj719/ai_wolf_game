# AI 狼人杀项目 - Claude Code 上下文

## 项目概述

这是一个 AI 狼人杀游戏 Web 应用，前端使用 React + Vite + TailwindCSS，后端使用 Cloudflare Workers + D1 数据库。

**核心特性：**
- 多种游戏模式（人机对战、纯AI观战）
- 用户认证系统（JWT）
- ModelScope API 令牌管理
- 个人博客系统

## 技术栈速查

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite 5 |
| 样式 | TailwindCSS 3 |
| 图标 | lucide-react |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| AI API | ModelScope (兼容 OpenAI 格式) |

## 目录结构

```
src/
├── App.jsx                 # 主应用入口，路由控制
├── main.jsx               # React 挂载点
├── useWerewolfGame.js     # 游戏核心状态 Hook
├── components/
│   ├── Dashboard.jsx      # 个人主页仪表盘
│   ├── GameArena.jsx      # 游戏主界面
│   ├── SetupScreen.jsx    # 游戏设置页
│   ├── TokenManager.jsx   # API 令牌管理
│   ├── Auth/              # 认证相关组件
│   └── ...
├── hooks/
│   ├── useAI.js           # AI 调用封装
│   ├── useDayFlow.js      # 白天流程控制
│   └── ...
├── services/
│   ├── aiClient.js        # AI API 客户端
│   ├── aiPrompts.js       # AI 提示词模板
│   ├── authService.js     # 认证服务
│   └── ...
├── config/
│   ├── aiConfig.js        # AI 配置（API_URL、模型列表）
│   └── roles.js           # 角色定义、游戏配置
└── contexts/
    └── AuthContext.jsx    # 认证状态上下文

workers/auth/              # Cloudflare Workers 后端
├── index.js               # 路由入口
├── handlers.js            # API 处理函数
├── jwt.js                 # JWT 工具
├── password.js            # 密码哈希
├── middleware.js          # 中间件（CORS、认证）
└── email.js               # 邮件发送

site/                      # 静态博客页面
```

## 关键文件说明

### 必读文件（修改前请先阅读）

| 文件 | 职责 | 修改时注意 |
|------|------|------------|
| `src/App.jsx` | 应用路由和状态管理 | 包含游戏全流程逻辑，很长(~1100行) |
| `src/useWerewolfGame.js` | 游戏状态 Reducer | 所有游戏状态在这里定义 |
| `src/config/roles.js` | 角色和游戏配置 | 添加新角色/模式在这里 |
| `workers/auth/handlers.js` | 后端 API 实现 | 令牌验证、用户管理等 |

### AI 相关（修改提示词/模型）

| 文件 | 职责 |
|------|------|
| `src/services/aiPrompts.js` | 所有 AI 提示词模板 |
| `src/services/aiClient.js` | API 调用实现 |
| `src/config/aiConfig.js` | API 端点和模型列表 |
| `src/hooks/useAI.js` | AI 调用 Hook（构建上下文） |

### 认证相关

| 文件 | 职责 |
|------|------|
| `src/contexts/AuthContext.jsx` | 前端认证状态 |
| `src/services/authService.js` | 前端认证 API 调用 |
| `workers/auth/handlers.js` | 后端认证处理 |
| `workers/auth/middleware.js` | JWT 验证中间件 |

## 常见任务指南

### 1. 修改游戏逻辑
- 夜间流程: `src/App.jsx` 的 `executeNightAction` useEffect
- 白天流程: `src/hooks/useDayFlow.js`
- 投票逻辑: `useDayFlow.js` 的 `handleAutoVote`

### 2. 添加新 API 端点
1. 在 `workers/auth/handlers.js` 添加处理函数
2. 在 `workers/auth/index.js` 添加路由
3. 在 `src/services/authService.js` 添加前端调用方法

### 3. 修改 UI 组件
- 游戏界面: `src/components/GameArena.jsx`
- 设置页面: `src/components/SetupScreen.jsx`
- 仪表盘: `src/components/Dashboard.jsx`

### 4. 修改 AI 行为
- 提示词模板: `src/services/aiPrompts.js`
- 上下文构建: `src/hooks/useAI.js` 的 `buildAIContext`

## 代码规范

### 命名约定
- 组件: PascalCase (`GameArena.jsx`)
- Hooks: camelCase，use 前缀 (`useAI.js`)
- 服务: camelCase (`authService.js`)
- 常量: UPPER_SNAKE_CASE (`ROLE_DEFINITIONS`)

### 状态管理
- 全局认证状态: `AuthContext`
- 游戏状态: `useWerewolfGame` Hook
- 组件状态: `useState`

### 样式
- 使用 TailwindCSS 类
- 暗色主题为主 (`bg-zinc-950`, `text-zinc-100`)
- 强调色: `amber-600` (主), `blue-600` (次)

## 部署命令

```bash
# 前端构建
npm run build

# 部署到 Cloudflare
npm run deploy

# 或分开部署
npx wrangler deploy --assets ./dist
```

## 数据库 Schema 要点

```sql
-- 用户表关键字段
users: id, username, email, password_hash, modelscope_token, token_verified_at

-- 游戏记录
game_history: user_id, role, result, game_mode, duration_seconds

-- 用户统计
user_stats: user_id, total_games, wins, losses, win_rate
```

## 环境变量

| 变量 | 用途 | 位置 |
|------|------|------|
| `VITE_API_KEY` | 前端默认 AI 令牌 | `.env` |
| `JWT_SECRET` | JWT 签名密钥 | Workers Secret |
| `RESEND_API_KEY` | 邮件服务 | Workers Secret |

## 注意事项

1. **令牌验证**: 使用实际 AI 调用验证，不只检查格式
2. **CORS**: 后端已配置，前端直接调用即可
3. **游客模式**: 使用环境变量中的 API 令牌
4. **游戏状态**: 复杂的状态机，修改前理解流程

## 调试技巧

- 游戏日志: 控制台搜索 `[夜间行动]`、`[发言控制]`
- AI 调用: 搜索 `[狼人AI]`、`[预言家AI]` 等
- 后端日志: `wrangler tail` 查看 Workers 日志
