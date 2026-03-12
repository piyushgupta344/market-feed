# Exchange Calendar

`market-feed/calendar` provides synchronous, offline-capable exchange session and holiday detection. No network calls, no async — works on the edge.

## Supported exchanges

| Exchange | ID | Timezone | Hours |
|----------|----|----------|-------|
| New York Stock Exchange | `NYSE` | America/New_York | 09:30–16:00 |
| NASDAQ | `NASDAQ` | America/New_York | 09:30–16:00 |
| London Stock Exchange | `LSE` | Europe/London | 08:00–16:30 |
| Toronto Stock Exchange | `TSX` | America/Toronto | 09:30–16:00 |
| Australian Securities Exchange | `ASX` | Australia/Sydney | 10:00–16:00 |
| Frankfurt (XETRA) | `XETRA` | Europe/Berlin | 09:00–17:30 |
| National Stock Exchange India | `NSE` | Asia/Kolkata | 09:15–15:30 |
| Bombay Stock Exchange | `BSE` | Asia/Kolkata | 09:15–15:30 |
| Crypto | `CRYPTO` | UTC | 24/7 (no sessions, no holidays) |

## Session check

```ts
import { isMarketOpen, getSession } from "market-feed/calendar";

isMarketOpen("NYSE");  // true | false

getSession("NYSE");    // "pre" | "regular" | "post" | "closed"
```

Sessions:

| Value | NYSE hours (ET) |
|-------|-----------------|
| `"pre"` | 04:00–09:30 |
| `"regular"` | 09:30–16:00 |
| `"post"` | 16:00–20:00 |
| `"closed"` | outside all of the above |

## Next open / close

```ts
import { nextSessionOpen, nextSessionClose } from "market-feed/calendar";

nextSessionOpen("NYSE");   // Date — next regular session open (UTC)
nextSessionClose("NYSE");  // Date — next regular session close (UTC)
```

Both functions skip holidays and weekends, and are DST-correct via `Intl.DateTimeFormat`.

## Holidays

```ts
import { isHoliday, isEarlyClose, getHolidayDates } from "market-feed/calendar";

isHoliday("NYSE");                           // is today a NYSE holiday?
isHoliday("NYSE", new Date("2025-04-18"));   // true — Good Friday 2025
isHoliday("LSE", new Date("2025-12-26"));    // true — Boxing Day

isEarlyClose("NYSE");                        // true on day before Thanksgiving, Christmas Eve

getHolidayDates("NYSE", 2026);              // Date[] — all NYSE holidays in 2026
```

Holiday rules are computed from first principles — Easter via the Meeus/Jones/Butcher algorithm, followed by all NYSE-specific adjustments. No hardcoded date arrays.

## Exchange metadata

```ts
import { getExchangeInfo } from "market-feed/calendar";

const info = getExchangeInfo("LSE");
// {
//   id: "LSE",
//   name: "London Stock Exchange",
//   mic: "XLON",
//   timezone: "Europe/London",
//   openTime: "08:00",
//   closeTime: "16:30",
//   currency: "GBP",
// }
```

## Usage with `market-feed/stream`

The stream module uses the calendar internally when `marketHoursAware: true`. Pass `exchange` to select the right calendar:

```ts
import { watch } from "market-feed/stream";

for await (const event of watch(feed, ["TSLA"], { exchange: "NYSE" })) {
  // pauses when NYSE is closed
}
```
