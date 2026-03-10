/**
 * Basic example — zero-config Yahoo Finance usage.
 * No API key required.
 *
 * Run: npx tsx examples/basic.ts
 */
import { MarketFeed } from "../src/index.js";

const feed = new MarketFeed();

// Single quote
const aapl = await feed.quote("AAPL");
console.log(`${aapl.symbol}: $${aapl.price.toFixed(2)} (${aapl.changePercent > 0 ? "+" : ""}${aapl.changePercent.toFixed(2)}%)`);

// Multiple quotes
const quotes = await feed.quote(["MSFT", "GOOGL", "AMZN"]);
for (const q of quotes) {
  console.log(`${q.symbol}: $${q.price.toFixed(2)}`);
}

// Search
const results = await feed.search("Tesla");
console.log("\nSearch results for 'Tesla':");
for (const r of results.slice(0, 3)) {
  console.log(`  ${r.symbol} — ${r.name} (${r.type})`);
}

// Historical data
const history = await feed.historical("AAPL", {
  period1: "2024-01-01",
  period2: "2024-03-01",
  interval: "1wk",
});
console.log(`\nAAPL weekly bars from Jan–Mar 2024: ${history.length} bars`);
if (history[0]) {
  console.log(`  First bar: ${history[0].date.toDateString()} close=$${history[0].close}`);
}
