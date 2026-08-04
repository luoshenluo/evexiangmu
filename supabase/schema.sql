-- =============================================
-- 花园游戏 - Supabase 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- =============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🌱',
  coins INTEGER NOT NULL DEFAULT 100,
  created_at BIGINT NOT NULL,
  last_login BIGINT NOT NULL,
  plots JSONB NOT NULL DEFAULT '[]',
  inventory JSONB NOT NULL DEFAULT '[]',
  inventory_size INTEGER NOT NULL DEFAULT 5,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  muted_until BIGINT,
  family_id TEXT,
  friends JSONB NOT NULL DEFAULT '[]',
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  -- 偷花相关
  steal_count_today INTEGER NOT NULL DEFAULT 0,
  steal_reset_at BIGINT NOT NULL DEFAULT 0,
  -- 花园保护
  garden_protected_until BIGINT NOT NULL DEFAULT 0
);

-- 家族表
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🏰',
  announcement TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  members JSONB NOT NULL DEFAULT '[]',
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  max_members INTEGER NOT NULL DEFAULT 10,
  created_at BIGINT NOT NULL
);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel, timestamp DESC);

-- 市场挂售表
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  item_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  rank INTEGER,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);

-- 收购单表
CREATE TABLE IF NOT EXISTS buy_orders (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  item_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  rank INTEGER,
  price INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);

-- 用户任务表（JSONB 存储任务列表）
CREATE TABLE IF NOT EXISTS user_tasks (
  user_id TEXT PRIMARY KEY,
  tasks JSONB NOT NULL DEFAULT '[]'
);

-- CDK 兑换码表
CREATE TABLE IF NOT EXISTS cdks (
  code TEXT PRIMARY KEY,
  rewards JSONB NOT NULL DEFAULT '{}',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at BIGINT,
  created_at BIGINT NOT NULL,
  used_by JSONB NOT NULL DEFAULT '[]'
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- 游戏全局状态（单行）
CREATE TABLE IF NOT EXISTS game_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_season TEXT NOT NULL DEFAULT 'spring',
  season_start_at BIGINT NOT NULL,
  season_duration BIGINT NOT NULL DEFAULT 28800000,
  CONSTRAINT single_row CHECK (id = 1)
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at BIGINT NOT NULL
);

