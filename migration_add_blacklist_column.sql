-- ============================================================
-- P0-2 黑名单（拉黑/屏蔽）功能
-- 在 users 表新增 blacklist 列（JSONB 数组，存被拉黑用户 id）
-- 拉黑后：公共频道消息互不可见、禁止私聊、自动解除好友关系
-- 执行方式：在 Supabase SQL Editor 手动执行（或 node scripts/init-db.js migration_add_blacklist_column.sql）
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklist JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_blacklist ON users USING GIN (blacklist);
