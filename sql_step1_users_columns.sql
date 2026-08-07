-- ============================================================
-- SQL 文件 1 / 3：给 users 表加字段（签到 / 主题 / 花瓣 / 成就）
-- 操作：复制下面全部 → Supabase SQL Editor → 新窗口粘贴 → Run
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
ALTER TABLE users ADD COLUMN IF NOT EXISTS garden_bg TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_check_in_at BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS check_in_streak INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_checkin_days INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_checkin_days_accum INTEGER DEFAULT 0;

ALTER TABLE users ADD COLUMN IF NOT EXISTS petal_coins INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS titles JSONB DEFAULT '[]'::jsonb;

-- 执行完后验证（在 Table Editor 打开 users 表，拉到右边列能看到这些名字就对了）：
--   theme / garden_bg / title
--   last_check_in_at / check_in_streak / total_checkin_days / total_checkin_days_accum
--   petal_coins / achievements / titles
