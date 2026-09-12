import type { MarketResponse } from "@world-news/shared";

interface Props {
  market: MarketResponse | null;
}

export function MarketCard({ market }: Props) {
  if (!market) return null;
  return (
    <section className="market">
      {market.groups.map((g) => (
        <div key={g.group} className="market-group">
          <h2 className="market-group-title">{g.label}</h2>
          {g.indices.map((idx) => {
            const q = idx.quote;
            return (
              <div key={idx.symbol} className="market-row" title={q === null ? "未有報價" : undefined}>
                <span className="market-name">{idx.name}</span>
                <span className="market-symbol">{idx.symbol}</span>
                {q === null ? (
                  <span className="market-quote">—</span>
                ) : (
                  <>
                    <span className="market-quote">{q.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                    <span className={`market-pct ${q.change >= 0 ? "up" : "down"}`}>
                      {q.change >= 0 ? "+" : ""}
                      {q.change_pct.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}