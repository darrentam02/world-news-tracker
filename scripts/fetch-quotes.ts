// scripts/fetch-quotes.ts —— M5：Yahoo Finance v8 quote（13 指數）→ Supabase quotes 表
// spec §3.4：指數數字一律嚟自 API，唔識用 RSS 估數。每小時同 RSS 一齊 refresh。
// 用法：
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm quotes
//   無 SUPABASE 環境變數時 = dry-run（只打印，唔寫庫）。
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { MARKET_INDICES } from "../shared/src/market";
import type { MarketQuoteData } from "../shared/src/types";

const HTTP_TIMEOUT_MS = 10_000;
const RETRIES = 2;

async function fetchQuote(symbol: string): Promise<MarketQuoteData> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
      const res = await fetch(url, {
        headers: { "user-agent": "world-news-tracker/0.1 (+mailto:darrentam76@gmail.com)" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
      };
      const meta = body.chart?.result?.[0]?.meta;
      if (!meta) throw new Error("Yahoo 冇回 meta");
      const price = meta.regularMarketPrice;
      if (typeof price !== "number") throw new Error("regularMarketPrice 唔係數字");
      const quoteTime =
        typeof meta.regularMarketTime === "number"
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null;
      let change: number;
      let changePct: number;
      if (
        typeof meta.regularMarketChange === "number" &&
        typeof meta.regularMarketChangePercent === "number"
      ) {
        change = meta.regularMarketChange;
        changePct = meta.regularMarketChangePercent;
      } else {
        const prev = (meta.chartPreviousClose ??
          meta.previousClose) as number | undefined;
        if (typeof prev !== "number") throw new Error("無 previousClose 可用來計 ±%");
        change = price - prev;
        changePct = (change / prev) * 100;
      }
      return {
        symbol,
        price: Number(price),
        change: Number(change),
        change_pct: Number(changePct),
        quote_time: quoteTime,
        fetched_at: new Date().toISOString(),
      };
    } catch (e) {
      lastErr = e as Error;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetch quote failed");
}

export async function fetchQuotes(): Promise<{ ok: MarketQuoteData[]; fail: string[] }> {
  const results = await Promise.allSettled(MARKET_INDICES.map((i) => fetchQuote(i.symbol)));
  const ok: MarketQuoteData[] = [];
  const fail: string[] = [];
  results.forEach((r, idx) => {
    const symbol = MARKET_INDICES[idx].symbol;
    if (r.status === "fulfilled") ok.push(r.value);
    else fail.push(`${symbol}: ${(r.reason as Error)?.message ?? String(r.reason)}`);
  });
  return { ok, fail };
}

export async function fetchAndStoreQuotes(): Promise<void> {
  const { ok, fail } = await fetchQuotes();
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log(`[quotes dry-run] ${ok.length} 個 quote，無 SUPABASE 唔寫庫：`);
    for (const q of ok) console.log(`   ${q.symbol.padEnd(10)} ${q.price} (${q.change_pct.toFixed(2)}%)`);
    if (fail.length) console.log(`[quotes dry-run] 失敗 ${fail.length} 個:`);
    for (const f of fail) console.log(`   ${f}`);
    return;
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  if (ok.length) {
    const { error } = await sb.from("quotes").insert(ok);
    if (error) throw new Error(`quotes insert: ${error.message}`);
  }
  console.log(`[quotes] 入庫 ${ok.length}/13` + (fail.length ? `，失敗 ${fail.length} 個` : ""));
  for (const f of fail) console.log(`[quotes] degrade: ${f}`);
}

const isDirectRun = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isDirectRun) {
  fetchAndStoreQuotes().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}