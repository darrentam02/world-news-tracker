// shared/src/dedup.ts —— M3：事件去重/cluster 核心（decision D5）
// 純函數、零依賴、可 unit-test。所有 I/O 由 scripts/cluster.ts 負責。
// 演算法：標題 trigram → Jaccard similarity → 超過 threshold 就算同一事件。
// 已淘汰：embedding（過重）、exact match（分唔散）。

import { createHash } from "node:crypto";

export const SIMILARITY_THRESHOLD = 0.55;
export const STALE_AFTER_MS = 48 * 3600_000; // 48h 無新稿 → stale（膠著）
export const RESOLVED_AFTER_MS = 7 * 24 * 3600_000; // 7 日 → resolved

const NON_ALNUM = /[^\p{L}\p{N}]+/gu;

export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(NON_ALNUM, "");
}

export function trigrams(input: string): Set<string> {
  const s = normalizeTitle(input);
  const t = s.length < 3 ? s.padEnd(3, "#") : s;
  const set = new Set<string>();
  for (let i = 0; i <= t.length - 3; i++) set.add(t.slice(i, i + 3));
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 事件 cluster key：event 標題 trigram 集合嘅 sha256（穩定、可查重） */
export function clusterHash(title: string): string {
  const grams = [...trigrams(title)].sort().join("|");
  return createHash("sha256").update(grams).digest("hex");
}

export interface ClusterArticle {
  title: string;
}

export interface ClusterEvent {
  id: string;
  title: string;
}

/**
 * 揀最似嘅事件。唔似任何現有事件 → null（開新事件）。
 * 比較對象係事件嘅「代表性標題」（= 最新一篇嘅標題），MVP 唔做全套 merge/split。
 */
export function chooseEvent(
  article: ClusterArticle,
  events: ClusterEvent[],
  threshold = SIMILARITY_THRESHOLD,
): ClusterEvent | null {
  const aGrams = trigrams(article.title);
  let best: ClusterEvent | null = null;
  let bestSim = threshold;
  for (const ev of events) {
    const sim = jaccard(aGrams, trigrams(ev.title));
    if (sim > bestSim) {
      bestSim = sim;
      best = ev;
    }
  }
  return best;
}

export type ClusteredStatus = "open" | "stale" | "resolved";

/** 依 last_seen_at 推 status：<48h → open、48h–7日 → stale、>7日 → resolved */
export function eventStatus(lastSeenAtIso: string, nowMs = Date.now()): ClusteredStatus {
  const ts = new Date(lastSeenAtIso).getTime();
  if (Number.isNaN(ts)) return "open";
  const age = nowMs - ts;
  if (age > RESOLVED_AFTER_MS) return "resolved";
  if (age > STALE_AFTER_MS) return "stale";
  return "open";
}