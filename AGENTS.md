# World News Tracker — AGENTS.md

> 你係 senior full-stack engineer，負責實作一個每小時更新嘅全球+香港新聞追蹤 web app。
> **Source of truth：`spec.md` + `decisions.md`（已確認，直接喺度做）。** 實作偏離 → 停低問，唔好靜靜改。

## 每次 session 開始
1. 讀 `spec.md` + `decisions.md`。
2. 檢查 `.env`:有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`RESEND_API_KEY`、`LLM_API_KEY`(GitHub Models 或 DeepSeek)。
3. 起返 local dev(`pnpm install && pnpm dev`)先確認都係行得。

## 已確認嘅硬性參數(咪自己改)
- **Stack**:Replit(Vite+React frontend / Express API)+ Supabase(pgvector-free tier)。
- **排程**:Replit scheduled job——`fetch-hourly`(每小時)、`digest-a`(08:30 HKT)、`digest-b`(16:30 HKT)；後備 GitHub Actions cron。
- **數據**:RSS 全球 6 核心 + 香港 4 + 財經 5;Yahoo Finance 13 指數(`^DJI ^GSPC ^IXIC ^FTSE ^GDAXI ^FCHI ^HSI 000001.SS 000300.SS ^TWII ^N225 ^KS11 ^AXJO`)。
- **追蹤**:trigram Jaccard cluster;48h→stale;7 日→resolved;admin 可 pin 3。
- **Email**:每日 2 封(08:30 / 16:30),HTML+plain 後備,e有 unsubscribe,double opt-in confirm 24h,pending>50 日刪。
- **語言**:UI、摘要一律**繁體中文**;標題照原文。
- **巿場卡**:13 指數全列分 4 組;email 只出 ±%,點數淨網站。

## 唔准改嘅規則
- **未經批准唔准加付費服務**;所有外部 fetch 一定要 timeout+retry+降級。
- **新聞正文永遠唔可以存落 DB、唔可以複製發佈**。摘要只可用 RSS 內文;唔夠料先瞬時開原文做 LLM 輸入。
- **subscriber email 唔准入 Git**;secrets 只喺 Replit secrets / .env。
- privacy policy、blacklist(config/blacklist.ts)、provenance log 喺 Phase 1 尾段齊先算完成。

## 實作流程(每次一步,可驗證)
```
每個 milestone → 寫 code → pnpm build + typecheck 過 → 先下一步
完成每個 milestone → 5 行總結(做咗乜 / 點驗證 / 下一步)
```

## Milestones 順序
| # | Milestone | 驗證 |
|---|---|---|
| M1 | Repo scaffold(Vite+TS+Express+pnpm)+ Supabase migrations(events/articles/subscribers)+ `GET /api/healthz` | `pnpm build` + healthz 200 |
| M2 | `shared/feeds.ts` + `config/feeds.ts` + `scripts/fetch-hourly.ts`(RSS fetch→events/articles,+ blacklist 先行過濾) | 乾跑一輪,DB 有數 |
| M3 | `shared/dedup.ts`(trigram Jaccard)+ cluster 合併 + status(48h/7d) | 兩篇同事件文合併成一卡 |
| M4 | `api/news` + `api/events/:id` timeline + frontend 列表/timeline/巿場卡(±%+點數) | 瀏覽器出到圖 |
| M5 | `shared/market.ts`(Yahoo 13 指數)+ 巿場卡併入 digest | quote 入到 DB |
| M6 | subscribe/confirm(24h)/unsubscribe + Resend(a+b digest,HTML+plain) + 50 日 cleanup job | 收到真 email、unsubscribe 即停 |
| M7 | Privacy Policy 頁 + blacklist 生效+審計(provenance log) | 實測下架一則 |

## 完成定義
M1–M7 全部 build+typecheck 過、digest 真係收到、MV 樣基本功能可手動驗證。完成後 5 行總結交返俾用戶。