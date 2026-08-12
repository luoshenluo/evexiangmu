-- ============================================================
-- 花园项目 热更新迁移脚本（2026-08-12）
-- 请在 Supabase SQL Editor 中按顺序执行
-- ============================================================

-- ============================================================
-- 第一部分：统计 & 在线用户追踪
-- 需求：管理员后台数据总览统计"最近5分钟活跃用户"
-- ============================================================

-- 新增 users.last_active_at 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at BIGINT;

-- 初始化：用 last_login 作为兜底
UPDATE users SET last_active_at = GREATEST(last_login, created_at) WHERE last_active_at IS NULL;

-- 索引：加速在线查询
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users (last_active_at DESC);


-- ============================================================
-- 第二部分：私聊系统表 private_messages
-- 需求：好友之间一对一私聊（替换原有"好友"公共频道）
-- ============================================================

CREATE TABLE IF NOT EXISTS private_messages (
  id           TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id   TEXT NOT NULL,
  content      TEXT NOT NULL,
  from_name    TEXT,
  from_avatar  TEXT,
  to_name      TEXT,
  to_avatar    TEXT,
  created_at   BIGINT NOT NULL,
  read_at      BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pm_from_to_created ON private_messages (from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_to_from_created ON private_messages (to_user_id, from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_created ON private_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_unread ON private_messages (to_user_id, read_at NULLS FIRST);

ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_select_self ON private_messages;
CREATE POLICY pm_select_self ON private_messages FOR SELECT
  USING (
    from_user_id = current_user
    OR to_user_id = current_user
    OR (auth.role() = 'anon' AND false)
  );

DROP POLICY IF EXISTS pm_insert_self ON private_messages;
CREATE POLICY pm_insert_self ON private_messages FOR INSERT
  WITH CHECK (
    from_user_id = current_user
    OR (auth.role() = 'anon' AND false)
  );