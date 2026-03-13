import { ProviderError } from "../../errors.js";
import { HttpClient } from "../../http/client.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote } from "../../types/quote.js";
import type { SearchResult } from "../../types/search.js";

export interface AlpacaProviderOptions {
  /** Alpaca API key ID */
  keyId: string;
  /** Alpaca API secret key */
  secretKey: string;
  /**
   * Data feed: "iex" (free, NLS data) or "sip" (paid, full SIP feed).
   * Default: "iex"
   */
  feed?: "iex" | "sip";
  baseUrl?: string;
  timeout?: number;
  /** Custom fetch function, e.g. a CORS proxy wrapper for browser use. */
  fetchFn?: typeof globalThis.fetch;
}

const DEFAULT_BASE_URL = "https://data.alpaca.markets";

// ---------------------------------------------------------------------------
// Alpaca API response types
// ---------------------------------------------------------------------------

interface AlpacaLatestTrade {
  /** Executed price */
  p: number;
  /** Size (shares) */
  s: number;
  /** Timestamp (RFC3339 nanoseconds) */
  t: string;
  /** Exchange */
  x?: string;
  /** Condition codes */
  c?: string[];
}

interface AlpacaLatestTradesResponse {
  trades: Record<string, AlpacaLatestTrade | undefined>;
}

// ---------------------------------------------------------------------------
// AlpacaProvider
// ---------------------------------------------------------------------------

/**
 * Alpaca market data provider.
 *
 * Supports WebSocket streaming via `market-feed/ws`. Requires a free Alpaca
 * account — sign up at https://alpaca.markets/
 *
 * The WebSocket stream uses the IEX feed by default (free tier). Set
 * `feed: "sip"` for the full SIP consolidated feed (paid plan required).
 */
export class AlpacaProvider implements MarketProvider {
  readonly name = "alpaca";
  private readonly http: HttpClient;
  private readonly keyId: string;
  private readonly secretKey: string;
  readonly feed: "iex" | "sip";

  constructor(options: AlpacaProviderOptions) {
    this.keyId = options.keyId;
    this.secretKey = options.secretKey;
    this.feed = options.feed ?? "iex";
    this.http = new HttpClient("alpaca", {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: options.timeout,
      ...(options.fetchFn !== undefined ? { fetchFn: options.fetchFn } : {}),
      headers: {
        "APCA-API-KEY-ID": this.keyId,
        "APCA-API-SECRET-KEY": this.secretKey,
      },
    });
  }

  /** Key ID — used by the WS adapter for authentication. */
  get wsApiKey(): string {
    return this.keyId;
  }

  /** Secret key — used by the WS adapter for authentication. */
  get wsApiSecret(): string {
    return this.secretKey;
  }

  async quote(symbols: string[]): Promise<Quote[]> {
    if (symbols.length === 0) return [];
    const data = await this.http.get<AlpacaLatestTradesResponse>(
      "/v2/stocks/trades/latest",
      { params: { symbols: symbols.join(","), feed: this.feed } },
    );
    return symbols.flatMap((sym) => {
      const trade = data.trades[sym];
      if (!trade) return [];
      return [
        {
          symbol: sym,
          name: sym,
          price: trade.p,
          change: 0,
          changePercent: 0,
          open: 0,
          high: 0,
          low: 0,
          close: trade.p,
          previousClose: 0,
          volume: trade.s,
          currency: "USD",
          exchange: trade.x ?? "",
          timestamp: new Date(trade.t),
          provider: this.name,
        } satisfies Quote,
      ];
    });
  }

  async historical(_symbol: string, _options?: HistoricalOptions): Promise<HistoricalBar[]> {
    throw new ProviderError(
      "historical() is not yet supported by AlpacaProvider",
      this.name,
    );
  }

  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}
