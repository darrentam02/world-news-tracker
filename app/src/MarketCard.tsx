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
          {g.indices.map((idx) => (
            <div key={idx.symbol} className="market-row">
              <span className="market-name">{idx.name}</span>
              <span className="market-symbol">{idx.symbol}</span>
              <span className="market-quote">—</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}