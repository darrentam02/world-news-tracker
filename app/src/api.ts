import type {
  NewsResponse,
  EventTimelineResponse,
  MarketResponse,
  Region,
} from "@world-news/shared";

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