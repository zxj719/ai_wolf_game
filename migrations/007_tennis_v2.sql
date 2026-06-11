-- 007: 网球 v2 永久养成层（装备/金币/绝技图鉴/成就/通关数）

CREATE TABLE IF NOT EXISTS tennis_progress (
  user_id INTEGER PRIMARY KEY,
  coins INTEGER NOT NULL DEFAULT 0,
  equipment TEXT NOT NULL DEFAULT '{}',
  unlocked_moves TEXT NOT NULL DEFAULT '[]',
  achievements TEXT NOT NULL DEFAULT '[]',
  championships INTEGER NOT NULL DEFAULT 0,
  adventure_clears INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
