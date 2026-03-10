/**
 * Portfolio tracker example — a real-world use case.
 * Fetches quotes + company profiles for a portfolio and prints a summary.
 *
 * Run: npx tsx examples/portfolio-tracker.ts
 */
import { MarketFeed } from "../src/index.js";

interface Position {
  symbol: string;
  shares: number;
  costBasis: number; // per share
}

const portfolio: Position[] = [
  { symbol: "AAPL", shares: 10, costBasis: 150.0 },
  { symbol: "MSFT", shares: 5, costBasis: 280.0 },
  { symbol: "GOOGL", shares: 2, costBasis: 130.0 },
  { symbol: "AMZN", shares: 3, costBasis: 170.0 },
];

const feed = new MarketFeed({
  cache: {
    ttl: 60,
    ttlOverrides: { company: 86400 },
  },
});

// Fetch all quotes in a single call (parallel under the hood)
const symbols = portfolio.map((p) => p.symbol);
const quotes = await feed.quote(symbols);

const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

console.log("\n── Portfolio Summary ──────────────────────────────");
console.log(
  `${"Symbol".padEnd(8)} ${"Price".padStart(8)} ${"Change%".padStart(8)} ${"Value".padStart(10)} ${"P&L".padStart(10)} ${"P&L%".padStart(8)}`,
);
console.log("─".repeat(60));

let totalValue = 0;
let totalCost = 0;

for (const position of portfolio) {
  const quote = quoteMap.get(position.symbol);
  if (!quote) continue;

  const currentValue = quote.price * position.shares;
  const cost = position.costBasis * position.shares;
  const pnl = currentValue - cost;
  const pnlPct = ((pnl / cost) * 100);

  totalValue += currentValue;
  totalCost += cost;

  const pnlStr = `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(0)}`;
  const pnlPctStr = `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`;

  console.log(
    `${position.symbol.padEnd(8)} ${`$${quote.price.toFixed(2)}`.padStart(8)} ${`${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%`.padStart(8)} ${`$${currentValue.toFixed(0)}`.padStart(10)} ${pnlStr.padStart(10)} ${pnlPctStr.padStart(8)}`,
  );
}

const totalPnl = totalValue - totalCost;
const totalPnlPct = ((totalPnl / totalCost) * 100);

console.log("─".repeat(60));
console.log(
  `${"TOTAL".padEnd(8)} ${"".padStart(8)} ${"".padStart(8)} ${`$${totalValue.toFixed(0)}`.padStart(10)} ${`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(0)}`.padStart(10)} ${`${totalPnl >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%`.padStart(8)}`,
);
console.log();
