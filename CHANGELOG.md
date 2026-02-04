# 变更日志 (Changelog)

本文件记录项目的重要变更，包括功能更新、Bug 修复和数据库迁移等。

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
