import type {
  NewsResponse,
  EventTimelineResponse,
  MarketResponse,
  Region,
} from "@world-news/shared";

export interface SubscribeResult {
  ok: boolean;
  message?: string;
  dev_confirm_url?: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const fetchNews = (region: Region): Promise<NewsResponse> =>
  get<NewsResponse>(`/api/news?region=${region}`);

export const fetchEvent = (id: string): Promise<EventTimelineResponse> =>
  get<EventTimelineResponse>(`/api/events/${id}`);

export const fetchMarket = (): Promise<MarketResponse> => get<MarketResponse>("/api/market");

export async function subscribe(email: string): Promise<SubscribeResult> {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<SubscribeResult> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as SubscribeResult;
}