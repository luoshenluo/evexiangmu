-- 热更新补丁v1 不删数据 可重复执行
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='timestamp')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='created_at') then
    alter table public.messages rename column "timestamp" to created_at;
  end if;
end $$;

drop index if exists public.idx_messages_channel;
create index if not exists idx_messages_channel on public.messages(channel, created_at desc);

alter table public.buy_orders add column if not exists fulfilled boolean not null default false;
alter table public.buy_orders add column if not exists is_official boolean not null default false;
alter table public.users add column if not exists deleted boolean not null default false;

alter table public.cdks add column if not exists active boolean not null default true;
alter table public.cdks add column if not exists used_by jsonb not null default '[]'::jsonb;

create table if not exists public.official_buy_prices (
  reference_id text not null,
  rank integer not null default 1,
  price bigint not null,
  updated_at bigint not null,
  primary key (reference_id, rank)
);

update public.users set password = '$2a$10$1jgwGVXuQ30V0wjQkUGQae60AZrf9xWlurRo8y.WnNMU9pw.Kfsk6' where username = 'admin';
update public.users set password = '$2a$10$BhGV51VjlOxTopEh/Zb5Vep0w51L/5.6DKoidCNXW3BH4ntF9FuIm' where username = 'demo';
update public.users set is_admin = true, inventory_size = 50 where username = 'admin';

update public.users
set plots = '[{"id":1,"unlocked":true,"flower":null,"unlockPrice":100},{"id":2,"unlocked":true,"flower":null,"unlockPrice":200},{"id":3,"unlocked":true,"flower":null,"unlockPrice":400},{"id":4,"unlocked":true,"flower":null,"unlockPrice":800},{"id":5,"unlocked":true,"flower":null,"unlockPrice":1600},{"id":6,"unlocked":true,"flower":null,"unlockPrice":3200},{"id":7,"unlocked":true,"flower":null,"unlockPrice":6400},{"id":8,"unlocked":true,"flower":null,"unlockPrice":12800},{"id":9,"unlocked":true,"flower":null,"unlockPrice":25600},{"id":10,"unlocked":true,"flower":null,"unlockPrice":51200}]'::jsonb
where username = 'admin' and (plots = '[]'::jsonb or plots is null);

update public.users
set plots = '[{"id":1,"unlocked":true,"flower":null,"unlockPrice":100},{"id":2,"unlocked":true,"flower":null,"unlockPrice":200},{"id":3,"unlocked":true,"flower":null,"unlockPrice":400},{"id":4,"unlocked":false,"flower":null,"unlockPrice":800},{"id":5,"unlocked":false,"flower":null,"unlockPrice":1600}]'::jsonb
where username = 'demo' and (plots = '[]'::jsonb or plots is null);

insert into public.game_state (id, current_season, season_start_at, season_duration)
values (1, 'spring', (EXTRACT(EPOCH FROM now())::numeric * 1000)::bigint, 28800000::bigint)
on conflict (id) do nothing;

insert into public.official_buy_prices (reference_id, rank, price, updated_at)
select * from (values
  ('seed_daisy',1,12,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_daisy',2,18,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_daisy',3,25,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_tulip',1,25,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_tulip',2,38,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_tulip',3,55,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_rose',1,30,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_rose',2,45,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_rose',3,65,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_sunflower',1,20,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_sunflower',2,30,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_sunflower',3,45,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_plum',1,60,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_plum',2,90,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint),
  ('seed_plum',3,130,(EXTRACT(EPOCH FROM now())::numeric*1000)::bigint)
) as t(reference_id,rank,price,updated_at)
on conflict (reference_id, rank) do nothing;
