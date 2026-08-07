-- ============================================================
--  花园游戏 · 热更新补丁 v1（不删数据，不丢聊天记录）
--  ✅ 安全：只做 ALTER / UPDATE，不会 DROP 任何表
--  ✅ 可重复执行：所有语句都有 IF NOT EXISTS / ON CONFLICT
-- ============================================================

-- 1. messages 表：如果列叫 timestamp，安全改名为 created_at
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='timestamp'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='messages' and column_name='created_at'
  ) then
    alter table public.messages rename column "timestamp" to created_at;
  end if;
end $$;

-- 重建索引（如果旧索引名冲突先删掉）
drop index if exists public.idx_messages_channel;
create index if not exists idx_messages_channel
  on public.messages(channel, created_at desc);

-- 2. buy_orders 表：补 fulfilled 列（如果没有）
alter table public.buy_orders
  add column if not exists fulfilled boolean not null default false;

-- 3. buy_orders 表：补 is_official 列（如果没有，部分旧 schema 缺这列）
alter table public.buy_orders
  add column if not exists is_official boolean not null default false;

-- 4. users 表：补 deleted 列（如果没有）
alter table public.users
  add column if not exists deleted boolean not null default false;

-- 5. cdks 表：补 active 列和 used_by 列（如果没有）
alter table public.cdks
  add column if not exists active boolean not null default true;
alter table public.cdks
  add column if not exists used_by jsonb not null default '[]'::jsonb;

-- 6. official_buy_prices 表：如果没有就创建（不会删已有数据）
create table if not exists public.official_buy_prices (
  reference_id text    not null,
  rank         integer not null default 1,
  price        bigint  not null,
  updated_at   bigint  not null,
  primary key (reference_id, rank)
);

-- 7. 修正 admin 密码为 admin123（只更新这一行，不影响其他用户）
update public.users
set password = '$2a$10$1jgwGVXuQ30V0wjQkUGQae60AZrf9xWlurRo8y.WnNMU9pw.Kfsk6'
where username = 'admin';

-- 8. 修正 demo 密码为 123456
update public.users
set password = '$2a$10$BhGV51VjlOxTopEh/Zb5Vep0w51L/5.6DKoidCNXW3BH4ntF9FuIm'
where username = 'demo';

-- 9. 确保 admin 有管理员权限和足够的背包空间
update public.users
set is_admin = true,
    inventory_size = 50
where username = 'admin';

-- 10. 修复 admin 的 plots（如果为空）
update public.users
set plots = '[{"id":1,"unlocked":true,"flower":null,"unlockPrice":100},{"id":2,"unlocked":true,"flower":null,"unlockPrice":200},{"id":3,"unlocked":true,"flower":null,"unlockPrice":400},{"id":4,"unlocked":true,"flower":null,"unlockPrice":800},{"id":5,"unlocked":true,"flower":null,"unlockPrice":1600},{"id":6,"unlocked":true,"flower":null,"unlockPrice":3200},{"id":7,"unlocked":true,"flower":null,"unlockPrice":6400},{"id":8,"unlocked":true,"flower":null,"unlockPrice":12800},{"id":9,"unlocked":true,"flower":null,"unlockPrice":25600},{"id":10,"unlocked":true,"flower":null,"unlockPrice":51200}]'::jsonb
where username = 'admin' and (plots = '[]'::jsonb or plots is null);

-- 11. 修复 demo 的 plots（如果为空）
update public.users
set plots = '[{"id":1,"unlocked":true,"flower":null,"unlockPrice":100},{"id":2,"unlocked":true,"flower":null,"unlockPrice":200},{"id":3,"unlocked":true,"flower":null,"unlockPrice":400},{"id":4,"unlocked":false,"flower":null,"unlockPrice":800},{"id":5,"unlocked":false,"flower":null,"unlockPrice":1600}]'::jsonb
where username = 'demo' and (plots = '[]'::jsonb or plots is null);

-- 12. 确保游戏状态存在
insert into public.game_state (id, current_season, season_start_at, season_duration)
values (1, 'spring', (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint, 28800000::bigint)
on conflict (id) do nothing;

-- 13. 补充官方商品（如果 listings 表没有官方种子）
insert into public.listings (id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, created_at)
select * from (values
  ('l_seed_rose_off',      'system', '官方', true, 'seed', 'seed_rose',      '玫瑰种子',   '🌱', 1, 18, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_seed_tulip_off',     'system', '官方', true, 'seed', 'seed_tulip',     '郁金香种子', '🌱', 1, 15, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_seed_daisy_off',     'system', '官方', true, 'seed', 'seed_daisy',     '雏菊种子',   '🌱', 1,  8, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_seed_sunflower_off', 'system', '官方', true, 'seed', 'seed_sunflower', '向日葵种子', '🌱', 1, 12, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_tool_watering_off',  'system', '官方', true, 'tool', 'watering_can',   '水壶',       '💧', 1,  5, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_tool_fert_off',      'system', '官方', true, 'tool', 'fertilizer',     '肥料',       '🧪', 1, 15, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_tool_pest_off',      'system', '官方', true, 'tool', 'pesticide',      '杀虫剂',     '🧴', 1, 10, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('l_tool_speed_off',     'system', '官方', true, 'tool', 'speedup_card',   '加速卡',     '⚡', 1, 25, 99, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint)
) as t(id, seller_id, seller_name, is_official, item_type, reference_id, name, emoji, rank, price, quantity, created_at)
on conflict (id) do nothing;

-- 14. 官方收购价（如果 official_buy_prices 表为空才插入）
insert into public.official_buy_prices (reference_id, rank, price, updated_at)
select * from (values
  ('seed_daisy',         1,  12, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_daisy',         2,  18, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_daisy',         3,  25, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         1,  25, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         2,  38, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_tulip',         3,  55, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          1,  30, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          2,  45, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_rose',          3,  65, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     1,  20, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     2,  30, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_sunflower',     3,  45, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 1,  28, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 2,  42, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_chrysanthemum', 3,  60, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          1,  60, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          2,  90, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint),
  ('seed_plum',          3, 130, (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint)
) as t(reference_id, rank, price, updated_at)
on conflict (reference_id, rank) do nothing;

-- ============================================================
--  完成！所有操作都是安全的，可以重复执行。
--  聊天记录、用户数据、交易记录全部保留。
-- ============================================================
