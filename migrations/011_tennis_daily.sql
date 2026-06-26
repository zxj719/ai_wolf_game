-- 011: 每日一战完成记录（全家排行榜基础数据）
-- 同一选手同一天只保留第一条，ON CONFLICT(date, player_name) DO NOTHING
CREATE TABLE IF NOT EXISTS tennis_daily_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- 'YYYY-MM-DD' UTC
  player_name TEXT NOT NULL,      -- CHARS 白名单之一
  foe_name TEXT NOT NULL,         -- 今日对手名（CHARS 白名单）
  won INTEGER NOT NULL DEFAULT 0, -- 1=胜, 0=负
  duration_s INTEGER,             -- 比赛耗时秒数（可为 NULL）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, player_name)
);

CREATE INDEX IF NOT EXISTS idx_daily_date ON tennis_daily_completions(date, created_at);
