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
  from_user_id TEXT NOT NULL,              -- 发送者用户ID
  to_user_id   TEXT NOT NULL,              -- 接收者用户ID
  content      TEXT NOT NULL,              -- 消息内容
  from_name    TEXT,                       -- 发送者昵称（冗余便于查询展示）
  from_avatar  TEXT,                       -- 发送者头像（冗余便于查询展示）
  to_name      TEXT,                       -- 接收者昵称（冗余便于查询展示）
  to_avatar    TEXT,                       -- 接收者头像（冗余便于查询展示）
  created_at   BIGINT NOT NULL,            -- 发送时间戳 ms
  read_at      BIGINT                      -- 阅读时间戳 ms（null=未读）
);

-- 索引：按发送方/接收方查询会话列表和消息时间排序
CREATE INDEX IF NOT EXISTS idx_pm_from_to_created ON private_messages (from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_to_from_created ON private_messages (to_user_id, from_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_created ON private_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_unread ON private_messages (to_user_id, read_at NULLS FIRST);

-- RLS 开启（可选）：只有收发双方能看到自己的消息
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

-- 读：发送方和接收方都能读
DROP POLICY IF EXISTS pm_select_self ON private_messages;
CREATE POLICY pm_select_self ON private_messages FOR SELECT
  USING (
    from_user_id = current_user
    OR to_user_id = current_user
    OR (auth.role() = 'anon' AND false) -- 匿名禁止，所有读走后端API
  );

-- 写：只能写自己为发送者的消息（即使 RLS 也通过 API 鉴权更严，这里兜底）
DROP POLICY IF EXISTS pm_insert_self ON private_messages;
CREATE POLICY pm_insert_self ON private_messages FOR INSERT
  WITH CHECK (
    from_user_id = current_user
    OR (auth.role() = 'anon' AND false)
  );
