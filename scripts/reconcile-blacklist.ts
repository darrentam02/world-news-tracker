// scripts/reconcile-blacklist.ts —— M7：blacklist 更新「即生效」+ 逐次審計（decision D9 / spec §10）
// 每次行：掃描現有 articles + events，凡 title/url 命中 blacklist → 即時下架（刪除）+ audit_log 記 takedown。
// fetch-hourly 每次開始都會行（所以 git commit 黑名單更新 = 下次 fetch 即生效）。
// 用法：SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm exec tsx scripts/reconcile-blacklist.ts
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { isBlacklisted } from "../config/blacklist";
import { logAudit } from "./audit";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("reconcile-blacklist 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function reconcileBlacklist(): Promise<{
  articlesRemoved: number;
  eventsRemoved: number;
}> {
  let articlesRemoved = 0;
  let eventsRemoved = 0;

  const { data: arts, error: artsErr } = await sb
    .from("articles")
    .select("id,title,url,source");
  if (artsErr) throw new Error(`articles: ${artsErr.message}`);
  const artHits = (arts ?? []).filter(
    (a: { title: string; url: string }) => isBlacklisted(a.title, a.url),
  );
  if (artHits.length) {
    await sb.from("articles").delete().in("id", artHits.map((a: { id: string }) => a.id));
    await logAudit(
      artHits.map((a: { id: string; title: string; url: string; source: string }) => ({
        actor: "blacklist",
        action: "takedown",
        target_type: "article",
        target_id: a.id,
        detail: { source: a.source, title: a.title, url: a.url, reason: "blacklist" },
      })),
      sb,
    );
    articlesRemoved = artHits.length;
  }

  const { data: evts, error: evtsErr } = await sb
    .from("events")
    .select("id,title,source_url");
  if (evtsErr) throw new Error(`events: ${evtsErr.message}`);
  const evHits = (evts ?? []).filter((e: { title: string; source_url: string | null }) =>
    isBlacklisted(e.title, e.source_url ?? ""),
  );
  if (evHits.length) {
    await sb.from("events").delete().in("id", evHits.map((e: { id: string }) => e.id));
    await logAudit(
      evHits.map((e: { id: string; title: string; source_url: string | null }) => ({
        actor: "blacklist",
        action: "takedown",
        target_type: "event",
        target_id: e.id,
        detail: { title: e.title, source_url: e.source_url, reason: "blacklist" },
      })),
      sb,
    );
    eventsRemoved = evHits.length;
  }

  if (articlesRemoved || eventsRemoved) {
    console.log(`[reconcile] 下架 article ${articlesRemoved} / event ${eventsRemoved}，已入 audit_log`);
  } else {
    console.log("[reconcile] 冇命中，不需下架");
  }
  return { articlesRemoved, eventsRemoved };
}

const isDirectRun = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isDirectRun) {
  reconcileBlacklist().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}