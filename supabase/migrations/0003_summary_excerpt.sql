-- World News Tracker — 0003_summary_excerpt.sql
-- 優先事項:1) RSS 內文做事件摘要(暫代 LLM 繁中,spec §4) 2) 連續 24h 0 稿 → 標「可能故障」(spec §10)
-- 用途:
--   articles.description  ：RSS <description> 攞出嚟嘅 excerpt(標題之外嘅一段),cluster 時做 event.summary
--   feed_status           ：每源最後一次成功/新稿時間 + flagged,畀 dashboard 顯示「可能故障」

alter table public.articles
  add column if not exists description text;              -- RSS excerpt(唔係正文,短摘錄)

create table if not exists public.feed_status (
  feed_id            text primary key,
  last_attempt_at    timestamptz not null default now(), -- 上次跑(成功行到 script)
  last_ok_at         timestamptz,                        -- 上次成功 fetch
  last_new_at        timestamptz,                        -- 上次有「新」文章入庫
  last_new_count     int not null default 0,             -- 上次入庫數量
  flagged            boolean not null default false,     -- 連續 24h 0 稿 → 可能故障
  updated_at         timestamptz not null default now()
);

alter table public.feed_status enable row level security;