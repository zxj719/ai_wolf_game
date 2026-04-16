/**
 * server/db.js — SQLite 游戏日志存储
 *
 * 数据库文件: /var/log/wolfgame/games.db (生产) | ./games.db (本地)
 *
 * 表结构：
 *   games      — 每局元数据（版本、配置、结果）
 *   decisions  — 每步 BT 决策（策略路径、评分快照）
 *   speeches   — 每条 AI 发言（策略、facts、润色结果）
 */

import Database from 'better-sqlite3';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.GAMES_DB_PATH
  || (process.env.NODE_ENV === 'production'
    ? '/var/log/wolfgame/games.db'
    : path.join(__dirname, 'games.db'));

let _db = null;

export function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');   // 写入不阻塞读取
  _db.pragma('synchronous = NORMAL'); // 性能与安全折中
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id            TEXT PRIMARY KEY,   -- uuid / nanoid
      ai_version    TEXT NOT NULL,      -- "1.0.0"（来自 server/package.json）
      bt_version    TEXT,               -- 决策引擎版本
      player_count  INTEGER,
      wolf_count    INTEGER,
      config        TEXT,               -- JSON: 角色配置
      winner_team   TEXT,               -- "wolf" | "villager" | null(未完成)
      ended_at      TEXT,               -- ISO 时间
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id       TEXT NOT NULL REFERENCES games(id),
      day_count     INTEGER,
      phase         TEXT,               -- "night" | "day"
      player_id     INTEGER,
      role          TEXT,
      action_type   TEXT,               -- "DAY_VOTE" | "NIGHT_GUARD" 等
      strategy      TEXT,               -- BT 选中的策略名
      target_id     INTEGER,            -- 决策目标
      reasoning     TEXT,               -- BT 推理说明
      suspicion_top TEXT,               -- JSON: [{id, score}] 前3名嫌疑
      trust_top     TEXT,               -- JSON: [{id, score}] 前3名信任
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS speeches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id       TEXT NOT NULL REFERENCES games(id),
      day_count     INTEGER,
      player_id     INTEGER,
      role          TEXT,
      strategy      TEXT,               -- "fake_seer" | "quiet_villager" 等
      suspect_target INTEGER,
      vote_target   INTEGER,
      facts         TEXT,               -- JSON: string[]
      speech        TEXT,               -- LLM 润色后的完整发言
      model_used    TEXT,               -- 实际使用的润色模型
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 按版本查胜率的常用索引
    CREATE INDEX IF NOT EXISTS idx_games_version  ON games(ai_version);
    CREATE INDEX IF NOT EXISTS idx_games_result   ON games(winner_team);
    CREATE INDEX IF NOT EXISTS idx_decisions_game ON decisions(game_id);
    CREATE INDEX IF NOT EXISTS idx_speeches_game  ON speeches(game_id);
  `);
}

// ── 写入 API ───────────────────────────────────────────────

/** 创建新局（游戏开始时调用） */
export function createGame({ id, aiVersion, btVersion, playerCount, wolfCount, config }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO games (id, ai_version, bt_version, player_count, wolf_count, config)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, aiVersion, btVersion, playerCount, wolfCount, JSON.stringify(config ?? {}));
}

/** 记录 BT 决策 */
export function logDecision({ gameId, dayCount, phase, playerId, role, actionType,
  strategy, targetId, reasoning, suspicionMap, trustMap }) {
  const db = getDb();
  const topN = (map, n = 3) => {
    if (!map) return null;
    const arr = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return JSON.stringify(arr.map(([id, score]) => ({ id, score })));
  };
  db.prepare(`
    INSERT INTO decisions
      (game_id, day_count, phase, player_id, role, action_type, strategy,
       target_id, reasoning, suspicion_top, trust_top)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(gameId, dayCount, phase, playerId, role, actionType,
    strategy, targetId ?? null, reasoning ?? null,
    topN(suspicionMap), topN(trustMap));
}

/** 记录 AI 发言 */
export function logSpeech({ gameId, dayCount, playerId, role, strategy,
  suspectTarget, voteTarget, facts, speech, modelUsed }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO speeches
      (game_id, day_count, player_id, role, strategy, suspect_target,
       vote_target, facts, speech, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(gameId, dayCount, playerId, role, strategy ?? null,
    suspectTarget ?? null, voteTarget ?? null,
    JSON.stringify(facts ?? []), speech ?? null, modelUsed ?? null);
}

/** 游戏结束：写入胜利方 */
export function endGame({ gameId, winnerTeam }) {
  const db = getDb();
  db.prepare(`
    UPDATE games SET winner_team = ?, ended_at = datetime('now') WHERE id = ?
  `).run(winnerTeam, gameId);
}

// ── 查询 API ───────────────────────────────────────────────

/** 按版本统计胜率 */
export function statsByVersion() {
  return getDb().prepare(`
    SELECT
      ai_version,
      COUNT(*)                                          AS total,
      SUM(CASE WHEN winner_team = 'wolf'     THEN 1 ELSE 0 END) AS wolf_wins,
      SUM(CASE WHEN winner_team = 'villager' THEN 1 ELSE 0 END) AS villager_wins,
      ROUND(100.0 * SUM(CASE WHEN winner_team = 'wolf' THEN 1 ELSE 0 END)
            / MAX(COUNT(*), 1), 1)                      AS wolf_win_pct
    FROM games
    WHERE winner_team IS NOT NULL
    GROUP BY ai_version
    ORDER BY ai_version DESC
  `).all();
}

/** 获取最近 N 局的完整决策日志（用于 LLM 分析） */
export function exportGames(limit = 20, aiVersion = null) {
  const db = getDb();
  const games = db.prepare(`
    SELECT * FROM games
    WHERE winner_team IS NOT NULL
      ${aiVersion ? "AND ai_version = ?" : ""}
    ORDER BY created_at DESC LIMIT ?
  `).all(...(aiVersion ? [aiVersion, limit] : [limit]));

  return games.map(g => ({
    ...g,
    config: JSON.parse(g.config || '{}'),
    decisions: db.prepare('SELECT * FROM decisions WHERE game_id = ? ORDER BY id').all(g.id),
    speeches:  db.prepare('SELECT * FROM speeches  WHERE game_id = ? ORDER BY id').all(g.id)
      .map(s => ({ ...s, facts: JSON.parse(s.facts || '[]') })),
  }));
}
