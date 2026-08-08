-- ============================================================
--  花园游戏 · Supabase 最终合并版 v1.4
--  ============================================================
--  ⚠️  重 要  提  醒  ⚠️
--
--  1) 不要点绿色的 "Run selected"！！
--     请用鼠标滚到这一行最顶上，按 Ctrl+A 全选，
--     然后点右上角 "Run" 按钮（Ctrl+回车），一次性执行全部！
--
--  2) 本脚本开头会先 DROP 所有旧表再重建，确保没有残留结构。
--     如果你只跑下面的 INSERT，就会出现 "integer out of range"，
--     因为老表的列还是 integer 类型！
--
--  3) 这个版本合并了：
--       · 用户自己的第一份建表脚本（deleted、user_tasks、used_by 等）
--       · 代码实际读取的列名（messages.created_at 不用 timestamp 保留字）
--       · official_buy_prices（官方收购价，代码用了但你之前没建）
--       · 所有 bigint 强转，彻底避免 22003 integer out of range
--  ============================================================

-- ============ 第 0 步：删除所有旧表（cascade 删索引/约束）============
drop table if exists public.official_buy_prices cascade;
drop table if exists public.steal_logs         cascade;
drop table if exists public.plot_steal_records cascade;
drop table if exists public.notifications      cascade;
drop table if exists public.cdks               cascade;
drop table if exists public.announcements      cascade;
drop table if exists public.buy_orders         cascade;
drop table if exists public.listings           cascade;
drop table if exists public.messages           cascade;
drop table if exists public.user_tasks         cascade;
drop table if exists public.families           cascade;
drop table if exists public.game_state         cascade;
drop table if exists public.users              cascade;

-- ============ 帮助函数：拿到当前毫秒时间戳，避免到处写 EXTRACT ============
-- （不用 create function 避免权限问题，下面 INSERT 直接内联表达式）

-- ============ 第 1 步：建表（所有时间/金额列全部 bigint）============

-- 1. 用户表（保留你原本的 deleted 字段）
create table public.users (
  id                       text primary key,
  username                 text unique not null,
  password                 text not null,
  nickname                 text not null,
  avatar                   text not null default '🌱',
  coins                    bigint not null default 100,
  created_at               bigint not null,
  last_login               bigint not null,
  plots                    jsonb not null default '[]'::jsonb,
  inventory                jsonb not null default '[]'::jsonb,
  inventory_size           integer not null default 30, -- 你原来默认 5 太小，和代码一致改为 30
  is_admin                 boolean not null default false,
  muted_until              bigint,
  family_id                text,
  friends                  jsonb not null default '[]'::jsonb,
  deleted                  boolean not null default false,  -- 来自你的原始表
  steal_count_today        integer not null default 0,
  steal_reset_at           bigint not null default 0,
  garden_protected_until   bigint not null default 0
);

-- 2. 家族表
create table public.families (
  id           text primary key,
  name         text unique not null,
  avatar       text not null default '🏰',
  announcement text not null default '',
  owner_id     text not null,
  members      jsonb not null default '[]'::jsonb,
  level        integer not null default 1,
  exp          integer not null default 0,
  max_members  integer not null default 20,  -- 原来 10，和代码一致改为 20
  created_at   bigint not null
);

-- 3. 聊天消息表
-- ⚠️  注意：你原来用 timestamp 作列名，但这是 PostgreSQL 保留字，
--    查询会报 42703 column "timestamp" does not exist，所以统一用 created_at。
--    代码 dbRowToMessage 里也是 row.created_at → message.timestamp（TS 属性）。
create table public.messages (
  id         text primary key,
  channel    text not null,
  user_id    text not null,
  user_name  text not null,
  content    text not null,
  created_at bigint not null,           -- 原本叫 timestamp，改名为 created_at
  is_system  boolean not null default false
);
create index if not exists idx_messages_channel
  on public.messages(channel, created_at desc);

-- 4. 市场挂售表
create table public.listings (
  id           text primary key,
  seller_id    text not null,
  seller_name  text not null,
  is_official  boolean not null default false,
  item_type    text not null,
  reference_id text not null,
  name         text not null,
  emoji        text not null,
  rank         integer,
  price        bigint not null,         -- 金额一律 bigint，避免溢出
  quantity     integer not null,
  created_at   bigint not null
);

-- 5. 市场收购订单表（保留你原本的 is_official）
create table public.buy_orders (
  id           text primary key,
  buyer_id     text not null,
  buyer_name   text not null,
  is_official  boolean not null default false,  -- 来自你的原始表
  item_type    text not null,
  reference_id text not null,
  name         text not null,
  emoji        text not null,
  rank         integer,
  price        bigint not null,         -- 金额一律 bigint
  quantity     integer not null,
  fulfilled    boolean not null default false, -- 代码需要（是否已被卖方交付）
  created_at   bigint not null
);

-- 6. 用户任务表（来自你的原始表，代码暂未读写，保留备用）
create table public.user_tasks (
  user_id text primary key,
  tasks   jsonb not null default '[]'::jsonb
);

