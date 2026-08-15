-- ============================================================
-- B3 经济调控：价格覆盖表（之前后台有代码但从未建表，导致调控功能完全不可用）
-- RLS 已全局禁用，服务端 service_role 直连
-- 执行方式：在 Supabase SQL Editor 手动执行（幂等，可重复执行）
-- ============================================================

CREATE TABLE IF NOT EXISTS price_overrides (
  id SERIAL PRIMARY KEY,
  flowers JSONB,          -- { 花id: { baseSellPrice, seedPrice } }
  seeds JSONB,            -- { 种子id: { price } }
  tools JSONB,            -- { 工具id: { price } }
  fee_rate NUMERIC,       -- 手续费倍率，默认 0.05
  min_list_price INTEGER, -- 挂售最低价
  max_list_price INTEGER, -- 挂售最高价
  updated_by TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_overrides_updated ON price_overrides (updated_at DESC);