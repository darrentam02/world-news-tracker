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