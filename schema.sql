-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0,
  modelscope_token TEXT,
  token_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email ON users(email);

-- 游戏历史表（阶段二使用）
CREATE TABLE IF NOT EXISTS game_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,
  game_mode TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_games ON game_history(user_id, created_at DESC);

-- 用户统计表（阶段三使用）
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate REAL DEFAULT 0.0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 验证令牌表（阶段四使用）
CREATE TABLE IF NOT EXISTS verification_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  type TEXT CHECK(type IN ('email_verify', 'password_reset')) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 预生成头像表（用于游戏中玩家头像）
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,           -- 玩家名称 (Harry, Hermione, etc.)
  role TEXT NOT NULL,           -- 角色类型 (狼人, 村民, etc.) 或 'neutral' 表示中性头像
  personality TEXT,             -- 性格类型 (logical, aggressive, steady, cunning)
  image_url TEXT NOT NULL,      -- 图片 URL 或 base64 data URL
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, role, personality)
);

CREATE INDEX IF NOT EXISTS idx_avatars_name ON avatars(name);
CREATE INDEX IF NOT EXISTS idx_avatars_role ON avatars(role);

-- AI 模型游戏使用记录表（记录每局游戏中每个模型的表现）
CREATE TABLE IF NOT EXISTS game_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT NOT NULL,       -- 游戏会话ID
  player_id INTEGER NOT NULL,          -- 玩家编号 (1-12)
  role TEXT NOT NULL,                  -- 角色 (狼人, 村民, 预言家, etc.)
  model_id TEXT NOT NULL,              -- 模型ID (e.g., Qwen/Qwen2.5-7B-Instruct)
  model_name TEXT NOT NULL,            -- 模型显示名称
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,  -- 游戏结果
  game_mode TEXT NOT NULL,             -- 游戏模式 (ai-only, etc.)
  duration_seconds INTEGER,            -- 游戏时长（秒）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_model_usage_model ON game_model_usage(model_id);
CREATE INDEX IF NOT EXISTS idx_game_model_usage_role ON game_model_usage(role);
CREATE INDEX IF NOT EXISTS idx_game_model_usage_session ON game_model_usage(game_session_id);

-- AI 模型统计聚合表（按模型+角色聚合的统计数据）
CREATE TABLE IF NOT EXISTS ai_model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_id TEXT NOT NULL,              -- 模型ID
  model_name TEXT NOT NULL,            -- 模型显示名称
  role TEXT NOT NULL,                  -- 角色
  total_games INTEGER DEFAULT 0,       -- 总游戏场数
  wins INTEGER DEFAULT 0,              -- 胜利场数
  losses INTEGER DEFAULT 0,            -- 失败场数
  win_rate REAL DEFAULT 0.0,           -- 胜率
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(model_id, role)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_stats_model ON ai_model_stats(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_stats_role ON ai_model_stats(role);
CREATE INDEX IF NOT EXISTS idx_ai_model_stats_win_rate ON ai_model_stats(win_rate DESC);
