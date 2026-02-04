-- Migration: 001_add_token_columns
-- Date: 2026-02-04
-- Description: 为 users 表添加 ModelScope 令牌相关列
--
-- 执行命令:
-- npx wrangler d1 execute wolfgame-db --remote --file=./migrations/001_add_token_columns.sql

-- 添加 ModelScope API 令牌存储列
ALTER TABLE users ADD COLUMN modelscope_token TEXT;

-- 添加令牌验证时间列
ALTER TABLE users ADD COLUMN token_verified_at TIMESTAMP;
