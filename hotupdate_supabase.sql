-- ==============================================================
--  🌸 花园游戏 - 2025 热更新 Supabase 数据库变更 SQL
--  复制到 Supabase 项目 -> SQL Editor -> New Query 中一次性执行
-- ==============================================================

-- ========== 1. users 表：补充本轮新增列 ==========
DO $$
BEGIN
  -- 主题（light/garden/sunset/ocean/dark）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='theme') THEN
    ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'garden';
  END IF;
  -- 花园背景皮肤（default/green/purple/blue/sunset/sakura/autumn/night/ocean）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='garden_bg') THEN
    ALTER TABLE users ADD COLUMN garden_bg TEXT NOT NULL DEFAULT 'default';
  END IF;
  -- 当前装备的称号 key（newbie/checkin_dragon/expert 等，空字符串表示不显示）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='title') THEN
    ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT '';
  END IF;
  -- 已解锁的称号数组(JSONB)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='titles') THEN
    ALTER TABLE users ADD COLUMN titles JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  -- 花瓣币（CDK/成就/活动发放的高级货币）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='petal_coins') THEN
    ALTER TABLE users ADD COLUMN petal_coins INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- 成就进度对象（JSONB）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='achievements') THEN
    ALTER TABLE users ADD COLUMN achievements JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  -- 签到
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_check_in_at') THEN
    ALTER TABLE users ADD COLUMN last_check_in_at BIGINT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='check_in_streak') THEN
    ALTER TABLE users ADD COLUMN check_in_streak INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='total_checkin_days') THEN
    ALTER TABLE users ADD COLUMN total_checkin_days INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='total_checkin_days_accum') THEN
    ALTER TABLE users ADD COLUMN total_checkin_days_accum INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- 子管理员权限位（bitmask，0 位=用户管理，1=公告，2=聊天/敏感词，3=CDK 管理，4=市场，5=外观，6=总览；全 1=超级子管）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='admin_permissions') THEN
    ALTER TABLE users ADD COLUMN admin_permissions INTEGER NOT NULL DEFAULT 0;
  END IF;
  -- 好友系统：入站/出站好友请求 JSONB
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='incoming_friend_requests') THEN
    ALTER TABLE users ADD COLUMN incoming_friend_requests JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='outgoing_friend_requests') THEN
    ALTER TABLE users ADD COLUMN outgoing_friend_requests JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  -- 封号截止（禁言是 muted_until，封号是 banned_until + deleted=true）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='banned_until') THEN
    ALTER TABLE users ADD COLUMN banned_until BIGINT;
  END IF;
  -- 家族成员：family_id（旧版本可能漏掉，如果有的话就跳过）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='family_id') THEN
    ALTER TABLE users ADD COLUMN family_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  -- 任务进度三列
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='task_progress') THEN
    ALTER TABLE users ADD COLUMN task_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='task_claimed') THEN
    ALTER TABLE users ADD COLUMN task_claimed JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='task_last_reset') THEN
    ALTER TABLE users ADD COLUMN task_last_reset JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ========== 1b. 创建 seedDatabase 自修复 RPC（让 Edge Function 能自动补列） ==========
CREATE OR REPLACE FUNCTION public._garden_ensure_users_cols()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='admin_permissions') THEN
    ALTER TABLE users ADD COLUMN admin_permissions INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='family_id') THEN
    ALTER TABLE users ADD COLUMN family_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_admin') THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='banned_until') THEN
    ALTER TABLE users ADD COLUMN banned_until BIGINT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='petal_coins') THEN
    ALTER TABLE users ADD COLUMN petal_coins INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='title') THEN
    ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='titles') THEN
    ALTER TABLE users ADD COLUMN titles JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='achievements') THEN
    ALTER TABLE users ADD COLUMN achievements JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='muted_until') THEN
    ALTER TABLE users ADD COLUMN muted_until BIGINT;
  END IF;
END;
$$;

-- ========== 2. families 表：确保等级/经验/成员上限列齐全（若表是旧版本缺失） ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='level') THEN
    ALTER TABLE families ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='exp') THEN
    ALTER TABLE families ADD COLUMN exp INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='max_members') THEN
    ALTER TABLE families ADD COLUMN max_members INTEGER NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='announcement') THEN
    ALTER TABLE families ADD COLUMN announcement TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='avatar') THEN
    ALTER TABLE families ADD COLUMN avatar TEXT NOT NULL DEFAULT '🏰';
  END IF;
  -- 家族公告、创建时间（早期表结构可能缺）
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='families' AND column_name='created_at') THEN
    ALTER TABLE families ADD COLUMN created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())*1000)::BIGINT;
  END IF;
END $$;

-- ========== 3. cdks 表：used_by 数组列（旧表可能缺） ==========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cdks' AND column_name='used_by') THEN
    ALTER TABLE cdks ADD COLUMN used_by JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ========== 4. 数据一致性：修正旧家族行的 level / max_members ==========
