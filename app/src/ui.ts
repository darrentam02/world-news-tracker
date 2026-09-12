import type { EventStatus, Region } from "@world-news/shared";
import { FEEDS } from "@world-news/shared";

const SOURCE_NAMES = new Map(FEEDS.map((f) => [f.id, f.name]));

export function sourceName(id: string): string {
  return SOURCE_NAMES.get(id) ?? id;
}

export const REGION_LABELS: Record<Region, string> = {
  world: "全球",
  hk: "香港",
  markets: "財經",
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  open: "進行中",
  stale: "膠著",
  resolved: "已完結",
};

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "啱啱";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 日前`;
}

export function formatHkt(iso: string): string {
  return new Intl.DateTimeFormat("zh-Hant", {
    timeZone: "Asia/Hong_Kong",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}