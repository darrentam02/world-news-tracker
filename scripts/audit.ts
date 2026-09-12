// scripts/audit.ts —— audit_log（provenance / edit_history）統一入口
// decision D9：任何 blacklist 生效 / takedown / status 改動都記低，逐次可審計。
// 表 schema（0001_init.sql）：audit_log(id, actor, action, target_type, target_id, detail, created_at)
import { createClient } from "@supabase/supabase-js";

export type AuditAction = "blacklist" | "pin" | "takedown" | "status_change";
export type AuditTarget = "event" | "article" | "subscriber";

export interface AuditEntry {
  actor: string;
  action: AuditAction;
  target_type: AuditTarget;
  target_id: string;
  detail?: Record<string, unknown>;
}

let cachedSb: any = null;

export function auditClient(): any {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  cachedSb ??= createClient(SUPABASE_URL, SUPABASE_KEY);
  return cachedSb;
}

export async function logAudit(rows: AuditEntry[], sb: any = auditClient()): Promise<void> {
  if (!sb) return;
  if (!rows.length) return;
  const { error } = await sb.from("audit_log").insert(rows);
  if (error) throw new Error(`audit_log insert: ${error.message}`);
}

export async function loadBlacklistAuditIds(sb: any = auditClient()): Promise<Set<string>> {
  if (!sb) return new Set();
  const { data, error } = await sb.from("audit_log").select("target_id").eq("action", "blacklist");
  if (error) throw new Error(`audit_log query: ${error.message}`);
  return new Set((data ?? []).map((r: { target_id: string }) => r.target_id));
}