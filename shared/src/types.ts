import type { MarketGroup } from "./market";

export type EventStatus = "open" | "stale" | "resolved";
export type Region = "world" | "hk" | "markets";
export type SubscriberStatus = "pending" | "active" | "unsubscribed";

export interface Event {
  id: string;
  title: string;
  summary: string | null;
  status: EventStatus;
  region: Region;
  cluster_hash: string;
  pinned: boolean;
  first_seen_at: string;
  last_seen_at: string;
  source_url: string | null;
}

export interface Article {
  id: string;
  event_id: string;
  source: string;
  title: string;
  url: string;
  fetched_at: string;
  raw_hash: string;
}

export interface Subscriber {
  id: string;
  email: string;
  token: string;
  unsubscribe_token: string;
  confirmed_at: string | null;
  status: SubscriberStatus;
  created_at: string;
}

export interface Healthz {
  status: string;
  time: string;
}

export interface NewsArticleLight {
  id: string;
  source: string;
  title: string;
  url: string;
  fetched_at: string;
}

export interface EventDetail {
  id: string;
  title: string;
  summary: string | null;
  status: EventStatus;
  region: Region;
  pinned: boolean;
  first_seen_at: string;
  last_seen_at: string;
  source_url: string | null;
}

export interface NewsEventCard extends EventDetail {
  article_count: number;
  latest: NewsArticleLight[];
}

export interface DegradedFeed {
  id: string;
  name: string;
}

export interface NewsResponse {
  region: Region | "all";
  events: NewsEventCard[];
  degraded_feeds: DegradedFeed[];
}

export interface EventTimelineResponse {
  event: EventDetail;
  timeline: NewsArticleLight[];
}

export interface MarketIndexInfo {
  symbol: string;
  name: string;
  group: MarketGroup;
}

export interface MarketQuoteData {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  quote_time: string | null;
  fetched_at: string;
}

export interface MarketIndexWithQuote extends MarketIndexInfo {
  quote: MarketQuoteData | null;
}

export interface MarketGroupPayload {
  group: MarketGroup;
  label: string;
  indices: MarketIndexWithQuote[];
}

export interface MarketResponse {
  groups: MarketGroupPayload[];
}