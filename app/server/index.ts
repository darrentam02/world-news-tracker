import dotenv from "dotenv";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, publicBaseUrl } from "../../scripts/email";
import { sendDigest } from "../../scripts/send-digest";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
import {
  MARKET_INDICES,
  MARKET_GROUP_LABELS,
  marketGroupOrder,
} from "@world-news/shared";
import type {
  NewsResponse,
  EventTimelineResponse,
  MarketResponse,
  NewsEventCard,
  EventDetail,
  NewsArticleLight,
  MarketGroup,
  MarketQuoteData,
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

app.get("/api/market", async (_req, res) => {
  try {
    const latest = new Map<string, MarketQuoteData>();
    if (sb) {
      const { data, error } = await sb
        .from("quotes")
        .select("symbol,price,change,change_pct,quote_time,fetched_at")
        .order("fetched_at", { ascending: false });
      if (error) throw error;
      for (const row of data ?? []) {
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
    }
    const groups = marketGroupOrder().map((group: MarketGroup) => ({
      group,
      label: MARKET_GROUP_LABELS[group],
      indices: MARKET_INDICES.filter((i) => i.group === group).map((i) => ({
        symbol: i.symbol,
        name: i.name,
        group: i.group,
        quote: latest.get(i.symbol) ?? null,
      })),
    }));
    const payload: MarketResponse = { groups };
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

function token(): string {
  return randomBytes(24).toString("base64url");
}

const EMAIL_RE_HTML_PAGE = (title: string, bodyHtml: string): string =>
  `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:-apple-system,'PingFang HK','Microsoft JhengHei',sans-serif;background:#0f1419;color:#e7e9ea;margin:0;padding:48px 16px;display:flex;justify-content:center"><div style="max-width:480px;width:100%"><div style="font-size:22px;font-weight:700;margin-bottom:16px">World News Tracker</div><div style="background:#151d26;border:1px solid #22313f;border-radius:12px;padding:24px">${bodyHtml}</div></div></body></html>`;

app.post("/api/subscribe", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "email 格式唔啱" });
    }
    const { data: existing } = await sb
      .from("subscribers")
      .select("id,status")
      .eq("email", email)
      .limit(1);
    if ((existing?.[0]?.status as string | undefined) === "active") {
      return res.json({ ok: true, message: "你已經訂閱咗" });
    }

    const confirmToken = token();
    const unsubscribeToken = token();
    const { error: upsertErr } = await sb
      .from("subscribers")
      .upsert(
        {
          email,
          token: confirmToken,
          unsubscribe_token: unsubscribeToken,
          status: "pending",
          confirmed_at: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
    if (upsertErr) throw upsertErr;

    const base = publicBaseUrl();
    const confirmUrl = `${base}/api/confirm?token=${encodeURIComponent(confirmToken)}`;
    const html = `<p style="font-size:16px;line-height:1.7">請確認訂閱 World News 每日簡報：<br/><a href="${confirmUrl}" style="color:#88b8ff">確認訂閱</a></p><p style="color:#8b98a5;font-size:13px">連結 24 小時內有效。冇訂閱過嘅話可以直接無視呢封電郵。</p>`;
    const text = `請確認訂閱 World News 每日簡報（24 小時內有效）：\n${confirmUrl}\n\n你可能冇訂閱過？直接刪除呢封電郵就當冇事。`;

    if (!process.env.RESEND_API_KEY) {
      return res.json({
        ok: true,
        message: "確認電郵已準備寄出（dev 模式：RESEND_API_KEY 未設定，以下係佢個 link）",
        dev_confirm_url: confirmUrl,
      });
    }
    await sendEmail({ to: email, subject: "確認訂閱 World News 每日簡報", html, text });
    res.json({ ok: true, message: "確認電郵已寄出，請 24 小時內確認" });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

async function confirmForToken(token: string) {
  if (!sb) return { status: 503, title: "出錯", body: "supabase 未設定" };
  if (!token) return { status: 400, title: "連結無效", body: "冇揀到 token。" };
  const { data, error } = await sb
    .from("subscribers")
    .select("id,email,status,created_at")
    .eq("token", token)
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { status: 404, title: "連結無效", body: "呢條確認連結唔存在或已用。" };
  if (row.status === "active") return { status: 410, title: "已確認", body: "呢個電郵已經確認咗訂閱。" };
  if (Date.now() - new Date(row.created_at).getTime() > CONFIRM_WINDOW_MS) {
    return { status: 410, title: "連結已過期", body: "確認連結超過 24 小時，請重新訂閱。" };
  }
  const { error: updateErr } = await sb
    .from("subscribers")
    .update({ status: "active", confirmed_at: new Date().toISOString() })
    .eq("id", row.id);
  if (updateErr) throw updateErr;
  return { status: 200, title: "確認成功", body: `${row.email} 已訂閱，每日 08:30 / 16:30 自動收到簡報。` };
}

async function unsubscribeForToken(token: string) {
  if (!sb) return { status: 503, title: "出錯", body: "supabase 未設定" };
  if (!token) return { status: 400, title: "連結無效", body: "冇揀到 token。" };
  const { data, error } = await sb
    .from("subscribers")
    .select("id,email")
    .eq("unsubscribe_token", token)
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { status: 404, title: "已取消", body: "搵唔到呢個訂閱（可能已經刪咗）。" };
  const { error: delErr } = await sb.from("subscribers").delete().eq("id", row.id);
  if (delErr) throw delErr;
  return { status: 200, title: "已取消訂閱", body: `${row.email} 嘅訂閱已刪除，唔會再收到簡報。` };
}

app.get("/api/confirm", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const result = await confirmForToken((req.query.token as string) ?? "");
    res.status(result.status).send(EMAIL_RE_HTML_PAGE(result.title, `<h1 style="font-size:18px;margin:0 0 10px">${result.title}</h1><p style="color:#c4cdd6;line-height:1.7">${result.body}</p>`));
  } catch (e) {
    res.status(500).send(EMAIL_RE_HTML_PAGE("出錯", `<p>${(e as Error).message}</p>`));
  }
});

app.post("/api/confirm", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const token = (req.body?.token as string | undefined) ?? (req.query.token as string | undefined) ?? "";
    const result = await confirmForToken(token);
    res.status(result.status === 400 ? 400 : result.status).json({ ok: result.status === 200, ...result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.get("/api/unsubscribe", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const result = await unsubscribeForToken((req.query.token as string) ?? "");
    res.status(result.status).send(EMAIL_RE_HTML_PAGE(result.title, `<h1 style="font-size:18px;margin:0 0 10px">${result.title}</h1><p style="color:#c4cdd6;line-height:1.7">${result.body}</p>`));
  } catch (e) {
    res.status(500).send(EMAIL_RE_HTML_PAGE("出錯", `<p>${(e as Error).message}</p>`));
  }
});

app.post("/api/unsubscribe", async (req, res) => {
  try {
    if (!sb) return res.status(503).json({ error: "supabase 未設定" });
    const token = (req.body?.token as string | undefined) ?? (req.query.token as string | undefined) ?? "";
    const result = await unsubscribeForToken(token);
    const status = result.status === 400 ? 400 : result.status;
    res.status(status).json({ ok: status === 200, title: result.title, body: result.body });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post("/api/digest", async (req, res) => {
  try {
    const secret = (req.body?.secret as string | undefined) ?? "";
    if (!process.env.DIGEST_SECRET || secret !== process.env.DIGEST_SECRET) {
      return res.status(401).json({ error: "secret 錯" });
    }
    const slot = (req.body?.slot as string | undefined) ?? "a";
    if (slot !== "a" && slot !== "b") return res.status(400).json({ error: "slot 要係 a | b" });
    const result = await sendDigest(slot);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const distPath = fileURLToPath(new URL("../dist", import.meta.url));
mkdirSync(distPath, { recursive: true });
app.use(express.static(distPath));

app.listen(port, () => {
  console.log(`world-news api listening on :${port}`);
});