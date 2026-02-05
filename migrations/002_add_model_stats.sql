-- 添加AI模型统计表
-- 用于记录每个AI模型在不同角色下的表现

-- AI模型统计表
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_model_stats_model ON ai_model_stats(model_id);
CREATE INDEX IF NOT EXISTS idx_model_stats_role ON ai_model_stats(role);
CREATE INDEX IF NOT EXISTS idx_model_stats_winrate ON ai_model_stats(win_rate DESC);

-- 游戏模型使用记录表（记录每局游戏每个AI玩家使用的模型）
CREATE TABLE IF NOT EXISTS game_model_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT NOT NULL,  -- 游戏会话ID（前端生成的唯一ID）
  player_id INTEGER NOT NULL,      -- 玩家编号（1-8）
  role TEXT NOT NULL,              -- 角色
  model_id TEXT NOT NULL,          -- 使用的模型ID
  model_name TEXT NOT NULL,        -- 模型名称
  result TEXT CHECK(result IN ('win', 'lose')) NOT NULL,
  game_mode TEXT NOT NULL,         -- 游戏模式
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_game_usage_session ON game_model_usage(game_session_id);
CREATE INDEX IF NOT EXISTS idx_game_usage_model ON game_model_usage(model_id);
CREATE INDEX IF NOT EXISTS idx_game_usage_created ON game_model_usage(created_at DESC);