-- 7. CDK 表（保留你原本的 used_by；代码的 createCDK 已在写这个列）
create table public.cdks (
  code       text primary key,
  rewards    jsonb not null default '{}'::jsonb,
  max_uses   integer not null default 1,
  used_count integer not null default 0,
  expires_at bigint,
  created_at bigint not null,
  used_by    jsonb not null default '[]'::jsonb,  -- 来自你的原始表
  active     boolean not null default true        -- 代码查询时有判断
);

-- 8. 通知表
create table public.notifications (
  id         text primary key,
  user_id    text not null,
  type       text not null,
  title      text not null,
  content    text not null,
  read       boolean not null default false,
  created_at bigint not null
);
create index if not exists idx_notifications_user
  on public.notifications(user_id, created_at desc);

-- 9. 游戏状态表（单例）· 季节时长 = 8h = 28,800,000ms（和 game-data.ts 一致）
create table public.game_state (
  id              integer primary key default 1,
  current_season  text not null default 'spring',
  season_start_at bigint not null,
  season_duration bigint not null default 28800000,
  constraint game_state_single_row check (id = 1)
);

-- 10. 公告表
create table public.announcements (
  id         text primary key,
  title      text not null,
  content    text not null,
  priority   text not null default 'normal',
  created_at bigint not null
);

-- 11. 偷花日志表（完全对应代码列名）
create table public.steal_logs (
  id            text primary key,
  thief_id      text not null,
  thief_name    text not null,
  victim_id     text not null,
  victim_name   text not null,
  plot_id       integer not null,
  flower_type_id text not null,
  flower_name   text not null,
  flower_emoji  text not null,
  rank          integer not null,
  stolen_at     bigint not null
);
create index if not exists idx_steal_logs_victim on public.steal_logs(victim_id, stolen_at desc);
create index if not exists idx_steal_logs_thief  on public.steal_logs(thief_id,  stolen_at desc);

-- 12. 偷花记录表（防止重复偷同一地块）
create table public.plot_steal_records (
  id        text primary key,
  victim_id text not null,
  plot_id   integer not null,
  thief_id  text not null,
  stolen_at bigint not null,
  reset_at  bigint not null
);

-- 13. 官方收购价表（你原本缺这张！代码 admin 面板和官方挂售在用）
create table public.official_buy_prices (
  reference_id text    not null,
  rank         integer not null default 1,
  price        bigint  not null,
  updated_at   bigint  not null,
  primary key (reference_id, rank)
);

-- ============ 第 2 步：关闭 RLS（后端用 service_role key 直连，不需要 RLS）============
-- 你原始脚本最后是 ENABLE RLS，那会让所有 SELECT 报 0 rows，
-- 因为没有对应的 policy，所以这里统一 DISABLE。
alter table public.users                   disable row level security;
alter table public.families                disable row level security;
alter table public.messages                disable row level security;
alter table public.listings                disable row level security;
alter table public.buy_orders              disable row level security;
alter table public.user_tasks              disable row level security;
alter table public.cdks                    disable row level security;
alter table public.notifications           disable row level security;
alter table public.game_state              disable row level security;
alter table public.announcements           disable row level security;
alter table public.steal_logs              disable row level security;
alter table public.plot_steal_records      disable row level security;
alter table public.official_buy_prices     disable row level security;

-- ============ 第 3 步：初始数据（所有时间戳都显式 ::bigint，彻底防 22003）============
--    所有 (EXTRACT(EPOCH FROM now()) * 1000) 都先把 EXTRACT 转成 numeric 再乘，再转 bigint

