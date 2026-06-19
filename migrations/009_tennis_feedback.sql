-- 009: 赛后用户评价表（1-5 星 + 可选一句话）
CREATE TABLE IF NOT EXISTS tennis_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  mode TEXT,
  character TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tennis_feedback_created ON tennis_feedback(created_at DESC);
