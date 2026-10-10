-- 012: 小游戏全网排行榜（扫雷 / 麻将消除，注册用户共享）
-- 每次通关一条记录；排行榜按 (game, variant) 取每个用户的最好成绩
CREATE TABLE IF NOT EXISTS minigame_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,          -- 'minesweeper' | 'mahjong'
  variant TEXT NOT NULL,       -- 扫雷难度 / 麻将布局 id（白名单见 workers/auth/minigamesLib.js）
  time_ms INTEGER NOT NULL,    -- 通关用时（麻将含提示罚时）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_minigame_board ON minigame_scores(game, variant, user_id, time_ms);
