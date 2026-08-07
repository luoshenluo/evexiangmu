-- ============================================================
--  花园游戏 · 热更新补丁 v2（不删数据，不丢聊天记录）
--  内容：聊天管理面板 + 敏感词库后台化 + 消息频率限制
--  ✅ 安全：只 CREATE TABLE IF NOT EXISTS / ALTER ADD COLUMN
--  ✅ 可重复执行：所有语句都有 IF NOT EXISTS / ON CONFLICT
--  ✅ 保留所有现有数据（用户、聊天记录、交易、CDK 等）
-- ============================================================

-- ============================================================
-- 1. 敏感词库表（后台可增删）
-- ============================================================
create table if not exists public.sensitive_words (
  id          text primary key,
  word        text not null unique,
  created_at  bigint not null,
  created_by  text
);

create index if not exists idx_sensitive_words_word
  on public.sensitive_words(word);

-- 首次初始化默认敏感词（只在表为空时插入）
insert into public.sensitive_words (id, word, created_at, created_by)
select * from (values
  ('sw_01', '操',     (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_02', '傻逼',   (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_03', 'sb',     (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_04', '去死',   (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_05', '他妈',   (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_06', 'tmd',    (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_07', '垃圾游戏', (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_08', '骗钱',   (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_09', '外挂',   (extract(epoch from now())::numeric * 1000)::bigint, 'system'),
  ('sw_10', 'hack',   (extract(epoch from now())::numeric * 1000)::bigint, 'system')
) as t(id, word, created_at, created_by)
where not exists (select 1 from public.sensitive_words limit 1)
on conflict (id) do nothing;

-- ============================================================
-- 2. 聊天设置表（单行配置：频率限制、长度等）
-- ============================================================
create table if not exists public.chat_settings (
  id                      integer primary key default 1,
  max_messages_per_minute integer not null default 5,
  max_message_length      integer not null default 200,
  min_message_interval_ms bigint  not null default 2000,
  enabled                 boolean not null default true,
  updated_at              bigint  not null,
  constraint chat_settings_single_row check (id = 1)
);

-- 默认配置（仅在不存在时插入）
insert into public.chat_settings (id, max_messages_per_minute, max_message_length, min_message_interval_ms, enabled, updated_at)
values (1, 5, 200, 2000, true, (extract(epoch from now())::numeric * 1000)::bigint)
on conflict (id) do nothing;

-- ============================================================
-- 3. messages 表索引（确保 created_at 索引存在，加快后台查询/删除）
-- ============================================================
create index if not exists idx_messages_created_at
  on public.messages(created_at desc);

create index if not exists idx_messages_user_id
  on public.messages(user_id, created_at desc);

-- ============================================================
-- 4. RLS 策略（服务端使用 service_role key 绕过）
-- ============================================================
alter table public.sensitive_words enable row level security;
alter table public.chat_settings enable row level security;

-- ============================================================
-- 5. 花园点赞表（社交增强）
-- ============================================================
create table if not exists public.garden_likes (
  id          text primary key,
  liker_id    text not null,
  target_id   text not null,
  created_at  bigint not null,
  unique (liker_id, target_id)  -- 每个用户对同一花园只能点赞一次（取消后可重新点）
);

create index if not exists idx_garden_likes_target
  on public.garden_likes(target_id);

alter table public.garden_likes enable row level security;

-- ============================================================
-- 完成！所有操作都是安全的，可以重复执行。
-- 聊天记录、用户数据、交易记录全部保留。
-- ============================================================
