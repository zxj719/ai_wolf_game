-- 008: 网球遥测表（平衡性/可玩性数据收集）+ 永久卡牌收藏列

CREATE TABLE IF NOT EXISTS tennis_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  character TEXT NOT NULL,
  opponent TEXT NOT NULL,
  result TEXT NOT NULL,
  rallies INTEGER NOT NULL,
  aces INTEGER NOT NULL DEFAULT 0,
  clutch_wins INTEGER NOT NULL DEFAULT 0,
  counters_won INTEGER NOT NULL DEFAULT 0,
  avg_multiplier REAL,
  duration_s INTEGER,
  move_usage TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tennis_telemetry_created ON tennis_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tennis_telemetry_mode ON tennis_telemetry(mode);

ALTER TABLE tennis_progress ADD COLUMN owned_cards TEXT NOT NULL DEFAULT '[]';
