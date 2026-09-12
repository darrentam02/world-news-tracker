# 每小時全球 + 香港新聞追蹤 — spec.md

> 狀態：Phase 0 確認版 v3（2026-09-12）—— 已鎖死，準備 Phase 1
> 讀法：所有實作如有偏離，先停低問，唔好靜靜改方向。

## 1. 角色同目標

一個**公開可讀、無登入**嘅新聞追蹤 dashboard：
- 每小時更新全球 + 香港新聞 + 巿場數據
- **每日兩封 digest email**：08:30（美股/歐股收巿 + 亞太開巿）、16:30（亞太+港股收巿 + 歐洲開巿）
- 支援事件跟進 timeline（跨日文章自動 cluster 成同一事件）
- 事件分開「進行中／膠著／已完結」

## 2. 功能清單

### MVP
- 每小時 RSS 抓取（全球 6 核心 + 香港 + 財經源）+ Yahoo quote 同步每小時更新
- 事件去重 cluster（trigram Jaccard）
- 事件 timeline：同一事件合併跨日文章 + 狀態
- 全球新聞區 + 香港新聞區
- 巿場卡：13 指數（美股/歐洲/大中華/亞太）
- **Digest 08:30**：前夜收巿 + 日韓澳開巿 brief
- **Digest 16:30**：亞太收巿 + 港股/中/台收巿 + 歐洲開巿 brief
- 全部 email：HTML + plain text 後備、double opt-in、one-click unsubscribe
- 深色為主 UI、純列表 + timeline（唔做地圖）
- degraded mode：冇摘要都出標題＋來源＋連結

### 二期
- PWA ／加到主畫面
- 淺色主題
- 財經 alerts（重磅事件即時推）
- 網站 quote 5 分鐘即時版

### 唔做
- 登入／帳號／留言區／社交功能
- 歷史回填（MVP 由上線日起計）
- 跨裝置追蹤通知（email 除外）
- 任何收費服務

## 3. 數據源

### 3.1 香港（must-have）
- RTHK 即時新聞、政府新聞公報、HKFP、Google News 香港（補漏）

### 3.2 全球核心（6 個，唔再加）
- Reuters、BBC World、AP、Al Jazeera English、Guardian World、NPR

### 3.3 財經（每巿場限 1–2，keep lean）
| 巿場 | 源 |
|---|---|
| 全球 | Reuters Markets、AP Business |
| 美股 | CNBC（或 MarketWatch） |
| 日本 | Nikkei Asia（或 NHK World Business） |
| 韓國 | Yonhap English（或 The Korea Herald） |
| 澳洲 | ABC News Business（或 AFR） |

### 3.4 巿場數據（Yahoo Finance，免費，無 key）
- **美股**：Dow `^DJI`、S&P500 `^GSPC`、Nasdaq `^IXIC`
- **歐洲**：FTSE100 `^FTSE`、DAX `^GDAXI`、CAC40 `^FCHI`
- **大中華**：恒指 `^HSI`、上證 `000001.SS`、滬深300 `000300.SS`、台灣 `^TWII`
- **亞太**：日經 `^N225`、KOSPI `^KS11`、ASX200 `^AXJO`
- 指數數字一律嚟自 API，**唔准用 RSS 標題估數**；LLM 只寫一句總結
- quote **每小時**同 RSS 一齊 refresh（二期先做 5 分鐘）

## 4. 技術棧

| 層 | 選擇 |
|---|---|
| 排程 | **Replit scheduled job**（fetch-hourly、digest 08:30、digest 16:30）；後備 GitHub Actions cron |
| 抓取 | Node script：RSS fetch（timeout + retry + 降級）+ Yahoo Finance quote |
| 摘要 | 傾向 RSS 內文；唔夠料**瞬時開原文**（只做 LLM 輸入，**唔存正文**），開唔到 → degraded |
| 儲存 | Supabase free tier：`events` / `articles` / `subscribers` |
| 後端 | Replit Node/Express API |
| 前端 | Replit Vite + TS（React） |
| Email | Resend free tier（3,000/月、100/日）；**>50 訂閱者轉 Brevo**（300/日、9,000/月） |
| LLM | 增量用；GitHub Models 優先，DeepSeek 後備 |

