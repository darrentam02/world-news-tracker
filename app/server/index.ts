import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
import { MARKET_INDICES, MARKET_GROUP_LABELS, marketGroupOrder } from "@world-news/shared";
import type {
  NewsResponse,
  EventTimelineResponse,
  MarketResponse,
  NewsEventCard,
  EventDetail,
  NewsArticleLight,
  MarketGroup,
  Region,
} from "@world-news/shared";

const app = express();
const port = Number(process.env.PORT ?? 5000);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

app.use(cors());
app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

const REGIONS: Region[] = ["world", "hk", "markets"];

app.get("/api/news", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const region = (req.query.region as string | undefined) ?? "all";
    if (region !== "all" && !(REGIONS as string[]).includes(region)) {
      return res.status(400).json({ error: "region 要係 world | hk | markets | all" });
    }

    let query = sb
      .from("events")
      .select(
        "id,title,summary,status,region,pinned,first_seen_at,last_seen_at,source_url,articles(id,source,title,url,fetched_at)",
      )
      .order("last_seen_at", { ascending: false })
      .limit(60);
    if (region !== "all") query = query.eq("region", region);

    const { data, error } = await query;
    if (error) throw error;

    const events: NewsEventCard[] = (data ?? []).map((row) => {
      const arts = (row.articles ?? [])
        .slice()
        .sort(
          (a: NewsArticleLight, b: NewsArticleLight) =>
            new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime(),
        );
      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        status: row.status,
        region: row.region,
        pinned: row.pinned,
        first_seen_at: row.first_seen_at,
        last_seen_at: row.last_seen_at,
        source_url: row.source_url,
        article_count: arts.length,
        latest: arts.slice(0, 3),
      };
    });

    const payload: NewsResponse = { region: region as NewsResponse["region"], events };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/events/:id", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const { data: events, error } = await sb
      .from("events")
      .select("id,title,summary,status,region,pinned,first_seen_at,last_seen_at,source_url")
      .eq("id", req.params.id)
      .limit(1);
    if (error) throw error;
    const event = events?.[0];
    if (!event) return res.status(404).json({ error: "event 唔存在" });

    const { data: articles, error: timelineError } = await sb
      .from("articles")
      .select("id,source,title,url,fetched_at")
      .eq("event_id", event.id)
      .order("fetched_at", { ascending: true });
    if (timelineError) throw timelineError;

    const payload: EventTimelineResponse = {
      event: event as EventDetail,
      timeline: (articles ?? []) as NewsArticleLight[],
    };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/market", (_req, res) => {
  const groups = marketGroupOrder().map((group: MarketGroup) => ({
    group,
    label: MARKET_GROUP_LABELS[group],
    indices: MARKET_INDICES.filter((i) => i.group === group),
  }));
  const payload: MarketResponse = { groups };
  res.json(payload);
});

const distPath = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(distPath, { recursive: true });
app.use(express.static(distPath));

app.listen(port, () => {
  console.log(`world-news api listening on :${port}`);
});