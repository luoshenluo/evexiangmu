-- ============================================================
-- 花园游戏 · 热更新补丁 SQL（签到/设置/小游戏/成就/审计日志）
-- 执行位置：Supabase 控制台 → SQL Editor → 粘贴全文 → Run
-- 全部使用 IF NOT EXISTS，可安全重复执行，不会破坏已有数据
-- ============================================================


-- ============================================================
-- 第一部分：users 表新增字段
-- 作用：让签到记录、主题皮肤、花瓣代币、成就能持久化保存
-- ============================================================

-- 主题与外观
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';        -- 主题：light/dark/garden/sunset/ocean
ALTER TABLE users ADD COLUMN IF NOT EXISTS garden_bg TEXT DEFAULT '';          -- 花园背景皮肤
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';              -- 个人称号

-- 每日签到
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_check_in_at BIGINT DEFAULT 0;       -- 上次签到时间戳
ALTER TABLE users ADD COLUMN IF NOT EXISTS check_in_streak INTEGER DEFAULT 0;        -- 连续签到天数
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_checkin_days INTEGER DEFAULT 0;     -- 当前周期累计签到
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_checkin_days_accum INTEGER DEFAULT 0; -- 历史累计签到（永不重置）

-- 小游戏与成就
ALTER TABLE users ADD COLUMN IF NOT EXISTS petal_coins INTEGER DEFAULT 0;           -- 花瓣代币（小游戏用）
ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '{}'::jsonb;  -- 成就记录 { [key]: { unlockedAt: 时间戳 } }
ALTER TABLE users ADD COLUMN IF NOT EXISTS titles JSONB DEFAULT '[]'::jsonb;        -- 已解锁称号列表


-- ============================================================
-- 第二部分：管理员操作审计日志表
-- 作用：记录管理员的所有操作（禁言/封号/发金币/改价格等）
-- 如果表不存在，代码会自动退化为内存缓存（重启丢失），所以建议创建
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_logs (
  id          TEXT PRIMARY KEY,           -- 日志ID
  admin_id    TEXT NOT NULL,              -- 操作管理员ID
  admin_name  TEXT,                       -- 管理员昵称
  action      TEXT NOT NULL,              -- 操作类型（如 mute_user / ban_user / set_price）
  target_type TEXT,                       -- 目标类型：user/announcement/cdk/chat/market/setting/permissions/economy
  target_id   TEXT,                       -- 目标对象ID
  detail      JSONB,                      -- 操作详情
  created_at  BIGINT NOT NULL,            -- 操作时间戳
  ip          TEXT                        -- 操作IP
);

-- 加速查询的索引
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON admin_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target_type ON admin_logs (target_type);


-- ============================================================
-- admin_logs 安全说明
-- 本项目使用自定义 JWT + 后端 API 层权限校验（不是 Supabase Auth），
-- 所以不使用 RLS 行级安全。admin_logs 所有读写都经过 API 鉴权，
-- 直接 DISABLE RLS 最简单，且安全性不降低。
-- ============================================================
ALTER TABLE admin_logs DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 执行完毕！
-- 验证方法：
--   1. 回到游戏登录，访问 /checkin 签到，退出重登看连续天数是否保持
--   2. 访问 /minigames 抽奖，看花瓣是否正常扣减
--   3. 访问 /settings 切换主题，刷新页面看是否保持
-- ============================================================
