// scripts/cleanup-pending.ts —— M6：double opt-in 合規（決策 D9/D10）
// pending >50 日未確認 → 即刪（PCPD 最小化保留）。行法：Replit scheduled job（每日一次）。
// 用法：SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm cleanup-pending
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PENDING_MAX_DAYS = 50;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("cleanup-pending 需要 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function cleanupPending(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_MAX_DAYS * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("subscribers")
    .delete()
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) throw new Error(`delete pending: ${error.message}`);
  const n = (data ?? []).length;
  console.log(`[cleanup] 刪咗 ${n} 個超過 ${PENDING_MAX_DAYS} 日未確認嘅 pending 訂閱`);
  return n;
}

const isDirectRun = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isDirectRun) {
  cleanupPending().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}