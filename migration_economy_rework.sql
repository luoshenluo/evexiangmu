-- 经济体系重构迁移：种子管理 + 官方商品清理 + 玩家旧数据清理
-- 在 Supabase SQL Editor 手动执行

-- ========== 1. 种子覆盖表（后台种子管理） ==========
CREATE TABLE IF NOT EXISTS seed_overrides (
  seed_id TEXT PRIMARY KEY,
  season JSONB,
  tier TEXT,
  price INTEGER,
  official_sell BOOLEAN,
  updated_by TEXT,
  updated_at BIGINT NOT NULL DEFAULT 0
);

-- ========== 2. 清理旧官方挂售（只留基础种子 + 工具） ==========
-- 删除官方挂售的高阶种子/花（保留基础种子 seed_daisy/seed_tulip/seed_sunflower + 工具）
DELETE FROM listings WHERE is_official = true
  AND item_type = 'flower';
DELETE FROM listings WHERE is_official = true
  AND item_type = 'seed'
  AND reference_id NOT IN ('seed_daisy', 'seed_tulip', 'seed_sunflower');

-- 更新官方工具价为官方价（5/8/10/30）
UPDATE listings SET price = 5  WHERE is_official = true AND reference_id = 'watering_can';
UPDATE listings SET price = 8  WHERE is_official = true AND reference_id = 'fertilizer';
UPDATE listings SET price = 10 WHERE is_official = true AND reference_id = 'pesticide';
UPDATE listings SET price = 30 WHERE is_official = true AND reference_id = 'speedup_card';

-- ========== 3. 清空玩家旧数据（种子/花/工具/花束/地块），重新赠送 ==========
-- 注意：这是破坏性操作，清空所有玩家背包与地块
-- 由于赠送逻辑在代码 createUser 里，老玩家用以下 SQL 重置：
-- （保留金币/花瓣/好友/家族/任务等，只清背包、地块、扩容、保护状态）

UPDATE users
SET inventory = CASE
      WHEN username = 'admin' THEN inventory  -- 管理员保留
      ELSE '[]'::jsonb
    END,
    plots = CASE
      WHEN username = 'admin' THEN plots
      ELSE '[]'::jsonb  -- 地块清空（后续自动补 1 块）
    END;

-- 注：admin 账号不清。普通玩家重新登录后，seedDatabase/createInitialPlots 会兜底。
-- 具体"重新赠送种子+除虫剂"建议通过后台或脚本执行（见脚本说明）。

-- ========== 4. 重建官方收购单（统一价收花） ==========
-- 官方收购单保持（rose/daisy 统一价），无需改动
-- 如需重置官方收购单价格到基础价：
UPDATE buy_orders SET price = 30 WHERE is_official = true AND reference_id = 'rose';
UPDATE buy_orders SET price = 12 WHERE is_official = true AND reference_id = 'daisy';
