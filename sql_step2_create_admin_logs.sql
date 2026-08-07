-- ============================================================
-- SQL 文件 2 / 3：创建 admin_logs 管理员审计表 + 索引
-- 操作：复制下面全部 → Supabase SQL Editor → 新窗口粘贴 → Run
-- 提示：这个文件和文件 1 完全独立，互不影响
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  admin_name  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      JSONB,
  created_at  BIGINT NOT NULL,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_type ON admin_logs (target_type);

-- 执行完后验证：Table Editor 左侧表列表里能看到 admin_logs 就对了
