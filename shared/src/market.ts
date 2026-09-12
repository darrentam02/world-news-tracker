export type MarketGroup = "US" | "EU" | "GreaterChina" | "AsiaPacific";

export const MARKET_GROUP_LABELS: Record<MarketGroup, string> = {
  US: "美股",
  EU: "歐洲",
  GreaterChina: "大中華",
  AsiaPacific: "亞太",
};

export interface MarketIndex {
  symbol: string;
  name: string;
  group: MarketGroup;
}

export const MARKET_INDICES: MarketIndex[] = [
  { symbol: "^DJI", name: "Dow Jones", group: "US" },
  { symbol: "^GSPC", name: "S&P 500", group: "US" },
  { symbol: "^IXIC", name: "Nasdaq Composite", group: "US" },
  { symbol: "^FTSE", name: "FTSE 100", group: "EU" },
  { symbol: "^GDAXI", name: "DAX", group: "EU" },
  { symbol: "^FCHI", name: "CAC 40", group: "EU" },
  { symbol: "^HSI", name: "恒生指數 (Hang Seng)", group: "GreaterChina" },
  { symbol: "000001.SS", name: "上證綜合指數", group: "GreaterChina" },
  { symbol: "000300.SS", name: "滬深300", group: "GreaterChina" },
  { symbol: "^TWII", name: "台灣加權指數 (TWSE)", group: "GreaterChina" },
  { symbol: "^N225", name: "日經225 (Nikkei)", group: "AsiaPacific" },
  { symbol: "^KS11", name: "KOSPI", group: "AsiaPacific" },
  { symbol: "^AXJO", name: "ASX 200", group: "AsiaPacific" },
];

export function marketGroupOrder(): MarketGroup[] {
  return ["US", "EU", "GreaterChina", "AsiaPacific"];
}