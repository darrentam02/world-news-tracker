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