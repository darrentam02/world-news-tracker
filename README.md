# World News Tracker

每小時全球 + 香港 + 巿場新聞 app。Phase 1 done —— M1–M7 all ✅。

詳細 spec + decisions：見 `spec.md` / `decisions.md`(source of truth)。

## Run (local)

```bash
pnpm install
cp .env.example .env   # 填 SUPABASE_URL / SERVICE_ROLE_KEY 等
pnpm dev               # vite :5173 + api :5000
pnpm quotes            # Yahoo 13 指數入 quotes 表（每小時 fetch-hourly 會自動做）
pnpm digest-a          # 08:30 開巿簡報（無 RESEND_API_KEY = dry-run）
pnpm digest-b          # 16:30 收巿簡報
pnpm cleanup-pending   # 刪 50 日未確認嘅 pending 訂閱（每日 job）
```

## Deploy（Replit）

`replit.toml`（repo root）已設：build=`pnpm build`、run=`pnpm start`（tsx server，port 5000，serve 埋 `app/dist` 前端）。

1. replit.com → **Create new Repl → Import from GitHub** → `darrentam02/world-news-tracker`
2. **Deployments tab → Secrets** 填：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`RESEND_FROM`、`DIGEST_SECRET`、`PUBLIC_BASE_URL=https://<你個名>.replit.app`
3. **Publish**（Autoscale 免費）→ 揀 `.replit.app` 個 subdomain
4. **Jobs tab** 建 4 個 cron（UTC）：`fetch-hourly` `0 * * * *`、`digest-a` `30 0 * * *`（08:30 HKT）、`digest-b` `30 8 * * *`（16:30 HKT）、`cleanup-pending` `0 1 * * *`

> Secrets 唔會自動由 `.env` 帶過去；改咗 secret 要重新 Publish 先生效。

## 目錄

```
supabase/migrations/   # events / articles / subscribers / quotes / audit_log
app/                   # Replit workspace（Vite frontend + Express API）
shared/                # feeds / dedup / market / types 共用
config/                # blacklist / feeds（M2 起）
scripts/               # fetch-hourly / cluster / fetch-quotes / send-digest / cleanup-pending
```

## Milestones

- [x] M1 scaffold + migrations + /api/healthz
- [x] M2 feeds + fetch-hourly
- [x] M3 dedup cluster
- [x] M4 news API + frontend
- [x] M5 market quote
- [x] M6 subscribe/digest
- [x] M7 privacy / blacklist / audit（黑名單更新即生效，下架逐次入 audit_log）

## 私隱

`subscribers.email` 係唯一 personal data —— 只入 Supabase、唔入 Git。RLS 已 enable（only service_role 可讀寫）。