import { useEffect, useState } from "react";
import type { Healthz } from "@world-news/shared";

export default function App() {
  const [health, setHealth] = useState<Healthz | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/healthz")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((h) => setHealth(h as Healthz))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="shell">
      <h1>World News Tracker</h1>
      <p className="tagline">每小時全球 + 香港 + 巿場新聞</p>
      <section>
        {error ? (
          <p className="bad">API 未連上：{error}</p>
        ) : health ? (
          <p className="ok">
            healthz：{health.status} @ {health.time}
          </p>
        ) : (
          <p>loading…</p>
        )}
      </section>
    </main>
  );
}