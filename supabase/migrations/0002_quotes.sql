-- World News Tracker — 0002_quotes.sql
-- M5：Yahoo Finance 每小時 quote 快照（append-only，保留歷史）
-- 私隱（PCPD）：指數價格非個人資料；service_role 先可讀寫，RLS + 無 anon policy。

create table if not exists public.quotes (
  id          bigint generated always as identity primary key,
  symbol      text not null,                 -- ^DJI / ^GSPC / 000001.SS ...
  price       numeric not null,              -- 指數點數
  change      numeric not null,              -- 對比前收巿
  change_pct  numeric not null,              -- 百分比（email 淨出呢個；點數淨網站）
  quote_time  timestamptz,                   -- Yahoo regularMarketTime（可空=巿場未開/停市）
  fetched_at  timestamptz not null default now()
);

create index if not exists quotes_symbol_fetched_idx on public.quotes (symbol, fetched_at desc);

alter table public.quotes enable row level security;