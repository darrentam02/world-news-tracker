// 敏感內容黑名單（decision D9 / spec §10）
// update 呢個檔 commit 即生效 + 記錄入 audit_log。任何源嘅標題/連結中命中 → 唔入庫、唔出 digest。

export const BLACKLIST_KEYWORDS: string[] = [
  // 例子（自己按需要填）：
  // "極端違法內容",
];

export const BLACKLIST_URL_PATTERNS: RegExp[] = [
  // 例子： /^https:\/\/example\.com\//,
];

export function isBlacklisted(title: string, url: string): boolean {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  if (BLACKLIST_KEYWORDS.some((k) => t.includes(k.toLowerCase()))) return true;
  return BLACKLIST_URL_PATTERNS.some((re) => re.test(u));
}