-- 010: 角色胜场记录（全能选手成就基础数据）
-- JSON dict {"角色名": 胜场数}，用于追踪玩家用每位家人各赢过几场
ALTER TABLE tennis_progress ADD COLUMN char_wins TEXT NOT NULL DEFAULT '{}';
