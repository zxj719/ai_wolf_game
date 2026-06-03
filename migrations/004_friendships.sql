-- 004: 好友系统 — 好友关系 + 好友申请

-- 好友关系：无向边，规范化存储（user_a < user_b），避免重复行
CREATE TABLE IF NOT EXISTS friendships (
  user_a     INTEGER NOT NULL,           -- 较小的 user id
  user_b     INTEGER NOT NULL,           -- 较大的 user id
  created_at INTEGER NOT NULL,           -- epoch ms
  PRIMARY KEY (user_a, user_b)
);

-- 好友申请（有方向）
CREATE TABLE IF NOT EXISTS friend_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user  INTEGER NOT NULL,
  to_user    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected
  created_at INTEGER NOT NULL,
  UNIQUE (from_user, to_user)
);
CREATE INDEX IF NOT EXISTS idx_freq_to ON friend_requests(to_user, status);