-- 当前毫秒时间戳的通用写法
--   = (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint

insert into public.game_state (id, current_season, season_start_at, season_duration)
values (
  1,
  'spring',
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint,
  28800000::bigint
)
on conflict (id) do nothing;

-- 管理员：admin / admin123 （bcrypt hash）
insert into public.users (
  id, username, password, nickname, avatar, coins,
  created_at, last_login, plots, inventory, inventory_size,
  is_admin, muted_until, family_id, friends, deleted,
  steal_count_today, steal_reset_at, garden_protected_until
) values (
  'admin', 'admin',
  '$2a$10$1jgwGVXuQ30V0wjQkUGQae60AZrf9xWlurRo8y.WnNMU9pw.Kfsk6',
  '花园管理员', '👑', 99999::bigint,
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 86400000::bigint,  -- 1 天前创建
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint,                      -- 刚刚登录
  '[]'::jsonb, '[]'::jsonb, 50,
  true, null, null, '[]'::jsonb, false,
  0, 0, 0
) on conflict (id) do nothing;

-- 普通玩家：demo / 123456 （bcrypt hash）
insert into public.users (
  id, username, password, nickname, avatar, coins,
  created_at, last_login, plots, inventory, inventory_size,
  is_admin, muted_until, family_id, friends, deleted,
  steal_count_today, steal_reset_at, garden_protected_until
) values (
  'demo', 'demo',
  '$2a$10$BhGV51VjlOxTopEh/Zb5Vep0w51L/5.6DKoidCNXW3BH4ntF9FuIm',
  '小花农', '🌱', 200::bigint,
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 3600000::bigint,   -- 1 小时前创建
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint,
  '[]'::jsonb, '[]'::jsonb, 10,
  false, null, null, '[]'::jsonb, false,
  0, 0, 0
) on conflict (id) do nothing;

-- 欢迎系统消息
insert into public.messages (id, channel, user_id, user_name, content, created_at, is_system)
values (
  'msg_1', 'world', 'system', '系统',
  '欢迎来到花园！祝大家游戏愉快~ 🌸🌺🌻🌷🌹',
  (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 60000::bigint,
  true
) on conflict (id) do nothing;

-- 官方种子挂售（4 款 + 工具 4 款）
insert into public.listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, price, quantity, created_at) values
  ('l_seed_rose',      'system', '官方', true, 'seed', 'seed_rose',      '玫瑰种子',   '🌱', 18::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 100000::bigint),
  ('l_seed_tulip',     'system', '官方', true, 'seed', 'seed_tulip',     '郁金香种子', '🌱', 15::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  90000::bigint),
  ('l_seed_daisy',     'system', '官方', true, 'seed', 'seed_daisy',     '雏菊种子',   '🌱',  8::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  80000::bigint),
  ('l_seed_sunflower', 'system', '官方', true, 'seed', 'seed_sunflower', '向日葵种子', '🌱', 12::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  85000::bigint),
  ('l_tool_watering',  'system', '官方', true, 'tool', 'watering_can',   '水壶',       '💧',  5::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  75000::bigint),
  ('l_tool_fert',      'system', '官方', true, 'tool', 'fertilizer',     '肥料',       '🧪', 15::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  70000::bigint),
  ('l_tool_pest',      'system', '官方', true, 'tool', 'pesticide',      '杀虫剂',     '🧴', 10::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  65000::bigint),
  ('l_tool_speed',     'system', '官方', true, 'tool', 'speedup_card',   '加速卡',     '⚡', 25::bigint, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint -  60000::bigint)
on conflict (id) do nothing;

-- 官方高品质花展示（3 级向日葵 🌻）
insert into public.listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, created_at) values
  ('l_flower_sun3', 'system', '官方', true, 'flower', 'sunflower', '向日葵', '🌻', 3, 45::bigint, 5,
   (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 70000::bigint)
on conflict (id) do nothing;

-- 官方收购单（从你的原始脚本保留的 o1 / o2，加上 is_official=true）
insert into public.buy_orders (id, buyer_id, buyer_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, fulfilled, created_at) values
  ('o1', 'system', '官方', true, 'flower', 'rose',  '玫瑰', '🌹', 1, 30::bigint, 50,  false,
   (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 50000::bigint),
  ('o2', 'system', '官方', true, 'flower', 'daisy', '雏菊', '🌼', 1, 12::bigint, 100, false,
   (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 40000::bigint)
on conflict (id) do nothing;

-- 公告
insert into public.announcements (id, title, content, priority, created_at) values
  ('ann_1', '🎉 欢迎来到花园！',
   '欢迎来到花园模拟经营游戏！在这里你可以种花、交易、交友。完成签到和任务获取金币与花瓣奖励，解锁称号和外观，快去你的花园看看吧！',
   'urgent',
   (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),

  ('ann_2', '📖 游戏玩法介绍',
   E'1. 在花园中种植花朵，浇水、施肥、除虫、使用加速卡加速成长，注意虫灾哦。\n2. 收获的花朵可卖给系统，或在市场自由定价挂售/收购（支持花朵、种子、工具）。\n3. 解锁更多地块和背包格，使用工坊制作花束与培育珍稀品种。\n4. 完成每日/每周/每月任务和每日签到，获取金币与花瓣奖励。\n5. 加入家族：贡献金币、完成家族集体任务、升级家族、解锁更多成员名额。\n6. 小游戏：消耗花瓣玩幸运转盘和猜大小，赢取丰厚金币。\n7. 成就系统：连续签到、收获花朵、消费金币，解锁专属称号。\n8. 外观设置：切换界面主题与花园背景皮肤，打造专属花园。',
   'important',
   (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint - 3600000::bigint)
on conflict (id) do nothing;

-- 官方收购价（13 号表）· 所有 price 显式 ::bigint
insert into public.official_buy_prices (reference_id, rank, price, updated_at) values
  ('seed_daisy',         1,  12::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_daisy',         2,  18::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_daisy',         3,  25::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         1,  25::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         2,  38::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         3,  55::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          1,  30::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          2,  45::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          3,  65::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     1,  20::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     2,  30::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     3,  45::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 1,  28::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 2,  42::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 3,  60::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          1,  60::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          2,  90::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          3, 130::bigint, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint)
on conflict (reference_id, rank) do nothing;

-- ============================================================
--  脚本结束。跑完之后应该看到 Success（没有红色报错）。
--  如果还报错：请把 Result 里的 Error 文本整个贴过来。
-- ============================================================