## 5. 排程（香港時間）

| 任務 | HKT | 點行 |
|---|---|---|
| RSS fetch + quote | 每小時 | Replit scheduled job |
| Digest A（開巿） | 08:30 | Replit scheduled job |
| Digest B（收巿） | 16:30 | Replit scheduled job |

時間線：
- **08:30 digest**：美股前夜收巿（04:00–05:00）✓、歐洲前日收巿（23:00–00:30）✓、東京/韓國 08:00 開巿 ✓、澳洲 07:00/08:00 開巿 ✓、港股/中/台**未開**（09:00–09:30 先知）→ 只能出前日收巿
- **16:30 digest**：東京 14:00 收巿 ✓、澳洲 14:00 收巿 ✓、韓國 14:30 收巿 ✓、台灣 13:30 收巿 ✓、滬深 15:00 收巿 ✓、港股 16:08 收巿 ✓、**歐洲開巿** 15:00/16:00 ✓（開咗 0.5–1.5h，早段）、美股未開巿（21:30/22:30 先開）→ 出昨晚收巿

## 6. Digest 結構

### Digest A — 08:30（開巿）
1. **巿場卡**：`前夜收巿` 美股 Dow/S&P/Nasdaq + 歐洲 FTSE/DAX/CAC + 港股/中/台收巿 → `今早開巿` 日經/KOSPI/ASX
2. **全球新聞**（8–12 事件卡 + 3 條手動 pin top，其餘入「更多」）
3. **香港新聞區**
4. Unsubscribe link

### Digest B — 16:30（收巿）
1. **巿場卡**：`今日收巿` 日經/KOSPI/ASX/港股/滬深/台 → `開巿早段` FTSE/DAX/CAC → `昨晚收巿` 美股（未開巿）
2. **全球新聞**（同上）
3. **香港新聞區**
4. Unsubscribe link

### 版面
- 巿場卡：**13 指數全列、分 4 組**（美股/歐洲/大中華/亞太），email 只顯示 **±%**；點數淨係網站上出
- email 用 **HTML**，plain text 做後備；每封一定有 unsubscribe
- 摘要一律**繁體中文**；標題照用原文（香港源中文原標題照出）

## 7. API 端點

| Method | Route | 用途 |
|---|---|---|
| GET | `/` | SPA frontend |
| GET | `/api/news?region=world\|hk` | 最新事件列表 |
| GET | `/api/events/:id` | 事件 timeline |
| POST | `/api/subscribe` | 訂閱（double opt-in） |
| POST | `/api/confirm?token=` | 確認（24h 有效） |
| POST | `/api/unsubscribe` | 一鍵取消 |
| POST | `/api/digest` | scheduled job 觸發（secret 鑰） |
| GET | `/api/healthz` | Replit startup health |

## 8. 資料 schema（Supabase）

### events
id PK · title（原文）· summary（繁中，可空=degraded）· status（open/stale/resolved）· region · cluster_hash · pinned(bool) · first_seen_at · last_seen_at · source_url

### articles
id PK · event_id FK · source · title · url · fetched_at · raw_hash

### subscribers
id PK · email（唯一 personal data）· token · unsubscribe_token · confirmed_at · status（pending/active/unsubscribed）· created_at

## 9. 檔案結構

```
world-news/
├── replit.toml                # run + scheduled jobs（fetch-hourly / digest-a / digest-b）
├── app/
│   ├── src/                   # Vite + React frontend
│   └── server/                # Express API
├── shared/
│   ├── feeds.ts  ·  dedup.ts  ·  market.ts
├── scripts/
│   ├── fetch-hourly.ts  ·  send-digest.ts
├── config/
│   ├── blacklist.ts  ·  feeds.ts  ·  market.ts（13 指數）
├── supabase/migrations/
├── .env.example
└── README.md
```

## 10. 降級規則

- LLM quota 爆 → 淨出標題＋來源＋連結
- 原文開唔到／RSS 得 excerpt → 摘要 degraded
- 某源連續 24h 0 稿 → 標「可能故障」，仍顯示舊稿
- 單一源失敗 → 獨立降級，唔影響其他
- scheduled job 容錯 ≤15 min 遲
- 敏感內容：git 黑名單 update 即生效，逐次審計記錄