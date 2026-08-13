-- =============================================
-- ⚠️⚠️⚠️ 危险脚本 · 勿在生产环境执行 ⚠️⚠️⚠️
-- =============================================
-- 本脚本会 DROP 全部业务表并重建，执行将清空所有用户/交易/聊天数据！
-- 仅用于本地开发或全新初始化数据库。生产环境请勿运行。
-- 若需在线修改数据库，请使用 supabase/schema.sql 或单独迁移脚本。
-- =============================================
-- 花园游戏 Supabase Schema · 彻底重置版 v1.3
-- 修复: integer out of range (所有时间列显式 bigint + seasonDuration 匹配游戏实际值)
-- =============================================

-- ========= 第一步：彻底清空 =========
drop table if exists public.official_buy_prices cascade;
drop table if exists public.steal_logs cascade;
drop table if exists public.plot_steal_records cascade;
drop table if exists public.notifications cascade;
drop table if exists public.cdks cascade;
drop table if exists public.announcements cascade;
drop table if exists public.buy_orders cascade;
drop table if exists public.listings cascade;
drop table if exists public.messages cascade;
drop table if exists public.families cascade;
drop table if exists public.game_state cascade;
drop table if exists public.users cascade;

-- ========= 第二步：建表 (所有时间/大数字列显式 bigint) =========

-- 1. 用户表
create table public.users (
  id text primary key,
  username text unique not null,
  password text not null,
  nickname text not null,
  avatar text default '🌸',
  coins bigint default 100,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  last_login bigint default 0::bigint,
  plots jsonb default '[]'::jsonb,
  inventory jsonb default '[]'::jsonb,
  inventory_size integer default 30,
  is_admin boolean default false,
  muted_until bigint default 0::bigint,
  family_id text default null,
  friends jsonb default '[]'::jsonb,
  steal_count_today integer default 0,
  steal_reset_at bigint default 0::bigint,
  garden_protected_until bigint default 0::bigint
);

