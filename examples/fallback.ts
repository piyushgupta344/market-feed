/**
 * Multi-provider fallback example.
 * If Yahoo Finance is unavailable, the client automatically falls through
 * to Alpha Vantage, then Polygon.io.
 *
 * Run: AV_KEY=your_key POLYGON_KEY=your_key npx tsx examples/fallback.ts
 */
import { MarketFeed, YahooProvider, AlphaVantageProvider, PolygonProvider } from "../src/index.js";

const feed = new MarketFeed({
  providers: [
    // Tried first — no API key needed
    new YahooProvider(),

    // Fallback 1 — requires free Alpha Vantage key
    ...(process.env["AV_KEY"]
      ? [new AlphaVantageProvider({ apiKey: process.env["AV_KEY"] })]
      : []),

    // Fallback 2 — requires free Polygon.io key
    ...(process.env["POLYGON_KEY"]
      ? [new PolygonProvider({ apiKey: process.env["POLYGON_KEY"] })]
      : []),
  ],
  fallback: true,   // auto-try next provider on error
  cache: { ttl: 60 },
});

const quote = await feed.quote("AAPL");
console.log(`${quote.symbol}: $${quote.price.toFixed(2)} — via ${quote.provider}`);
