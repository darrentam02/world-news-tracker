import type { Region } from "./types";

export interface FeedSource {
  id: string;
  name: string;
  region: Region;
  url: string;
}

// 源白名單（spec §3，decision D4）—— RSS 公開 feed；有啲 publisher 冇公開 RSS 就用
// Google News site: 搜索餾充（如 Reuters/AP/Nikkei）。加源要過 spec 先可,唔好自己加。
export const FEEDS: FeedSource[] = [
  // ---- 全球核心 6（spec §3.2）----
  { id: "bbc-world", name: "BBC World", region: "world", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "guardian-world", name: "Guardian World", region: "world", url: "https://www.theguardian.com/world/rss" },
  { id: "npr-world", name: "NPR World", region: "world", url: "https://feeds.npr.org/1001/rss.xml" },
  { id: "aljazeera", name: "Al Jazeera English", region: "world", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { id: "ap-topnews", name: "AP Top News", region: "world", url: "https://news.google.com/rss/search?q=site%3Aapnews.com&hl=en&gl=US&ceid=US:en" },
  { id: "reuters", name: "Reuters", region: "world", url: "https://news.google.com/rss/search?q=site%3Areuters.com&hl=en&gl=US&ceid=US:en" },

  // ---- 香港（spec §3.1，must-have）----
  { id: "rthk-local", name: "RTHK 即時新聞(本地)", region: "hk", url: "https://rthk.hk/rthk/news/rss/c_expressnews_clocal.xml" },
  { id: "rthk-intl", name: "RTHK 即時新聞(國際)", region: "hk", url: "https://rthk.hk/rthk/news/rss/c_expressnews_cinternational.xml" },
  { id: "hkgov", name: "政府新聞網", region: "hk", url: "https://www.news.gov.hk/tc/common/html/topstories.rss.xml" },
  { id: "hkfp", name: "HKFP", region: "hk", url: "https://hongkongfp.com/feed/" },
  { id: "google-news-hk", name: "Google News 香港", region: "hk", url: "https://news.google.com/rss?hl=zh-HK&gl=HK&ceid=HK:zh-Hant" },

  // ---- 財經（spec §3.3，每市場限 1–2）----
  { id: "cnbc", name: "CNBC", region: "markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { id: "reuters-markets", name: "Reuters Markets", region: "markets", url: "https://news.google.com/rss/search?q=site%3Areuters.com%2Fmarkets&hl=en&gl=US&ceid=US:en" },
  // AP Business / ABC Business：用 Google News site: 只係搵到條 topic 頁,唔出真文章 —— 暫停,重用時解註
  // { id: "ap-business", name: "AP Business", region: "markets", url: "https://news.google.com/rss/search?q=site%3Aapnews.com%2Fhub%2Fbusiness&hl=en&gl=US&ceid=US:en" },
  // { id: "abc-business", name: "ABC News Business (AU)", region: "markets", url: "https://news.google.com/rss/search?q=site%3Aabc.net.au%2Fnews%2Fbusiness&hl=en&gl=US&ceid=US:en" },
  { id: "nikkei", name: "Nikkei Asia", region: "markets", url: "https://news.google.com/rss/search?q=site%3Aasia.nikkei.com&hl=en&gl=US&ceid=US:en" },
  { id: "yonhap", name: "Yonhap English", region: "markets", url: "https://en.yna.co.kr/RSS/news.xml" },
];