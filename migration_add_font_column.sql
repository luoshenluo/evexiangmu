-- ============================================================
-- 迁移：users 表加 font 列（外观设置 - 字体切换）
-- 操作：复制下面全部 → Supabase SQL Editor → 新窗口粘贴 → Run
-- 或在本地运行：node scripts/init-db.js migration_add_font_column.sql
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS font TEXT DEFAULT 'system';

-- 执行完后验证（在 Table Editor 打开 users 表，能看到 font 列即成功）