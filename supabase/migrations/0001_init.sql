-- World News Tracker — 0001_init.sql
-- M1：events / articles / subscribers / audit_log + indexes + RLS
-- 私隱（PCPD）：subscribers.email 係唯一 personal data；service_role 先可讀寫。
-- 前端永遠唔直接 touch DB（經 Express API），所以 RLS enable + 唔加 anon policy 就係安全 default。

create extension if not exists pgcrypto;

-- events ---------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  summary       text,                                     -- 繁中摘要，null = degraded
  status        text not null default 'open'
                check (status in ('open','stale','resolved')),
  region        text not null default 'world'
                check (region in ('world','hk','markets')),
  cluster_hash  text not null,                            -- trigram Jaccard cluster key
  pinned        boolean not null default false,           -- admin 手動 pin top
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),       -- 48h→stale、7日→resolved 依賴佢
  source_url    text                                      -- 最新來源原文
);

create index if not exists events_cluster_hash_idx on public.events (cluster_hash);
create index if not exists events_last_seen_idx    on public.events (last_seen_at);
create index if not exists events_region_idx       on public.events (region);

-- articles --------------------------------------------------------------
create table if not exists public.articles (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid references public.events (id) on delete cascade,
  source     text not null,
  title      text not null,
  url        text not null,
  fetched_at timestamptz not null default now(),         -- provenance 一部份
  raw_hash   text not null                               -- provenance：未經處理 RAW hash
);

create index if not exists articles_event_id_idx on public.articles (event_id);
create index if not exists articles_raw_hash_idx on public.articles (raw_hash);

-- subscribers -------------------------------------------------------------
-- 私隱：只有 email + 兩個 token；冇姓名/冇電話/冇 cookie。
create table if not exists public.subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  token             text not null unique,                -- confirm token（單次使用）
  unsubscribe_token text not null unique,                -- 一鍵取消 link
  confirmed_at      timestamptz,                         -- double opt-in 完成時間
  status            text not null default 'pending'
                    check (status in ('pending','active','unsubscribed')),
  created_at        timestamptz not null default now()   -- 50 日未確認 → cleanup 刪
);

-- audit_log ----------------------------------------------------------------
-- provenance：任何 blacklist 生效 / pin / takedown / status 改動都記低，逐次可審計。
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null default 'system',
  action      text not null check (action in ('blacklist','pin','takedown','status_change')),
  target_type text not null,                              -- 'event' | 'article' | 'subscriber'
  target_id   text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at);

-- RLS：service_role bypass；anon 一無所有 -----------------------------------
alter table public.events      enable row level security;
alter table public.articles    enable row level security;
alter table public.subscribers enable row level security;
alter table public.audit_log   enable row level security;