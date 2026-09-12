// app/server/privacy.ts —— M7：Privacy Policy 頁（decision D9 / PCPD）
// 服務端渲染 HTML（同 confirm/unsubscribe 頁一致風格），經 express /privacy 提供。

const SHELL = (body: string): string => `<!doctype html><html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>隱私政策 — World News Tracker</title></head><body style="font-family:-apple-system,'PingFang HK','Microsoft JhengHei',sans-serif;background:#0f1419;color:#e7e9ea;margin:0;padding:40px 16px;display:flex;justify-content:center">
<div style="max-width:640px;width:100%">
  <a href="/" style="color:#88b8ff;font-size:13px">← 返回首頁</a>
  <div style="font-size:26px;font-weight:700;margin:16px 0 6px">隱私政策</div>
  <div style="color:#8b98a5;font-size:13px;margin-bottom:24px">World News Tracker ・ 更新日期：2026-09-12</div>
  ${body}
</div></body></html>`;

const H2 = (t: string): string => `<h2 style="font-size:16px;margin:26px 0 8px">${t}</h2>`;
const P = (t: string): string => `<p style="font-size:14px;line-height:1.8;color:#c4cdd6;margin:0 0 8px">${t}</p>`;

function section(title: string, paragraphs: string[]): string {
  return H2(title) + paragraphs.map(P).join("");
}

export function privacyPageHtml(): string {
  const body = [
    section("1. 我哋收集啲乜", [
      "唯一收集嘅個人資料係你嘅電郵地址（用嚟收每日兩封簡報）同埋兩個一次性 token（確認訂閱同取消訂閱）。我哋唔收集姓名、電話、位置、cookie 或瀏覽記錄。",
      "所有訂閱資料（含電郵 + token）只儲存在 Supabase，且 RLS 已啟用——只有受保護嘅服務帳號可以讀寫，前端 / 外部一律唔可以直接存取。",
    ]),
    section("2. 點解收集 / 點用", [
      "電郵只用作發送你主動訂閱嘅每日簡報（08:30 開巿簡報 ／ 16:30 收巿簡報），以及處理訂閱／取消程序（double opt-in、one-click unsubscribe）。唔會用嚟做任何其他用途，冇任何第三方分享。",
    ]),
    section("3. 保留與刪除（PCPD 最小化原則）", [
      "「訂閱」必須經 double opt-in：你按確認連結（<b>24 小時內有效</b>、單次使用）先會正式訂閱。未確認嘅 pending 訂閱喺 <b>50 日</b>後自動永久刪除。",
      "「取消訂閱」日日兩封電郵底部都有一鍵取消連結——一撳立即將你嘅資料<b>永久刪除</b>，唔會再收到任何簡報。",
    ]),
    section("4. 新聞內容處理（版權 Cap. 528）", [
      "我哋只顯示權限已允許嘅白名單來源 RSS。每則顯示<b>原文標題 + 自己寫嘅繁體中文摘要 + 指向原文嘅連結</b>；我哋<b>唔會存儲、唔會複製、唔會重新發佈</b>文章正文。摘要來源與抓取時間、原文連結全部記錄喺 provenance log，隨時可審計。",
    ]),
    section("5. 內容審查與下架（誹謗 Cap. 21 等）", [
      "所有來源有白名單過濾；出現敏感或違法內容時，我方會即時下架（takedown）並記錄喺審計日誌。版權人／受影響人士認為有內容不當，可以 email 聯絡我哋，會盡快處理。",
    ]),
    section("6. 免責聲明", [
      "全部內容（包括摘要同巿場數據）均由自動程序從白名單來源產生，可能有錯漏，唔構成任何投資或法律意見。巿場數據嚟自免費 API，僅供參考。",
    ]),
    section("7. 聯絡", [
      "任何私隱／下架／訂閱問題：<a href=\"mailto:darrentam76@gmail.com\" style=\"color:#88b8ff\">darrentam76@gmail.com</a>。你亦有權按 PCPD 查閱／更正／刪除自己嘅個人資料。",
    ]),
  ].join("");

  return SHELL(body);
}