import type { CompanyProfile } from "../../types/company.js";
import type { HistoricalBar } from "../../types/historical.js";
import type { Quote } from "../../types/quote.js";
import type { AssetType, SearchResult } from "../../types/search.js";
import type { AVDailyAdjBar, AVGlobalQuote, AVOverviewResponse, AVSearchMatch } from "./types.js";

const PROVIDER = "alpha-vantage";

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------
export function transformQuote(raw: AVGlobalQuote, includeRaw?: unknown): Quote {
  const price = parseFloat(raw["05. price"]);
  const open = parseFloat(raw["02. open"]);
  const high = parseFloat(raw["03. high"]);
  const low = parseFloat(raw["04. low"]);
  const previousClose = parseFloat(raw["08. previous close"]);
  const change = parseFloat(raw["09. change"]);
  const changePercent = parseFloat(raw["10. change percent"].replace("%", ""));
  const volume = parseInt(raw["06. volume"], 10);
  const latestDay = raw["07. latest trading day"];

  return {
    symbol: raw["01. symbol"],
    name: raw["01. symbol"],
    price,
    change,
    changePercent,
    open,
    high,
    low,
    close: price,
    previousClose,
    volume,
    currency: "USD", // AV free tier is USD only
    exchange: "",
    timestamp: new Date(`${latestDay}T16:00:00-05:00`),
    provider: PROVIDER,
    raw: includeRaw,
  };
}

// ---------------------------------------------------------------------------
// Historical bars
// ---------------------------------------------------------------------------
export function transformHistoricalBars(
  timeSeries: Record<string, AVDailyAdjBar>,
  period1?: Date,
  period2?: Date,
  raw?: unknown,
): HistoricalBar[] {
  return Object.entries(timeSeries)
    .filter(([dateStr]) => {
      const d = new Date(dateStr);
      if (period1 && d < period1) return false;
      if (period2 && d > period2) return false;
      return true;
    })
    .map(([dateStr, bar]): HistoricalBar => ({
      date: new Date(dateStr),
      open: parseFloat(bar["1. open"]),
      high: parseFloat(bar["2. high"]),
      low: parseFloat(bar["3. low"]),
      close: parseFloat(bar["4. close"]),
      adjClose: parseFloat(bar["5. adjusted close"]),
      volume: parseInt(bar["6. volume"], 10),
      ...(raw !== undefined ? { raw } : {}),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
const AV_TYPE_MAP: Record<string, AssetType> = {
  equity: "stock",
  etf: "etf",
  "mutual fund": "mutual-fund",
  crypto: "crypto",
  forex: "forex",
  index: "index",
};

export function transformSearch(match: AVSearchMatch, raw?: unknown): SearchResult {
  const rawType = match["3. type"].toLowerCase();
  return {
    symbol: match["1. symbol"],
    name: match["2. name"],
    type: AV_TYPE_MAP[rawType] ?? "unknown",
    exchange: match["4. region"],
    currency: match["8. currency"],
    provider: PROVIDER,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------
export function transformCompany(data: AVOverviewResponse, raw?: unknown): CompanyProfile {
  return {
    symbol: data.Symbol ?? "",
    name: data.Name ?? data.Symbol ?? "",
    ...(data.Description ? { description: data.Description } : {}),
    ...(data.Sector ? { sector: data.Sector } : {}),
    ...(data.Industry ? { industry: data.Industry } : {}),
    ...(data.Country ? { country: data.Country } : {}),
    ...(data.FullTimeEmployees ? { employees: parseInt(data.FullTimeEmployees, 10) } : {}),
    ...(data.OfficialSite ? { website: data.OfficialSite } : {}),
    ...(data.MarketCapitalization ? { marketCap: parseFloat(data.MarketCapitalization) } : {}),
    ...(data.TrailingPE ? { peRatio: parseFloat(data.TrailingPE) } : {}),
    ...(data.ForwardPE ? { forwardPE: parseFloat(data.ForwardPE) } : {}),
    ...(data.PriceToBookRatio ? { priceToBook: parseFloat(data.PriceToBookRatio) } : {}),
    ...(data.DividendYield ? { dividendYield: parseFloat(data.DividendYield) } : {}),
    ...(data.Beta ? { beta: parseFloat(data.Beta) } : {}),
    ...(data.Exchange ? { exchange: data.Exchange } : {}),
    ...(data.Currency ? { currency: data.Currency } : {}),
    ...(data.IPODate ? { ipoDate: new Date(data.IPODate) } : {}),
    provider: PROVIDER,
    ...(raw !== undefined ? { raw } : {}),
  };
}
