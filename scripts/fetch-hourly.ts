// scripts/fetch-hourly.ts —— M2：每小時抓取 RSS → 清洗 → 入 Supabase articles（列對齊 spec §8）
// 用法：
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm fetch-hourly
//   無 SUPABASE 環境變數時 = dry-run（只打印，唔寫庫），方便日常試 feed。
import "dotenv/config";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import { FEEDS, type FeedSource } from "../config/feeds";
import { isBlacklisted } from "../config/blacklist";
import { runClustering } from "./cluster";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HTTP_TIMEOUT_MS = 12_000;
const RETRIES = 2;
const MAX_ITEMS_PER_FEED = 25;
const MAX_AGE_DAYS = 90;

interface RawItem {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  pubDate?: string;
  description?: string;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function normalizeUrl(u: string): string {
  return u.trim().split(/\s/)[0];
}

function toIso(pubDate?: string): string {
  if (!pubDate) return new Date().toISOString();
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function fetchXml(url: string): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "world-news-tracker/0.1 (+mailto:darrentam76@gmail.com)" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e as Error;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

function parseItems(xml: string): RawItem[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml);
  const channels: unknown[] = [];
  if (Array.isArray(doc.rss?.channel)) channels.push(...doc.rss.channel);
  else if (doc.rss?.channel) channels.push(doc.rss.channel);
  if (Array.isArray(doc.feed)) channels.push(...doc.feed);
  else if (doc.feed) channels.push(doc.feed);

  const items: RawItem[] = [];
  for (const ch of channels) {
    const raw = (ch as { item?: RawItem | RawItem[] }).item;
    if (Array.isArray(raw)) items.push(...raw);
    else if (raw) items.push(raw);
  }
  return items.filter((i) => i.title && i.link);
}

function extractLink(i: RawItem): string | null {
  const l = i.link;
  if (!l) return null;
  if (typeof l === "string") {
    if (l.trim().startsWith("http")) return normalizeUrl(l);
    if ((l as string).includes("href")) return null; // 有 {href} 形態唔當 link
  }
  // Atom <link> 可能係 { "#text" } / { href } / array
  const v = (l as { "#text"?: string })["#text"];
  return v?.startsWith("http") ? normalizeUrl(v) : null;
}

async function fetchFeed(feed: FeedSource): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const xml = await fetchXml(feed.url);
    const items = parseItems(xml).slice(0, MAX_ITEMS_PER_FEED);
    const articles = items
      .map((i) => {
        const url = extractLink(i);
        if (!url) return null;
        const rawHash = sha256(url);
        const publishedAt = toIso(i.pubDate);
        if (Date.now() - new Date(publishedAt).getTime() > MAX_AGE_DAYS * 86_400_000) return null;
        return {
          source: feed.id,
          title: i.title!.trim().slice(0, 400),
          url,
          fetched_at: new Date().toISOString(),
          raw_hash: rawHash,
        };
      })
      .filter((a) => a !== null)
      .filter((a) => !isBlacklisted(a!.title, a!.url));

    await saveArticles(feed, articles);
    return { ok: true, count: articles.length };
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    if (SUPABASE_URL) await logDegrade(feed, msg);
    return { ok: false, count: 0, error: msg };
  }
}

// 依 spec：降級=單一 feed 失敗唔影響其他；連續 24h 0 新文章 → flag（M7 audit 再加，先留位）
async function logDegrade(feed: FeedSource, msg: string): Promise<void> {
  console.warn(`[degrade] ${feed.id}: ${msg}`);
}

// Row 對應 spec §8 articles：source · title · url · fetched_at · raw_hash
type ArticleRow = {
  source: string;
  title: string;
  url: string;
  fetched_at: string;
  raw_hash: string;
};

async function saveArticles(feed: FeedSource, articles: ArticleRow[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // dry-run
    console.log(`[${feed.id}] ${articles.length} articles (dry-run)`);
    for (const a of articles.slice(0, 3)) console.log(`   - ${a.title.slice(0, 60)} | ${a.source} | ${a.fetched_at}`);
    if (articles.length > 3) console.log(`   ... +${articles.length - 3} more`);
    return;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  if (!articles.length) return;

  // raw_hash 只係普通 index（spec 冇要求 unique）——兩步去重：先揀已存在，再淨插入新
  const hashes = articles.map((a) => a.raw_hash);
  const { data, error } = await sb.from("articles").select("raw_hash").in("raw_hash", hashes);
  if (error) throw new Error(`dedupe-query: ${error.message}`);
  const existing = new Set((data ?? []).map((r) => r.raw_hash as string));
  const toInsert = articles.filter((a) => !existing.has(a.raw_hash));
  if (toInsert.length) {
    const { error: insErr } = await sb.from("articles").insert(toInsert);
    if (insErr) throw new Error(`insert: ${insErr.message}`);
  }
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const results = await Promise.all(
    FEEDS.map(async (feed) => ({ feed, result: await fetchFeed(feed) })),
  );
  const ok = results.filter((r) => r.result.ok);
  const fail = results.filter((r) => !r.result.ok);
  const total = ok.reduce((s, r) => s + r.result.count, 0);
  console.log(`\n=== 完成：${ok.length}/${FEEDS.length} feeds OK，${total} articles，費時 ${(Date.now() - t0) / 1000}s ===`);
  if (fail.length) {
    console.log("以下 feed 失敗:");
    for (const { feed, result } of fail) console.log(`   - ${feed.id}: ${result.error}`);
    process.exitCode = 1;
  }

  // M3：每小時 pipeline —— fetch 完即 cluster（新稿併入事件 + status sweep）
  await runClustering();
}

main();