-- 偷花日志表
CREATE TABLE IF NOT EXISTS steal_logs (
  id TEXT PRIMARY KEY,
  thief_id TEXT NOT NULL,
  thief_name TEXT NOT NULL,
  victim_id TEXT NOT NULL,
  victim_name TEXT NOT NULL,
  plot_id INTEGER NOT NULL,
  flower_type_id TEXT NOT NULL,
  flower_name TEXT NOT NULL,
  flower_emoji TEXT NOT NULL,
  rank INTEGER NOT NULL,
  stolen_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_steal_logs_victim ON steal_logs(victim_id, stolen_at DESC);
CREATE INDEX IF NOT EXISTS idx_steal_logs_thief ON steal_logs(thief_id, stolen_at DESC);

-- 地块偷花记录表（防止同地块一天被偷多次）
CREATE TABLE IF NOT EXISTS plot_steal_records (
  id TEXT PRIMARY KEY,
  victim_id TEXT NOT NULL,
  plot_id INTEGER NOT NULL,
  thief_id TEXT NOT NULL,
  stolen_at BIGINT NOT NULL,
  reset_at BIGINT NOT NULL
);

-- =============================================
-- 初始数据
-- =============================================

-- 游戏状态
INSERT INTO game_state (id, current_season, season_start_at, season_duration)
VALUES (1, 'spring', EXTRACT(EPOCH FROM NOW()) * 1000, 28800000)
ON CONFLICT (id) DO NOTHING;

-- 管理员账号（密码: admin123，bcrypt hash）
INSERT INTO users (id, username, password, nickname, avatar, coins, created_at, last_login, plots, inventory, inventory_size, is_admin, muted_until, family_id, friends, deleted, steal_count_today, steal_reset_at, garden_protected_until)
VALUES (
  'admin',
  'admin',
  '$2a$10$mRz5m5qvtwP0JMb6wuGB/OfbRYuUSdVnpvfOZjW3djv9EBF5ze7Su',
  '花园管理员',
  '👑',
  99999,
  EXTRACT(EPOCH FROM NOW()) * 1000 - 86400000,
  EXTRACT(EPOCH FROM NOW()) * 1000,
  '[]'::jsonb,
  '[]'::jsonb,
  50,
  TRUE,
  NULL,
  NULL,
  '[]'::jsonb,
  FALSE,
  0,
  0,
  0
)
ON CONFLICT (id) DO NOTHING;

-- 演示账号（密码: 123456，bcrypt hash）
INSERT INTO users (id, username, password, nickname, avatar, coins, created_at, last_login, plots, inventory, inventory_size, is_admin, muted_until, family_id, friends, deleted, steal_count_today, steal_reset_at, garden_protected_until)
VALUES (
  'user1',
  'demo',
  '$2a$10$QywGDAdXCAgKZzVzV1kxhOAYXg2.a4Yeme9OJS.vpCF/0l6556jae',
  '小花农',
  '🌱',
  200,
  EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000,
  EXTRACT(EPOCH FROM NOW()) * 1000,
  '[]'::jsonb,
  '[]'::jsonb,
  10,
  FALSE,
  NULL,
  NULL,
  '[]'::jsonb,
  FALSE,
  0,
  0,
  0
)
ON CONFLICT (id) DO NOTHING;

-- 系统欢迎消息
INSERT INTO messages (id, channel, user_id, user_name, content, timestamp, is_system)
VALUES ('msg_1', 'world', 'system', '系统', '欢迎来到花园！祝大家游戏愉快~ 🌸🌺🌻🌷🌹', EXTRACT(EPOCH FROM NOW()) * 1000 - 60000, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 官方种子挂售
INSERT INTO listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, price, quantity, created_at) VALUES
('l1', 'system', '官方', TRUE, 'seed', 'seed_rose', '玫瑰种子', '🌱', 18, 99, EXTRACT(EPOCH FROM NOW()) * 1000 - 100000),
('l2', 'system', '官方', TRUE, 'seed', 'seed_tulip', '郁金香种子', '🌱', 15, 99, EXTRACT(EPOCH FROM NOW()) * 1000 - 90000),
('l3', 'system', '官方', TRUE, 'seed', 'seed_daisy', '雏菊种子', '🌱', 8, 99, EXTRACT(EPOCH FROM NOW()) * 1000 - 80000)
ON CONFLICT (id) DO NOTHING;

-- 官方鲜花挂售
INSERT INTO listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, created_at) VALUES
('l4', 'system', '官方', TRUE, 'flower', 'sunflower', '向日葵', '🌻', 3, 45, 5, EXTRACT(EPOCH FROM NOW()) * 1000 - 70000)
ON CONFLICT (id) DO NOTHING;

-- 官方收购单
INSERT INTO buy_orders (id, buyer_id, buyer_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, created_at) VALUES
('o1', 'system', '官方', TRUE, 'flower', 'rose', '玫瑰', '🌹', 1, 30, 50, EXTRACT(EPOCH FROM NOW()) * 1000 - 50000),
('o2', 'system', '官方', TRUE, 'flower', 'daisy', '雏菊', '🌼', 1, 12, 100, EXTRACT(EPOCH FROM NOW()) * 1000 - 40000)
ON CONFLICT (id) DO NOTHING;

-- 初始公告
INSERT INTO announcements (id, title, content, priority, created_at) VALUES
('ann_1', '🎉 欢迎来到花园！', '欢迎来到花园模拟经营游戏！在这里你可以种花、交易、交友。初始赠送100金币和一些种子，快去你的花园看看吧！', 'urgent', EXTRACT(EPOCH FROM NOW()) * 1000),
('ann_2', '📖 游戏玩法介绍', '1. 在花园中种植花朵，浇水施肥加速成长。2. 收获的花朵可以卖给系统或挂到市场。3. 解锁更多地块和背包格扩大经营。4. 和世界频道的玩家交流心得吧！', 'important', EXTRACT(EPOCH FROM NOW()) * 1000 - 3600000)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- RLS 策略（服务端使用 service_role key 绕过）
-- 如需前端直连 Supabase，可按需开启
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE buy_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE steal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plot_steal_records ENABLE ROW LEVEL SECURITY;