-- 旧数据经验可能为 NULL 或等级不对，这里统一刷一次
UPDATE families
SET
  level = CASE
    WHEN (exp IS NULL) THEN 1
    WHEN exp < 100  THEN 1
    WHEN exp < 300  THEN 2
    WHEN exp < 700  THEN 3
    WHEN exp < 1500 THEN 4
    WHEN exp < 3000 THEN 5
    WHEN exp < 6000 THEN 6
    WHEN exp < 12000 THEN 7
    WHEN exp < 24000 THEN 8
    WHEN exp < 50000 THEN 9
    ELSE 10 END,
  exp = COALESCE(exp, 0)
WHERE level IS NULL OR level < 1 OR level > 10 OR exp IS NULL;

-- 刷 max_members 与 level 对齐（Lv1=10 / 每级+10 / Lv10=100）
UPDATE families
SET max_members = 10 + (LEAST(10, GREATEST(1, level)) - 1) * 10
WHERE max_members IS NULL OR max_members <> (10 + (LEAST(10, GREATEST(1, level)) - 1) * 10);

-- ========== 5. 老用户的 petalCoins/theme 等默认值初始化（避免 SELECT 时 NULL） ==========
UPDATE users
SET
  theme          = COALESCE(NULLIF(theme, ''), 'garden'),
  garden_bg      = COALESCE(NULLIF(garden_bg, ''), 'default'),
  title          = COALESCE(title, ''),
  titles         = COALESCE(titles, '[]'::jsonb),
  petal_coins    = COALESCE(petal_coins, 0),
  achievements   = COALESCE(achievements, '{}'::jsonb),
  admin_permissions = COALESCE(admin_permissions, 0);

-- ========== 6. 为高频查询补索引（若还没加） ==========
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_families_owner_id ON families(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_reference_price ON listings(reference_id, price);
CREATE INDEX IF NOT EXISTS idx_cdks_expires_at ON cdks(expires_at) WHERE expires_at IS NOT NULL;

-- ========== 7. 家族脏数据清理（必须做，修复"之前加入的家族无法退出"） ==========
-- 7a. family_id 指向不存在家族的用户 → 重置 family_id
UPDATE users u
SET family_id = NULL
WHERE u.family_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM families f WHERE f.id = u.family_id);

-- 7b. 清理家族 members 中已注销的用户，以及 users.family_id 与 members 不匹配的记录
DO $$
DECLARE
  f RECORD;
  cleaned_members JSONB;
BEGIN
  FOR f IN SELECT id, owner_id, members FROM families LOOP
    -- 过滤不存在或 family_id 不等于当前家族的 members
    cleaned_members := (
      SELECT COALESCE(jsonb_agg(m), '[]'::jsonb)
      FROM jsonb_array_elements(f.members) AS m
      WHERE (m->>'userId') IS NOT NULL
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = (m->>'userId'))
        AND (
          -- 用户 family_id 与家族 id 一致，或用户 family_id 为空但此家族 owner 为本人（族长）
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = (m->>'userId')
              AND (u.family_id = f.id OR u.id = f.owner_id)
          )
        )
    );
    -- 清理 owner 为空时自动转让第一个 member
    IF f.owner_id IS NULL OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.owner_id) THEN
      IF (cleaned_members->0->>'userId') IS NOT NULL THEN
        UPDATE families SET owner_id = (cleaned_members->0->>'userId') WHERE id = f.id;
        cleaned_members := (
          SELECT jsonb_agg(
            CASE WHEN (elem->>'userId') = (cleaned_members->0->>'userId')
                 THEN jsonb_set(elem, '{role}', '"owner"')
                 ELSE elem
            END
          )
          FROM jsonb_array_elements(cleaned_members) AS elem
        );
      END IF;
    END IF;
    IF cleaned_members IS NULL THEN cleaned_members := '[]'::jsonb; END IF;
    -- 写回
    UPDATE families SET members = cleaned_members WHERE id = f.id;
  END LOOP;
END $$;

-- 7c. 解除 family.members 里成员数=0 的空家族
DELETE FROM families WHERE jsonb_array_length(COALESCE(members, '[]'::jsonb)) = 0;

-- 7d. 最后：users.family_id ≠ NULL，但该用户不在该家族 members 中的 => 修复（加回 members 或清 family_id）
UPDATE users u
SET family_id = NULL
WHERE u.family_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM families f WHERE f.id = u.family_id)
  AND NOT EXISTS (
    SELECT 1 FROM families f, jsonb_array_elements(f.members) AS m
    WHERE f.id = u.family_id AND (m->>'userId') = u.id
  );

-- ========== 8. 管理员默认权限修复：is_admin=true 但 admin_permissions=0 且非超管 => 给基础 7 ==========
UPDATE users
SET admin_permissions = 7  -- Bit0+Bit1+Bit2 = 用户管理 + 公告 + 聊天管理
WHERE is_admin = TRUE
  AND COALESCE(admin_permissions, 0) = 0
  AND id <> 'admin';  -- 超管 admin 保留默认 0 也没关系，auth 端会直接 isSuperAdmin

-- ========== 执行完毕提示 ==========
SELECT '✅ Hot Update 完成：列补齐 + 索引 + 家族脏数据清理 + 管理员权限修复' AS notice;
