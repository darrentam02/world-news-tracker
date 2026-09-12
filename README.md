# World News Tracker

每小時全球 + 香港 + 巿場新聞 app。Phase 1 中 —— M1 done。

詳細 spec + decisions：見 `spec.md` / `decisions.md`(source of truth)。

## Run (local)

```bash
pnpm install
cp .env.example .env   # 填 SUPABASE_URL / SERVICE_ROLE_KEY 等
pnpm dev               # vite :5173 + api :5000
```

## 目錄

```
supabase/migrations/   # events / articles / subscribers / audit_log
app/                   # Replit workspace（Vite frontend + Express API）
shared/                # feeds / dedup / market / types 共用
config/                # blacklist / feeds / market（M2 起）
scripts/               # fetch-hourly / send-digest（M2 起）
```

## Milestones

- [x] M1 scaffold + migrations + /api/healthz
- [ ] M2 feeds + fetch-hourly
- [ ] M3 dedup cluster
- [ ] M4 news API + frontend
- [ ] M5 market quote
- [ ] M6 subscribe/digest
- [ ] M7 privacy / blacklist / audit

## 私隱

`subscribers.email` 係唯一 personal data —— 只入 Supabase、唔入 Git。RLS 已 enable（only service_role 可讀寫）。