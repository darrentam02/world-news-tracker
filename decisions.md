# 每小時全球 + 香港新聞追蹤 — decisions.md

> 每個決策 + 理由 + 被淘汰嘅選項。實作有偏離 → 停低問。
> v3（2026-09-12）：已鎖死 —— 加 16:30 收巿 digest、email 只出 ±%、quote 每小時、confirm 24h+50 日清理。

## D1. 部署平台 & stack

**決定：Replit 單一平台主導 + Supabase；排程 = Replit scheduled job，後備 GitHub Actions cron**
- 理由：$10 credit + Replit AI；單一平台少一半維護。
- 淘汰：GitHub Pages（無 live）；Lovable；VPS 自 host。

## D2. 儲存

**決定：Supabase free tier：events / articles / subscribers**
- 理由：PostgreSQL 可查可刪（PCPD）。
- 淘汰：repo JSON（Replit ephemeral）；Replit KV（冇 SQL）；SQLite（多進程衝突）。

## D3. 排程（時區）

**決定：(a) RSS+quote 每小時；(b) Digest A 08:30；(c) Digest B 16:30**
- 理由：
  - 08:30：美股收巿 04:00–05:00 ✓、歐洲收巿 23:00–00:30 ✓、日韓 08:00 開巿 ✓、澳洲 07:00/08:00 ✓；港股/中/台 09:00–09:30 未開 → 只能出前日收巿
  - 16:30：亞太全部已收巿（14:00–16:08）✓；歐洲 15:00/16:00 開巿早段 ✓；美股未開（21:30/22:30）→ 出昨晚收巿
- 淘汰：只一封 08:00（見唔到港股收巿）；每日三封（quota 爆，讀者厭）。

## D4. 數據源

**決定：**
- 全球核心 6：Reuters、BBC World、AP、Al Jazeera English、Guardian World、NPR
- 香港：RTHK、政府新聞公報、HKFP、Google News HK
- 財經：Reuters Markets／AP Business、CNBC、Nikkei Asia、Yonhap English、ABC Business
- 巿場數據 Yahoo Finance 13 指數：`^DJI ^GSPC ^IXIC` / `^FTSE ^GDAXI ^FCHI` / `^HSI 000001.SS 000300.SS ^TWII` / `^N225 ^KS11 ^AXJO`
- 淘汰：Bloomberg/FT/WSJ（收費）；明報/SCMP；超上限嘅源。

## D5. 事件演算法

**決定：trigram Jaccard cluster；48h 無新稿 → stale；7 日 → resolved；全自動 + admin 手動 pin top 3**
- 淘汰：embedding（過重）；exact match（分唔散）；全套 merge/split admin（過度工程）。

## D6. Digest 內容

**決定：**
- 每次 digest 12–16 條（cluster 後 8–12 事件卡）+ 3 條 pin top
- 巿場卡 13 指數全列、分 4 組；**email 只出 ±%**，點數淨係網站出
- **HTML + plain text 後備**；每封有 unsubscribe；**唔開 tracking**
- 淘汰：only plain text；tracking pixel；只出三條。

## D7. 用戶模型

**決定：公開可讀、無登入；double opt-in email 訂閱**
- 淘汰：登入+帳號；收費訂閱。

## D8. Email 基建

**決定：Resend free（3,000/月、100/日）；每人每封 2 封/日（~60/月x人）→ 免費 tier 上限 = 50 訂閱者；>50 轉 Brevo（300/日、9,000/月 = ~150 訂閱者上限）**
- 理由：每日 2 封係 quota 大戶，要預早計。
- 淘汰：自己 SMTP（spam 地獄）；Mailchimp（UI 重）。

## D9. 合規（PCPD / GDPR / UEMO / Cap. 528）

**決定：**
- 私隱：只存 email+token；double opt-in；one-click unsubscribe；Privacy Policy 頁；唔開 tracking；**confirm link 24h 有效**；**pending >50 日即刪**；unsubscribe 即刪；輕量 DPIA
- 摘要原文：RSS 唔夠料先瞬時開原文做 LLM 輸入，**唔存正文**、唔複製發佈
- 版權（Cap. 528）：標題＋自己繁中摘要＋原連結；每源 RSS TOS 檢查；來源白名單
- 誹謗（Cap. 21）：跟白名單源、冇編輯評論、takedown、免責聲明
- NSL／煽動：git 黑名單 update 即生效、可審計
- 藐視法庭：法律進行中案件掠過
- UEMO（Cap. 593）：sender identity + opt-out
- 審計：provenance log（source_url / fetched_at / raw_hash / edit_history）
- 淘汰：tracking pixel；email 當會員；無限保留。

## D10. 保留期限

**決定：subscriber email unsubscribe 即刪；pending 50 日刪；事件庫永久保留（非個人資料）**
- 淘汰：無限保留。

## D11. UI

**決定：深色為主、可切淺色；列表 + timeline；唔做地圖；原文標題 + 繁中摘要；巿場卡點數+% 網站出**
- 淘汰：MapLibre globe；每則全幅摘要。

## D12. 預算同 LLM

**決定：~$10/月 credit；LLM 增量用（新事件/重大進展），GitHub Models 優先、DeepSeek 後備**
- 淘汰：每條新聞 call LLM；Premium model。

## D13. 唔做

- 歷史回填、登入、跨裝置 push（email 除外）、留言區、收費、廣告。

## 已知矛盾同 Resolve

| 矛盾 | 解法 |
|---|---|
| 跨裝置通知 vs 免費 | email subscription 代替 push |
| $0 vs 平台 | ~$10/月 credit + 免費 tier |
| 財經 noise vs quota | 巿場卡只入 digest；RSS 仍每小時 |
| 08:30 無港股/中/台開巿 | Digest A 出前日收巿；Digest B 16:30 補收巿 + 歐洲開巿 |
| 每日 2 封 vs 免費 tier | Resend 上限 50 人 → Brevo；唔設 quota 限制（自動升） |
| 公開 repo vs 個人資料 | subscriber email 只入 Supabase 唔入 Git |