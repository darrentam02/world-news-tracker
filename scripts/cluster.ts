// scripts/cluster.ts —— M3：將未分稿嘅 articles cluster 成 events（decision D5）
// 演算法喺 shared/src/dedup.ts（純函數）。
// 每次行：攞無 event_id 嘅稿 → 同現有 events 比 trigram Jaccard →
//   似 → 合併入現有 event（更新 title/last_seen_at）；唔似 → 開新 event。
// 之後 status sweep：48h → stale、7日 → resolved。
// 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY（要讀現有 events，唔支援 dry-run）。

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chooseEvent, clusterHash, eventStatus } from "../shared/src/dedup";
import type { ClusteredStatus } from "../shared/src/dedup";
import { FEEDS } from "../shared/src/feeds";
import type { Region } from "../shared/src/types";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("cluster 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOURCE_REGION = new Map(FEEDS.map((f) => [f.id, f.region] as const));
function regionOf(source: string): Region {
  return SOURCE_REGION.get(source) ?? "world";
}

interface EventRow {
  id: string;
  title: string;
  last_seen_at: string;
  region: Region;
}
interface ArticleRow {
  id: string;
  source: string;
  title: string;
  url: string;
  fetched_at: string;
}

async function loadEvents(): Promise<EventRow[]> {
  const { data, error } = await sb.from("events").select("id,title,last_seen_at,region");
  if (error) throw new Error(`load events: ${error.message}`);
  return (data ?? []) as unknown as EventRow[];
}

async function loadUnassigned(): Promise<ArticleRow[]> {
  const { data, error } = await sb
    .from("articles")
    .select("id,source,title,url,fetched_at")
    .is("event_id", null)
    .order("fetched_at", { ascending: true });
  if (error) throw new Error(`load articles: ${error.message}`);
  return (data ?? []) as unknown as ArticleRow[];
}

function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

async function assign(eventId: string, articleIds: string[]): Promise<void> {
  const { error } = await sb
    .from("articles")
    .update({ event_id: eventId })
    .in("id", articleIds);
  if (error) throw new Error(`assign articles: ${error.message}`);
}

async function statusSweep(): Promise<void> {
  const rows = await loadEvents();
  const by: Record<ClusteredStatus, string[]> = { open: [], stale: [], resolved: [] };
  for (const r of rows) by[eventStatus(r.last_seen_at)].push(r.id);
  for (const status of Object.keys(by) as ClusteredStatus[]) {
    const ids = by[status];
    if (!ids.length) continue;
    const { error } = await sb.from("events").update({ status }).in("id", ids);
    if (error) throw new Error(`status sweep ${status}: ${error.message}`);
  }
  console.log(`status sweep：open ${by.open.length} / stale ${by.stale.length} / resolved ${by.resolved.length}`);
}

export async function runClustering(): Promise<void> {
  const t0 = Date.now();
  const events = await loadEvents();
  const articles = await loadUnassigned();
  console.log(`載入：${events.length} events、${articles.length} 篇未分稿`);

  // centers = 現有 events + 本批途中開嘅新 event（intra-batch 互相合併）
  const centers: Array<{ id: string; title: string }> = events.map((e) => ({ id: e.id, title: e.title }));
  const merged = new Map<string, { articleIds: string[]; latest: ArticleRow; lastSeen: string }>();
  const fresh = new Map<string, { region: Region; cluster: string; latest: ArticleRow; articleIds: string[] }>();

  for (const a of articles) {
    const hit = chooseEvent(a, centers);
    if (!hit) {
      const cluster = clusterHash(a.title);
      let entry = fresh.get(cluster);
      if (!entry) {
        entry = { region: regionOf(a.source), cluster, latest: a, articleIds: [] };
        fresh.set(cluster, entry);
        centers.push({ id: `new:${cluster}`, title: a.title });
      }
      entry.articleIds.push(a.id);
      if (new Date(a.fetched_at) > new Date(entry.latest.fetched_at)) entry.latest = a;
    } else if (hit.id.startsWith("new:")) {
      const entry = fresh.get(hit.id.slice(4))!;
      entry.articleIds.push(a.id);
      if (new Date(a.fetched_at) > new Date(entry.latest.fetched_at)) entry.latest = a;
    } else {
      const seed = events.find((e) => e.id === hit.id);
      const m = merged.get(hit.id) ?? {
        articleIds: [] as string[],
        latest: a,
        lastSeen: seed?.last_seen_at ?? a.fetched_at,
      };
      m.articleIds.push(a.id);
      if (new Date(a.fetched_at) > new Date(m.latest.fetched_at)) m.latest = a;
      m.lastSeen = maxIso(m.lastSeen, a.fetched_at);
      merged.set(hit.id, m);
    }
  }

  for (const [eventId, m] of merged) {
    const { error } = await sb
      .from("events")
      .update({
        title: m.latest.title,
        source_url: m.latest.url,
        last_seen_at: m.lastSeen,
        status: eventStatus(m.lastSeen),
      })
      .eq("id", eventId);
    if (error) throw new Error(`update event ${eventId}: ${error.message}`);
    await assign(eventId, m.articleIds);
  }
  console.log(`合併：${merged.size} 個現有 event 有新增稿`);

  if (fresh.size) {
    const rows = [...fresh.values()].map((n) => ({
      title: n.latest.title,
      cluster_hash: n.cluster,
      region: n.region,
      first_seen_at: n.latest.fetched_at,
      last_seen_at: n.latest.fetched_at,
      status: eventStatus(n.latest.fetched_at),
      source_url: n.latest.url,
    }));
    const { data, error } = await sb.from("events").insert(rows).select();
    if (error) throw new Error(`insert events: ${error.message}`);
    const inserted = (data ?? []) as unknown as Array<{ id: string; cluster_hash: string }>;
    for (const value of fresh.values()) {
      const row = inserted.find((x) => x.cluster_hash === value.cluster);
      if (!row) throw new Error("insert 回傳冇 cluster_hash，邏輯錯");
      await assign(row.id, value.articleIds);
    }
  }
  console.log(`開新：${fresh.size} 個新 event`);

  await statusSweep();

  const { data: summary, error: summaryErr } = await sb
    .from("events")
    .select("id,title,status,region,articles(count)");
  if (summaryErr) throw new Error(`summary: ${summaryErr.message}`);
  const rows = (summary ?? []) as unknown as Array<{
    id: string;
    title: string;
    status: string;
    region: Region;
    articles: Array<{ count: number }>;
  }>;
  const total = rows.length;
  const multi = rows.filter((r) => (r.articles[0]?.count ?? 0) > 1);
  const byRegion: Record<Region, number> = { world: 0, hk: 0, markets: 0 };
  for (const r of rows) byRegion[r.region] = (byRegion[r.region] ?? 0) + 1;
  console.log(`=== 完成：events 總數 ${total}（多稿合併 ${multi.length} 個、新檔 ${fresh.size}）、region ${JSON.stringify(byRegion)}、費時 ${((Date.now() - t0) / 1000).toFixed(1)}s ===`);
  for (const r of multi.slice(0, 8)) {
    console.log(`  [${r.region}/${r.status}] (${r.articles[0].count}) ${r.title.slice(0, 60)}`);
  }
}

const isDirectRun = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isDirectRun) {
  runClustering().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}