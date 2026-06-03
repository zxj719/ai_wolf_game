-- 005: 私聊消息（Phase 2）
CREATE TABLE IF NOT EXISTS chat_messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_key TEXT    NOT NULL,     -- "minId:maxId"
  from_user        INTEGER NOT NULL,
  body             TEXT    NOT NULL,
  created_at       INTEGER NOT NULL,     -- epoch ms（仅用于展示）
  read_at          INTEGER               -- NULL = 未读（预留，本期无 markRead 端点）
);

-- 分页/排序用唯一单调 id（非 created_at，避免同毫秒丢消息/乱序）
CREATE INDEX IF NOT EXISTS idx_chat_conv_id ON chat_messages(conversation_key, id);
