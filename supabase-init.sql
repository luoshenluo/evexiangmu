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

-- 6. 为 app_settings 启用 RLS（行级安全）
ALTER TABLE site_visitors_online ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_analytics_daily ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户读写（前端通过 anon key 访问）
CREATE POLICY "anon_all" ON site_visitors_online FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON site_page_views FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_select" ON site_analytics_daily FOR SELECT TO anon USING (true);
