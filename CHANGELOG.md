# 变更日志 (Changelog)

本文件记录项目的重要变更，包括功能更新、Bug 修复和数据库迁移等。

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
