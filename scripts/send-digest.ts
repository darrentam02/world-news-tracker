// scripts/send-digest.ts —— M6：每日兩封 digest（決策 D3/D6 + spec §5/§6）
//   Digest A 08:30（開巿）：前夜收巿美股/歐洲 + 港股中大中華前日收巿 + 日韓澳今早開巿
//   Digest B 16:30（收巿）：亞太/大中華今日收巿 + 歐洲開巿早段 + 昨晚收巿美股
// 巿場卡 email 只出 ±%；HTML + plain text 後備；每封一定有 unsubscribe（one-click）。
// 用法：pnpm digest-a / pnpm digest-b（有 RESEND_API_KEY 先真寄，無就 dry-run）
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { MARKET_GROUP_LABELS, MARKET_INDICES } from "../shared/src/market";
import type { MarketGroup } from "../shared/src/market";
import { FEEDS } from "../shared/src/feeds";
import type { MarketQuoteData, Region } from "../shared/src/types";
import { sendEmail, publicBaseUrl } from "./email";

type DigestSlot = "a" | "b";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("send-digest 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOURCE_NAMES = new Map(FEEDS.map((f) => [f.id, f.name]));

const SUBJECTS: Record<DigestSlot, string> = {
  a: "World News 開巿簡報（08:30）",
  b: "World News 收巿簡報（16:30）",
};

// spec §5 時間線：每個 slot 每組巿場嘅註解
const SLOT_ORDER: Record<DigestSlot, Array<{ group: MarketGroup; note: string }>> = {
  a: [
    { group: "US", note: "前夜收巿" },
    { group: "EU", note: "前日收巿" },
    { group: "GreaterChina", note: "前日收巿" },
    { group: "AsiaPacific", note: "今早開巿" },
  ],
  b: [
    { group: "AsiaPacific", note: "今日收巿" },
    { group: "GreaterChina", note: "今日收巿" },
    { group: "EU", note: "開巿早段" },
    { group: "US", note: "昨晚收巿" },
  ],
};

interface SubscriberRow {
  email: string;
  unsubscribe_token: string;
}

interface PoolEvent {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  region: Region;
  pinned: boolean;
  last_seen_at: string;
  source_url: string | null;
  latest: Array<{ source: string; title: string; url: string; fetched_at: string }>;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hktShort(iso: string): string {
  return new Intl.DateTimeFormat("zh-Hant", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pct(q: MarketQuoteData): string {
  const v = q.change_pct;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function marketRows(quotes: Map<string, MarketQuoteData>, slot: DigestSlot): string {
  const rows: string[] = [];
  for (const { group, note } of SLOT_ORDER[slot]) {
    const label = MARKET_GROUP_LABELS[group];
    const cells = MARKET_INDICES.filter((i) => i.group === group)
      .map((i) => {
        const q = quotes.get(i.symbol);
        return q ? `${i.name} ${pct(q)}` : `${i.name} —`;
      })
      .join("　");
    rows.push(`【${label}・${note}】${cells}`);
  }
  return rows.join("\n");
}

// 依 shared MARKET_INDICES（13 指數）分組

function eventCards(events: PoolEvent[]): { html: string; text: string } {
  const parts: string[] = [];
  for (const ev of events) {
    const src = ev.latest[0];
    const srcName = src ? SOURCE_NAMES.get(src.source) ?? src.source : "";
    const link = ev.source_url ?? src?.url ?? "";
    const summary = ev.summary ? escapeHtml(ev.summary) : "（暫無摘要，見來源）";
    const statusLabel =
      ev.status === "open" ? "進行中" : ev.status === "stale" ? "膠著" : "已完結";
    parts.push(
      `<div style="margin:0 0 16px">
        <div style="font-size:15px;font-weight:700;line-height:1.45"><a href="${escapeHtml(link)}" style="color:#0f6bb5;text-decoration:none">${escapeHtml(ev.title)}</a></div>
        <div style="color:#333333;font-size:14px;line-height:1.6;margin:4px 0 0">${summary}</div>
        <div style="color:#777777;font-size:12px;margin-top:4px">${escapeHtml(srcName)} ・ ${hktShort(ev.last_seen_at)} ・ ${statusLabel}</div>
      </div>`,
    );
  }
  const text = events
    .map((ev) => {
      const src = ev.latest[0];
      const link = ev.source_url ?? src?.url ?? "";
      const srcName = src ? SOURCE_NAMES.get(src.source) ?? src.source : "";
      return `${ev.title}\n  ${ev.summary ?? "（暫無摘要）"}\n  ${srcName} ・ ${link} ・ ${ev.last_seen_at}`;
    })
    .join("\n\n");
  return { html: parts.join(""), text };
}

function buildDigest(opts: {
  slot: DigestSlot;
  quotes: Map<string, MarketQuoteData>;
  events: PoolEvent[];
  subscriber: { email: string; unsubscribe_token: string };
}): { html: string; text: string; subject: string } {
  const slot = opts.slot;
  const base = publicBaseUrl();
  const unsubUrl = `${base}/api/unsubscribe?token=${encodeURIComponent(opts.subscriber.unsubscribe_token)}`;

  const hkEvents = opts.events.filter((e) => e.region === "hk");
  const worldEvents = opts.events.filter((e) => e.region !== "hk");

  const marketHtml = SLOT_ORDER[slot]
    .map(({ group, note }) => {
      const label = MARKET_GROUP_LABELS[group];
      const rows = MARKET_INDICES.filter((i) => i.group === group)
        .map((i) => {
          const q = opts.quotes.get(i.symbol);
          if (!q) return `<tr><td style="padding:4px 8px;font-size:13px">${escapeHtml(i.name)}</td><td style="padding:4px 8px;font-size:13px;text-align:right;color:#999">—</td></tr>`;
          const color = q.change_pct >= 0 ? "#1a7f37" : "#cf222e";
          return `<tr><td style="padding:4px 8px;font-size:13px">${escapeHtml(i.name)}</td><td style="padding:4px 8px;font-size:13px;text-align:right;color:${color}">${pct(q)}</td></tr>`;
        })
        .join("");
      return `<h3 style="font-size:13px;color:#555;margin:18px 0 6px">${escapeHtml(label)}（${escapeHtml(note)}）</h3><table style="border-collapse:collapse;width:100%">${rows}</table>`;
    })
    .join("");

  const worldCards = eventCards(worldEvents);
  const hkCards = eventCards(hkEvents);

  const html = `<div style="font-family:-apple-system,'Segoe UI','PingFang HK','Microsoft JhengHei',sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#10161f;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">
    <div style="font-size:20px;font-weight:700">World News Tracker</div>
    <div style="font-size:12px;color:#9aa7b4">${slot === "a" ? "開巿簡報" : "收巿簡報"} ・ 每小時新聞 ＋ 巿場數據</div>
  </div>
  <div style="border:1px solid #e2e2e2;border-top:none;padding:22px">
    <h2 style="font-size:16px;margin:0 0 4px">巿場卡</h2>
    ${marketHtml}
    <h2 style="font-size:16px;margin:28px 0 4px">全球新聞</h2>
    ${worldCards.html}
    ${hkEvents.length ? `<h2 style="font-size:16px;margin:28px 0 4px">香港新聞區</h2>${hkCards.html}` : ""}
    <div style="margin-top:26px;padding-top:14px;border-top:1px solid #eee;font-size:12px;color:#888">
      唔想再收到？<a href="${unsubUrl}" style="color:#0f6bb5">一鍵取消訂閱</a> ・ <a href="${base}/privacy" style="color:#0f6bb5">隱私政策</a><br/>
      World News Tracker ・ 白名單源自動摘要，非投資建議
    </div>
  </div></div>`;

  const text = `World News Tracker — ${slot === "a" ? "開巿簡報" : "收巿簡報"}\n\n【巿場卡】\n${marketRows(opts.quotes, slot)}\n\n【全球新聞】\n${worldCards.text}\n${hkEvents.length ? `\n【香港新聞區】\n${hkCards.text}\n` : ""}\n唔想再收到？${unsubUrl}\n隱私政策：${base}/privacy`;

  return { html, text, subject: SUBJECTS[slot] };
}

interface QuoteRow {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  quote_time: string | null;
  fetched_at: string;
}

async function loadLatestQuotes(): Promise<Map<string, MarketQuoteData>> {
  const { data, error } = await sb
    .from("quotes")
    .select("symbol,price,change,change_pct,quote_time,fetched_at")
    .order("fetched_at", { ascending: false });
  if (error) throw new Error(`quotes: ${error.message}`);
  const rows = (data ?? []) as unknown as QuoteRow[];
  const latest = new Map<string, MarketQuoteData>();
  for (const row of rows) {
    if (!latest.has(row.symbol)) {
      latest.set(row.symbol, {
        symbol: row.symbol,
        price: Number(row.price),
        change: Number(row.change),
        change_pct: Number(row.change_pct),
        quote_time: row.quote_time,
        fetched_at: row.fetched_at,
      });
    }
  }
  return latest;
}

interface EventRowSQL {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  region: Region;
  pinned: boolean | null;
  last_seen_at: string;
  source_url: string | null;
  articles: Array<{ source: string; title: string; url: string; fetched_at: string }>;
}

async function loadEventPool(): Promise<PoolEvent[]> {
  const { data, error } = await sb
    .from("events")
    .select("id,title,summary,status,region,pinned,last_seen_at,source_url,articles(source,title,url,fetched_at)")
    .order("pinned", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`events: ${error.message}`);
  const rows = (data ?? []) as unknown as EventRowSQL[];
  const pool: PoolEvent[] = rows.map((row) => {
    const arts = (row.articles ?? []).slice().sort(
      (a: { fetched_at: string }, b: { fetched_at: string }) =>
        new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime(),
    );
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      status: row.status,
      region: row.region,
      pinned: Boolean(row.pinned),
      last_seen_at: row.last_seen_at,
      source_url: row.source_url,
      latest: arts.slice(0, 1),
    };
  });
  const pinned = pool.filter((e) => e.pinned).slice(0, 3);
  const rest = pool.filter((e) => !e.pinned).slice(0, 12);
  return [...pinned, ...rest];
}

const loadSubscribers = async (): Promise<SubscriberRow[]> => {
  const { data, error } = await sb
    .from("subscribers")
    .select("email,unsubscribe_token")
    .eq("status", "active");
  if (error) throw new Error(`subscribers: ${error.message}`);
  return (data ?? []) as unknown as SubscriberRow[];
};

export async function sendDigest(slot: DigestSlot): Promise<{ sent: number; dryRun: boolean }> {
  const [subscribers, quotes, events] = await Promise.all([
    loadSubscribers(),
    loadLatestQuotes(),
    loadEventPool(),
  ]);

  if (!subscribers.length) {
    console.log("[digest] 冇 active subscriber，skip");
    return { sent: 0, dryRun: false };
  }

  const sample = buildDigest({ slot, quotes, events, subscriber: subscribers[0] });
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log(`[digest dry-run] slot=${slot.toUpperCase()}・收件人 ${subscribers.length} 個`);
    console.log(`   subject: ${sample.subject}`);
    console.log(`   html: ${sample.html.length} chars / text: ${sample.text.length} chars`);
    console.log(`   巿場卡示例：\n${marketRows(quotes, slot).split("\n").slice(0, 6).join("\n")}`);
    return { sent: 0, dryRun: true };
  }

  let sent = 0;
  for (const sub of subscribers) {
    const msg = buildDigest({ slot, quotes, events, subscriber: sub });
    try {
      await sendEmail({ to: sub.email, subject: msg.subject, html: msg.html, text: msg.text });
      sent++;
    } catch (e) {
      console.warn(`[digest] 寄唔到 ${sub.email}: ${(e as Error).message}`);
    }
  }
  console.log(`[digest] slot=${slot.toUpperCase()} 寄出 ${sent}/${subscribers.length}`);
  return { sent, dryRun: false };
}

const isDirectRun = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isDirectRun) {
  const slotFlag = process.argv.find((a) => a.startsWith("--slot="));
  const slot: DigestSlot = slotFlag === "--slot=b" ? "b" : "a";
  sendDigest(slot).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}