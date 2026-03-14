import { ProviderError } from "../../errors.js";
import type { HistoricalBar, HistoricalOptions } from "../../types/historical.js";
import type { MarketProvider } from "../../types/provider.js";
import type { Quote } from "../../types/quote.js";
import type { SearchResult } from "../../types/search.js";

export interface IbTwsProviderOptions {
  /**
   * Hostname of the TWS Gateway or IB Gateway.
   * Default: "localhost"
   */
  host?: string;
  /**
   * Port of the Client Portal API.
   * TWS default: 5000. IB Gateway default: 5001.
   * Default: 5000
   */
  port?: number;
  /**
   * Map from symbol (e.g. "AAPL") to IB contract ID (conid).
   * Required for WebSocket market data subscription.
   *
   * Look up conids via the IB Client Portal REST endpoint:
   * `GET /v1/api/iserver/secdef/search?symbol=AAPL`
   */
  conidMap: Record<string, number>;
  /**
   * Use secure WebSocket (`wss://`) instead of plain (`ws://`).
   * Default: false (plain ws for localhost)
   */
  secure?: boolean;
}

// ---------------------------------------------------------------------------
// IbTwsProvider
// ---------------------------------------------------------------------------

/**
 * Interactive Brokers TWS / IB Gateway WebSocket provider.
 *
 * Connects to a locally running TWS or IB Gateway with the Client Portal API
 * enabled. Provides real-time level I market data (last price, bid, ask,
 * volume) via WebSocket — tick-by-tick trade events from `market-feed/ws`.
 *
 * Prerequisites:
 * - IB TWS or IB Gateway running locally
 * - Client Portal API enabled (Configure → API → Enable Client Portal)
 * - Session authenticated (log in via browser at localhost:5000)
 * - Symbol → conid mapping (obtain from `/iserver/secdef/search`)
 *
 * @see https://interactivebrokers.github.io/cpwebapi/
 *
 * @example
 * ```ts
 * import { IbTwsProvider } from "market-feed";
 * import { connect } from "market-feed/ws";
 *
 * const provider = new IbTwsProvider({
 *   conidMap: { AAPL: 265598, MSFT: 272093, TSLA: 76792991 },
 * });
 *
 * for await (const event of connect(provider, ["AAPL", "MSFT"])) {
 *   if (event.type === "trade") {
 *     console.log(event.trade.symbol, event.trade.price);
 *   }
 * }
 * ```
 */
export class IbTwsProvider implements MarketProvider {
  readonly name = "ibtws";
  readonly host: string;
  readonly port: number;
  readonly conidMap: Readonly<Record<string, number>>;
  readonly secure: boolean;

  constructor(options: IbTwsProviderOptions) {
    this.host = options.host ?? "localhost";
    this.port = options.port ?? 5000;
    this.conidMap = options.conidMap;
    this.secure = options.secure ?? false;
  }

  /** Full WebSocket URL to the TWS Client Portal API endpoint. */
  get wsBaseUrl(): string {
    const scheme = this.secure ? "wss" : "ws";
    return `${scheme}://${this.host}:${this.port}/v1/api/ws`;
  }

  async quote(_symbols: string[]): Promise<Quote[]> {
    throw new ProviderError(
      "IbTwsProvider does not support HTTP polling. Use market-feed/ws connect() for real-time data.",
      this.name,
    );
  }

  async historical(_symbol: string, _options?: HistoricalOptions): Promise<HistoricalBar[]> {
    throw new ProviderError("historical() is not yet supported by IbTwsProvider", this.name);
  }

  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}
