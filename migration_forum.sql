-- ============================================================
-- P0-3 论坛 MVP：单板块「花园闲谈」
-- 四张表：posts 帖子 / post_comments 评论 / post_likes 点赞 / post_reports 举报
-- RLS 已全局禁用，服务端 service_role 直连
-- 执行方式：在 Supabase SQL Editor 手动执行
-- ============================================================

-- 帖子
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id);

-- 评论（帖子的回复，一级即可，不做楼层嵌套）
CREATE TABLE IF NOT EXISTS post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at ASC);

-- 点赞（用户-帖子 唯一，防重复点赞）
CREATE TABLE IF NOT EXISTS post_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique ON post_likes (post_id, user_id);

-- 举报（帖子或评论）
CREATE TABLE IF NOT EXISTS post_reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,              -- 'post' | 'comment'
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'   -- pending | handled | dismissed
);

CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports (status, created_at ASC);