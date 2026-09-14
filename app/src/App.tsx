import { useEffect, useState, useCallback } from "react";
import type { NewsResponse, MarketResponse, EventTimelineResponse, Region } from "@world-news/shared";
import { fetchNews, fetchMarket, fetchEvent } from "./api";
import { EventCard } from "./EventCard";
import { EventTimeline } from "./EventTimeline";
import { MarketCard } from "./MarketCard";
import { SubscribeBox } from "./SubscribeBox";
import { REGION_LABELS } from "./ui";

const TABS: Region[] = ["world", "hk"];

export default function App() {
  const [region, setRegion] = useState<Region>("world");
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [selected, setSelected] = useState<EventTimelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refreshDashboard = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [nextNews, nextMarket] = await Promise.all([
        fetchNews(region),
        fetchMarket(),
      ]);
      setNews(nextNews);
      setMarket(nextMarket);
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    void refreshDashboard(true);
    const interval = window.setInterval(() => void refreshDashboard(false), 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshDashboard(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshDashboard]);

  const openEvent = useCallback((id: string) => {
    fetchEvent(id)
      .then(setSelected)
      .catch((e: Error) => setError(e.message));
  }, []);

  const closeEvent = useCallback(() => setSelected(null), []);

  return (
    <main className="shell">
      <header className="head">
        <h1>World News Tracker</h1>
        <p className="tagline">每小時全球 + 香港 + 巿場新聞</p>
        {updatedAt && <p className="updated">最後更新：{updatedAt.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit" })}</p>}
      </header>

      <SubscribeBox />

      {selected ? (
        <EventTimeline data={selected} onBack={closeEvent} />
      ) : (
        <>
          <MarketCard market={market} />
          <nav className="tabs" role="tablist">
            {TABS.map((r) => (
              <button
                key={r}
                className={`tab${r === region ? " tab-active" : ""}`}
                onClick={() => setRegion(r)}
                role="tab"
                aria-selected={r === region}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </nav>
          {error && <p className="bad">出錯：{error}</p>}
          {loading && <p>載入中…</p>}
          {!loading && news && news.degraded_feeds.length > 0 && (
            <p className="degraded">
              ⚠ 可能故障源：{news.degraded_feeds.map((d) => d.name).join("、")}（仍顯示舊稿）
            </p>
          )}
          {!loading && news && news.events.length === 0 && <p className="muted">暫時冇事件</p>}
          {!loading && news && (
            <section className="feed">
              {news.events.map((ev) => (
                <EventCard key={ev.id} event={ev} onSelect={openEvent} />
              ))}
            </section>
          )}
          <footer className="foot">
            <a href="/privacy">隱私政策</a>
          </footer>
        </>
      )}
    </main>
  );
}