-- 2. 家族表
create table public.families (
  id text primary key,
  name text not null,
  avatar text default '🏰',
  announcement text default '',
  owner_id text not null references public.users(id) on delete cascade,
  members jsonb default '[]'::jsonb,
  level integer default 1,
  exp integer default 0,
  max_members integer default 20,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

-- 3. 聊天消息表
create table public.messages (
  id text primary key,
  channel text not null,
  user_id text not null references public.users(id) on delete cascade,
  user_name text not null,
  content text not null,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  is_system boolean default false
);
create index idx_messages_channel on public.messages(channel, created_at desc);

-- 4. 市场挂售表
create table public.listings (
  id text primary key,
  seller_id text not null references public.users(id) on delete cascade,
  seller_name text not null,
  is_official boolean default false,
  item_type text not null,
  reference_id text not null,
  name text not null,
  emoji text,
  rank integer default 1,
  quantity integer default 1,
  price bigint not null,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
create index idx_listings_reference on public.listings(reference_id);

-- 5. 市场收购订单表
create table public.buy_orders (
  id text primary key,
  buyer_id text not null references public.users(id) on delete cascade,
  buyer_name text not null,
  item_type text not null,
  reference_id text not null,
  name text not null,
  emoji text,
  rank integer default 1,
  quantity integer default 1,
  price bigint not null,
  fulfilled boolean default false,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
create index idx_buy_orders_reference on public.buy_orders(reference_id);

-- 6. 公告表
create table public.announcements (
  id text primary key,
  title text not null,
  content text not null,
  priority text default 'normal' check (priority in ('normal','important','urgent')),
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

-- 7. CDK 表
create table public.cdks (
  code text primary key,
  rewards jsonb not null default '{}'::jsonb,
  max_uses integer default 1,
  used_count integer default 0,
  expires_at bigint default 0::bigint,
  active boolean default true,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

-- 8. 通知表
create table public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('system','trade','friend','family','harvest','plant','purchase','cdk_redeem','task')),
  title text not null,
  content text not null,
  read boolean default false,
  created_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
create index idx_notifications_user on public.notifications(user_id, created_at desc);

-- 9. 游戏状态表（单例）
-- 注意 season_duration：游戏实际使用 8 小时一个季节
create table public.game_state (
  id integer primary key check (id = 1),
  current_season text default 'spring' check (current_season in ('spring','summer','autumn','winter')),
  season_start_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  season_duration bigint default 28800000::bigint   -- 8 小时 = 28,800,000 ms
);

-- 10. 偷花记录表
create table public.plot_steal_records (
  id text primary key,
  thief_id text not null references public.users(id) on delete cascade,
  victim_id text not null references public.users(id) on delete cascade,
  plot_id integer not null,
  stolen_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  reset_at bigint default 0::bigint
);
create index idx_steal_records_thief on public.plot_steal_records(thief_id, stolen_at desc);
create index idx_steal_records_victim on public.plot_steal_records(victim_id);

-- 11. 偷花日志表
create table public.steal_logs (
  id text primary key,
  thief_id text not null references public.users(id) on delete cascade,
  thief_name text,
  victim_id text not null references public.users(id) on delete cascade,
  victim_name text,
  plot_id integer,
  flower_type_id text,
  flower_name text,
  flower_emoji text,
  rank integer default 1,
  stolen_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);
create index idx_steal_logs_thief on public.steal_logs(thief_id, stolen_at desc);
create index idx_steal_logs_victim on public.steal_logs(victim_id);

-- 12. 官方收购价表
create table public.official_buy_prices (
  reference_id text not null,
  rank integer not null default 1,
  price bigint not null,
  updated_at bigint default (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  primary key (reference_id, rank)
);

-- ========= 第三步：初始数据 (显式 bigint cast) =========

-- 游戏状态：8 小时一个季节
insert into public.game_state (id, current_season, season_start_at, season_duration)
values (1, 'spring', (EXTRACT(EPOCH FROM now()) * 1000)::bigint, 28800000::bigint)
on conflict (id) do nothing;

-- 管理员（安全口令，仅首次部署时种子，部署后请立即修改）
insert into public.users (id, username, password, nickname, avatar, coins, is_admin, plots, inventory)
values (
  'adm_4ce9c3a14203', 'admin',
  '$2a$10$LjLnVn53hATKYWmnzP/rleBOrrUkxGUcaBMc7GDmg2wIVI6/UB1Lm',
  '超级管理员', '👑', 999999::bigint, true,
  '[{"id":1,"unlocked":true,"flower":null},{"id":2,"unlocked":true,"flower":null},{"id":3,"unlocked":true,"flower":null},{"id":4,"unlocked":true,"flower":null},{"id":5,"unlocked":true,"flower":null},{"id":6,"unlocked":true,"flower":null},{"id":7,"unlocked":true,"flower":null},{"id":8,"unlocked":true,"flower":null},{"id":9,"unlocked":true,"flower":null},{"id":10,"unlocked":true,"flower":null}]'::jsonb,
  '[]'::jsonb
) on conflict (id) do nothing;

-- 演示（仅首次部署时种子）
insert into public.users (id, username, password, nickname, avatar, coins, is_admin, plots, inventory)
values (
  'demo', 'demo',
  '$2a$10$c6r4PvEkrh3DW1ZcBVF6DufX6v6YGH2OJ0/FGcCtvZEV/WWQZWs9G',
  '演示玩家', '🌻', 500::bigint, false,
  '[{"id":1,"unlocked":true,"flower":null},{"id":2,"unlocked":true,"flower":null},{"id":3,"unlocked":true,"flower":null},{"id":4,"unlocked":false,"flower":null},{"id":5,"unlocked":false,"flower":null}]'::jsonb,
  '[{"id":"inv_s1","type":"seed","referenceId":"seed_daisy","name":"雏菊种子","emoji":"🌱","quantity":3,"maxStack":99,"sellable":false,"tradeable":true},{"id":"inv_s2","type":"seed","referenceId":"seed_tulip","name":"郁金香种子","emoji":"🌱","quantity":2,"maxStack":99,"sellable":false,"tradeable":true},{"id":"inv_t1","type":"tool","referenceId":"watering_can","name":"水壶","emoji":"💧","quantity":5,"maxStack":99,"sellable":true,"tradeable":true}]'::jsonb
) on conflict (id) do nothing;

insert into public.listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, rank, quantity, price) values
  ('seed_rose_1',      'system','系统商店',true,'seed','seed_rose',       '玫瑰种子',   '🌱',1,100,18::bigint),
  ('seed_tulip_1',     'system','系统商店',true,'seed','seed_tulip',      '郁金香种子', '🌱',1,100,15::bigint),
  ('seed_daisy_1',     'system','系统商店',true,'seed','seed_daisy',      '雏菊种子',   '🌱',1,100,8::bigint),
  ('seed_sunflower_1', 'system','系统商店',true,'seed','seed_sunflower',  '向日葵种子', '🌱',1,100,12::bigint),
  ('seed_plum_1',      'system','系统商店',true,'seed','seed_plum',       '梅花种子',   '🌱',1,100,30::bigint),
  ('tool_watering',    'system','系统商店',true,'tool','watering_can',    '水壶',       '💧',1,100,5::bigint),
  ('tool_fertilizer',  'system','系统商店',true,'tool','fertilizer',      '肥料',       '🧪',1,100,15::bigint),
  ('tool_pesticide',   'system','系统商店',true,'tool','pesticide',       '杀虫剂',     '🧴',1,100,10::bigint),
  ('tool_speedup',     'system','系统商店',true,'tool','speedup_card',    '加速卡',     '⚡',1,100,25::bigint)
on conflict (id) do nothing;

insert into public.official_buy_prices (reference_id, rank, price) values
  ('seed_daisy',         1, 12::bigint), ('seed_daisy',         2, 18::bigint), ('seed_daisy',         3, 25::bigint),
  ('seed_tulip',         1, 25::bigint), ('seed_tulip',         2, 38::bigint), ('seed_tulip',         3, 55::bigint),
  ('seed_rose',          1, 30::bigint), ('seed_rose',          2, 45::bigint), ('seed_rose',          3, 65::bigint),
  ('seed_sunflower',     1, 20::bigint), ('seed_sunflower',     2, 30::bigint), ('seed_sunflower',     3, 45::bigint),
  ('seed_chrysanthemum', 1, 28::bigint), ('seed_chrysanthemum', 2, 42::bigint), ('seed_chrysanthemum', 3, 60::bigint),
  ('seed_plum',          1, 60::bigint), ('seed_plum',          2, 90::bigint), ('seed_plum',          3, 130::bigint)
on conflict (reference_id, rank) do nothing;

-- ========= 第四步：关闭 RLS =========
alter table public.users                   disable row level security;
alter table public.families                disable row level security;
alter table public.messages                disable row level security;
alter table public.listings                disable row level security;
alter table public.buy_orders              disable row level security;
alter table public.announcements           disable row level security;
alter table public.cdks                    disable row level security;
alter table public.notifications           disable row level security;
alter table public.game_state              disable row level security;
alter table public.plot_steal_records      disable row level security;
alter table public.steal_logs              disable row level security;
alter table public.official_buy_prices     disable row level security;
