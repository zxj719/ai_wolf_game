-- 003: Admin permissions, resource queue, game replays

-- Admin 表：存储管理员 email
CREATE TABLE IF NOT EXISTS admins (
  email TEXT PRIMARY KEY,
  added_at TEXT DEFAULT (datetime('now'))
);

-- 初始管理员
INSERT OR IGNORE INTO admins (email) VALUES ('xingjian_zhang719@outlook.com');

-- 资源队列锁：控制 API 调用入口的并发
CREATE TABLE IF NOT EXISTS resource_locks (
  resource TEXT PRIMARY KEY,
  holder_id TEXT,
  holder_role TEXT CHECK(holder_role IN ('admin', 'guest')),
  lease_id TEXT UNIQUE,
  acquired_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

-- 游戏回放存储：保存导出的游戏记录用于回放
CREATE TABLE IF NOT EXISTS game_replays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_session_id TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  game_mode TEXT NOT NULL DEFAULT 'ai-only',
  player_count INTEGER NOT NULL DEFAULT 8,
  winner TEXT CHECK(winner IN ('good_win', 'wolf_win', 'timeout')),
  day_count INTEGER NOT NULL DEFAULT 1,
  replay_data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_replays_user ON game_replays(user_id);
CREATE INDEX IF NOT EXISTS idx_replays_created ON game_replays(created_at DESC);

-- 游戏资产缓存：存储模型生成的背景/头像
CREATE TABLE IF NOT EXISTS game_assets (
  asset_key TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('background', 'avatar')),
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
