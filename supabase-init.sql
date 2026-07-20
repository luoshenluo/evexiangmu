-- =====================================================
-- EVE 造船成本计算器 - Supabase 数据库初始化脚本
-- 在 Supabase 控制台 → SQL Editor 中执行
-- =====================================================

-- 1. 在线访客表
CREATE TABLE IF NOT EXISTS site_visitors_online (
  visitor_id   TEXT PRIMARY KEY,
  page         TEXT NOT NULL DEFAULT '/',
  user_agent   TEXT NOT NULL DEFAULT '',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 允许按 last_heartbeat 过滤和排序
CREATE INDEX IF NOT EXISTS idx_visitors_heartbeat ON site_visitors_online (last_heartbeat DESC);

-- 2. 页面访问日志表
CREATE TABLE IF NOT EXISTS site_page_views (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id TEXT NOT NULL DEFAULT '',
  page       TEXT NOT NULL DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 允许按日期查询和聚合
CREATE INDEX IF NOT EXISTS idx_page_views_created ON site_page_views (created_at DESC);

-- 3. 每日统计汇总表
CREATE TABLE IF NOT EXISTS site_analytics_daily (
  date             DATE PRIMARY KEY,
  page_views       BIGINT NOT NULL DEFAULT 0,
  unique_visitors  BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 每日聚合函数（RPC）
-- 从 site_page_views 汇总当日数据到 site_analytics_daily
CREATE OR REPLACE FUNCTION aggregate_daily_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO site_analytics_daily (date, page_views, unique_visitors, updated_at)
  SELECT
    CURRENT_DATE,
    COUNT(*)::BIGINT,
    COUNT(DISTINCT visitor_id)::BIGINT,
    NOW()
  FROM site_page_views
  WHERE created_at >= CURRENT_DATE
  ON CONFLICT (date) DO UPDATE SET
    page_views      = EXCLUDED.page_views,
    unique_visitors = EXCLUDED.unique_visitors,
    updated_at      = NOW();
END;
$$;

-- 5. 为公告管理创建 app_settings 记录（如不存在）
INSERT INTO app_settings (key, value, updated_at)
VALUES ('announcement', '{"title":"提示","content":"欢迎使用EVE造船成本计算器","enabled":true,"updated_at":"2026-07-17T00:00:00.000Z"}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 用户表（app_users）
-- =====================================================
CREATE TABLE IF NOT EXISTS app_users (
  username         TEXT PRIMARY KEY,
  password_hash    TEXT NOT NULL,
  security_question TEXT NOT NULL DEFAULT '',
  security_answer   TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户名唯一索引（已由 PRIMARY KEY 保证）

-- =====================================================
-- 7. 用户云端数据表（user_data）
-- =====================================================
CREATE TABLE IF NOT EXISTS user_cloud_data (
  username   TEXT PRIMARY KEY REFERENCES app_users(username) ON DELETE CASCADE,
  data_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 8. 启用 RLS（行级安全）
-- =====================================================
ALTER TABLE site_visitors_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cloud_data ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 9. RLS 策略
-- =====================================================

-- 访客相关：允许匿名读写
CREATE POLICY "anon_all" ON site_visitors_online FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON site_page_views FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_select" ON site_analytics_daily FOR SELECT TO anon USING (true);

-- 用户表：允许匿名注册、登录（插入和按用户名查询）
-- 注册：允许插入
CREATE POLICY "anon_insert_user" ON app_users FOR INSERT TO anon WITH CHECK (true);
-- 登录/查重：允许按 username 精确查询
CREATE POLICY "anon_select_user" ON app_users FOR SELECT TO anon USING (true);
-- 修改密码：允许更新（通过前端哈希后的密码）
CREATE POLICY "anon_update_user" ON app_users FOR UPDATE TO anon USING (true) WITH CHECK (true);
-- 管理员删除用户
CREATE POLICY "anon_delete_user" ON app_users FOR DELETE TO anon USING (true);

-- 云端数据：用户只能操作自己的数据（通过前端控制 username）
CREATE POLICY "anon_all_cloud" ON user_cloud_data FOR ALL TO anon USING (true) WITH CHECK (true);