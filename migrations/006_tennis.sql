-- 006: 家庭网球公开赛战绩表
-- 用户名通过 join users 取得，不冗余存储（与 game_history 模式一致）

CREATE TABLE IF NOT EXISTS tennis_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  character TEXT NOT NULL,
  character_face TEXT,
  opponent TEXT NOT NULL,
  opponent_face TEXT,
  sets_won INTEGER NOT NULL,
  sets_lost INTEGER NOT NULL,
  reaction_ms INTEGER,
  grade TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tennis_matches_user ON tennis_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_tennis_matches_created ON tennis_matches(created_at DESC);
