# CLI

`market-feed` ships a CLI binary that prints live market data directly in the terminal.

## Installation

```bash
npm install -g market-feed
# or run without installing
npx market-feed <command>
```

## Global flags

| Flag | Description |
|------|-------------|
| `--av-key <key>` | Alpha Vantage API key |
| `--polygon-key <key>` | Polygon.io API key |
| `--finnhub-key <key>` | Finnhub API key |
| `--td-key <key>` | Twelve Data API key |
| `--tiingo-key <key>` | Tiingo API key |

When no key flags are provided the CLI uses Yahoo Finance (no key required).

Keys can also be set via environment variables: `AV_KEY`, `POLYGON_KEY`, `FINNHUB_KEY`, `TD_KEY`, `TIINGO_KEY`.

---

## Commands

### `quote`

Print the current quote for one or more symbols.

```bash
market-feed quote AAPL
market-feed quote AAPL MSFT TSLA NVDA
```

**Output**

```
AAPL   $213.49   +1.83%   vol 58 421 300
MSFT   $415.22   +0.74%   vol 21 033 800
TSLA   $172.63   -2.14%   vol 98 772 100
NVDA   $875.40   +3.21%   vol 43 150 000
```

---

### `historical`

Print daily OHLCV bars for a symbol.

```bash
market-feed historical AAPL
market-feed historical AAPL --from 2024-01-01 --to 2024-06-30
market-feed historical AAPL --interval 1wk --limit 52
```

| Flag | Default | Description |
|------|---------|-------------|
| `--from <date>` | 1 year ago | Start date (ISO 8601) |
| `--to <date>` | today | End date (ISO 8601) |
| `--interval <i>` | `1d` | Bar interval: `1d`, `1wk`, `1mo` |
| `--limit <n>` | — | Max bars to print |

**Output**

```
Date         Open     High     Low      Close    Volume
2024-01-02   185.25   185.88   182.18   185.19   79 329 200
2024-01-03   184.22   185.88   183.43   184.25   55 751 900
…
```

---

### `search`

Search for tickers and company names.

```bash
market-feed search "apple"
market-feed search "nvidia" --limit 5
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit <n>` | 10 | Max results |

**Output**

```
AAPL    Apple Inc.                   NASDAQ   Equity
APLE    Apple Hospitality REIT Inc.  NYSE     Equity
…
```

---

### `company`

Print company profile for a symbol.

```bash
market-feed company AAPL
```

**Output**

```
Apple Inc. (AAPL)
Sector:      Technology
Industry:    Consumer Electronics
Employees:   164,000
Market Cap:  $3.30T
Website:     https://www.apple.com
Description: Apple Inc. designs, manufactures, and markets smartphones…
```

---

### `news`

Print recent news headlines for a symbol.

```bash
market-feed news AAPL
market-feed news AAPL --limit 5
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit <n>` | 10 | Max headlines |

**Output**

```
[2024-06-10] Apple unveils AI features at WWDC 2024
             https://…

[2024-06-09] Apple Vision Pro hits 1 million units sold
             https://…
```

---

### `earnings`

Print upcoming or recent earnings dates for a symbol.

```bash
market-feed earnings AAPL
```

**Output**

```
AAPL earnings
  2024-07-30  Q3 2024   EPS est: $1.35   Revenue est: $84.5B
  2024-10-31  Q4 2024   EPS est: $1.60   Revenue est: $94.1B
```

---

### `dividends`

Print dividend history for a symbol.

```bash
market-feed dividends AAPL
market-feed dividends AAPL --limit 8
```

| Flag | Default | Description |
|------|---------|-------------|
| `--limit <n>` | 10 | Max dividend records |

**Output**

```
AAPL dividends
  2024-05-10   $0.25   ex-date 2024-05-10
  2024-02-09   $0.24   ex-date 2024-02-09
  …
```

---

### `splits`

Print stock split history for a symbol.

```bash
market-feed splits AAPL
```

**Output**

```
AAPL splits
  2020-08-31   4:1
  2014-06-09   7:1
  2005-02-28   2:1
```

---

## Examples

**Use Polygon.io for a quote:**

```bash
market-feed quote AAPL --polygon-key $POLYGON_KEY
```

**Fetch historical data with Alpha Vantage:**

```bash
market-feed historical MSFT --av-key $AV_KEY --from 2023-01-01
```

**Search with environment variable keys:**

```bash
export POLYGON_KEY=your_key
market-feed search "tesla"
```

**Pipe output to other tools:**

```bash
market-feed quote AAPL MSFT GOOGL | column -t
```
