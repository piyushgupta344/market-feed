# Custom Provider

You can add any data source by implementing the `MarketProvider` interface.

## The interface

```ts
import type {
  MarketProvider,
  Quote,
  HistoricalBar,
  HistoricalOptions,
  CompanyProfile,
  NewsItem,
  NewsOptions,
  SearchResult,
  SearchOptions,
  QuoteOptions,
  CompanyOptions,
  MarketStatus,
  MarketStatusOptions,
} from "market-feed";

export class MyProvider implements MarketProvider {
  readonly name = "my-provider";

  // Required
  async quote(symbols: string[], options?: QuoteOptions): Promise<Quote[]> { … }
  async historical(symbol: string, options?: HistoricalOptions): Promise<HistoricalBar[]> { … }
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> { … }

  // Optional
  async company(symbol: string, options?: CompanyOptions): Promise<CompanyProfile> { … }
  async news(symbol: string, options?: NewsOptions): Promise<NewsItem[]> { … }
  async marketStatus(market?: string, options?: MarketStatusOptions): Promise<MarketStatus> { … }
}
```

Only `quote`, `historical`, and `search` are **required**. All others are optional — the `MarketFeed` client skips them and falls back to the next provider.

## Minimal working example

This provider wraps the [Finnhub](https://finnhub.io/) free API:

```ts
import type { MarketProvider, Quote, HistoricalBar, SearchResult } from "market-feed";
import { ProviderError } from "market-feed";

interface FinnhubQuoteResponse {
  c: number;  // current price
  d: number;  // change
  dp: number; // change percent
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
}

export class FinnhubProvider implements MarketProvider {
  readonly name = "finnhub";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async quote(symbols: string[]): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.fetchQuote(s)));
  }

  private async fetchQuote(symbol: string): Promise<Quote> {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new ProviderError(`HTTP ${res.status}`, this.name, res.status);
    }

    const data: FinnhubQuoteResponse = await res.json();

    if (!data.c) {
      throw new ProviderError(`No data for "${symbol}"`, this.name);
    }

    return {
      symbol,
      name: symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      open: data.o,
      high: data.h,
      low: data.l,
      close: data.c,
      previousClose: data.pc,
      volume: 0,
      currency: "USD",
      exchange: "",
      timestamp: new Date(data.t * 1_000),
      provider: this.name,
    };
  }

  async historical(): Promise<HistoricalBar[]> {
    // Implement using Finnhub's /stock/candle endpoint
    return [];
  }

  async search(): Promise<SearchResult[]> {
    // Implement using Finnhub's /search endpoint
    return [];
  }
}
```

## Using your custom provider

```ts
import { MarketFeed } from "market-feed";

const feed = new MarketFeed({
  providers: [
    new FinnhubProvider(process.env.FINNHUB_KEY!),
  ],
});

const quote = await feed.quote("AAPL");
console.log(quote.provider); // "finnhub"
```

## Combining with built-in providers

```ts
const feed = new MarketFeed({
  providers: [
    new FinnhubProvider(process.env.FINNHUB_KEY!),  // primary
    new YahooProvider(),                              // fallback
  ],
  fallback: true,
});
```

## Tips

- Use `ProviderError` to signal HTTP or payload errors
- Use `RateLimitError` for quota exhaustion
- Return the `provider` name on every object so callers know the source
- Implement `options?.raw` to optionally expose raw responses
- Use the `HttpClient` and `RateLimiter` from market-feed to avoid reinventing retry/rate-limit logic:

```ts
import { HttpClient, RateLimiter } from "market-feed";

export class FinnhubProvider implements MarketProvider {
  private http = new HttpClient("finnhub", {
    baseUrl: "https://finnhub.io/api/v1",
    retries: 2,
    timeoutMs: 8_000,
  });
  private limiter = new RateLimiter("finnhub", 30, 30 / 60); // 30/min

  async quote(symbols: string[]) {
    this.limiter.consume();
    const data = await this.http.get("/quote", {
      params: { symbol: symbols[0], token: this.apiKey },
    });
    // …
  }
}
```
