import type { TradingSession } from "../types/market.js";
import { EXCHANGES } from "./data.js";
import { getEarlyCloseDates, getHolidayDates, toDateKey } from "./holidays.js";
import type { ExchangeId, LocalTimeParts } from "./types.js";

// ---------------------------------------------------------------------------
// Intl-based local time helpers (DST-correct, no manual offset math)
// ---------------------------------------------------------------------------

/** Decompose a UTC Date into local time parts for the given IANA timezone. */
export function toLocalParts(date: Date, timezone: string): LocalTimeParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
  });

  const parts = fmt.formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "0";

  // hour12:false can return "24" at midnight in some locales — normalise to 0
  const rawHour = Number.parseInt(get("hour"), 10);
  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number.parseInt(get("minute"), 10),
    second: Number.parseInt(get("second"), 10),
    weekday: get("weekday"),
  };
}

/** Convert "HH:MM" time string to total minutes since midnight */
function timeToMinutes(hhmm: string): number {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number.parseInt(h, 10) * 60 + Number.parseInt(m, 10);
}

/** Returns UTC Date for the given local "HH:MM" on the same calendar day as `localRef` */
function localTimeToUtc(localRef: LocalTimeParts, hhmm: string, timezone: string): Date {
  const [h = "0", m = "0"] = hhmm.split(":");
  // Use the UTC offset from Intl to find the exact UTC time for a given local time
  const offset = getUtcOffsetMinutes(timezone, localRef);
  return new Date(
    Date.UTC(
      localRef.year,
      localRef.month - 1,
      localRef.day,
      Number.parseInt(h, 10),
      Number.parseInt(m, 10),
      0,
    ) -
      offset * 60_000,
  );
}

/** Get UTC offset in minutes for a given timezone at a given local date.
 *  Positive = east of UTC (UTC+X), negative = west. */
function getUtcOffsetMinutes(timezone: string, localRef: LocalTimeParts): number {
  // Create a Date near the local reference time (approximate)
  const approxUtc = new Date(
    Date.UTC(
      localRef.year,
      localRef.month - 1,
      localRef.day,
      localRef.hour,
      localRef.minute,
      localRef.second,
    ),
  );

  // Get what local time Intl reports for this UTC time
  const parts = toLocalParts(approxUtc, timezone);
  const utcMinutes = localRef.hour * 60 + localRef.minute;
  const localMinutes = parts.hour * 60 + parts.minute;

  // Offset = UTC - local  (so UTC = local - offset)
  // Actually: localTime = UTCtime + offset → offset = local - UTC
  return localMinutes - utcMinutes;
}

// ---------------------------------------------------------------------------
// Holiday / early-close cache (per exchange+year, computed on demand)
// ---------------------------------------------------------------------------

const holidayCache = new Map<string, Set<string>>();
const earlyCloseCache = new Map<string, Set<string>>();

function getHolidaySet(exchange: ExchangeId, year: number): Set<string> {
  const key = `${exchange}:${year}`;
  let set = holidayCache.get(key);
  if (!set) {
    set = new Set(getHolidayDates(exchange, year).map(toDateKey));
    holidayCache.set(key, set);
  }
  return set;
}

function getEarlyCloseSet(exchange: ExchangeId, year: number): Set<string> {
  const key = `${exchange}:${year}`;
  let set = earlyCloseCache.get(key);
  if (!set) {
    set = new Set(getEarlyCloseDates(exchange, year).map(toDateKey));
    earlyCloseCache.set(key, set);
  }
  return set;
}

// ---------------------------------------------------------------------------
// Public session API
// ---------------------------------------------------------------------------

/**
 * Returns the current trading session for the given exchange.
 *
 * @param exchange  Exchange identifier
 * @param at        Point in time to check (defaults to now)
 */
export function getSession(exchange: ExchangeId, at: Date = new Date()): TradingSession {
  const info = EXCHANGES[exchange];
  const local = toLocalParts(at, info.timezone);

  // Weekend
  if (local.weekday === "Saturday" || local.weekday === "Sunday") return "closed";

  // Holiday
  const dateKey = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  if (getHolidaySet(exchange, local.year).has(dateKey)) return "closed";

  const nowMinutes = local.hour * 60 + local.minute;
  const open = timeToMinutes(info.openTime);
  const close = timeToMinutes(info.closeTime);
  const preOpen = timeToMinutes(info.preOpenTime);
  const postClose = timeToMinutes(info.postCloseTime);

  // Early close?
  const effectiveClose = getEarlyCloseSet(exchange, local.year).has(dateKey)
    ? timeToMinutes("13:00") // NYSE/NASDAQ early close at 1 PM ET
    : close;

  if (nowMinutes >= open && nowMinutes < effectiveClose) return "regular";
  if (nowMinutes >= preOpen && nowMinutes < open) return "pre";
  if (nowMinutes >= effectiveClose && nowMinutes < postClose) return "post";
  return "closed";
}

/**
 * Whether the primary (regular) session is currently open.
 */
export function isMarketOpen(exchange: ExchangeId, at: Date = new Date()): boolean {
  return getSession(exchange, at) === "regular";
}

/**
 * Whether the given date is an exchange holiday.
 */
export function isHoliday(exchange: ExchangeId, date: Date = new Date()): boolean {
  const info = EXCHANGES[exchange];
  const local = toLocalParts(date, info.timezone);
  const dateKey = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return getHolidaySet(exchange, local.year).has(dateKey);
}

/**
 * Whether today is an early-close day for the exchange.
 */
export function isEarlyClose(exchange: ExchangeId, date: Date = new Date()): boolean {
  const info = EXCHANGES[exchange];
  const local = toLocalParts(date, info.timezone);
  const dateKey = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
  return getEarlyCloseSet(exchange, local.year).has(dateKey);
}

/**
 * Returns the next UTC Date at which the regular session opens.
 * If the market is currently open, returns the open time of the current session.
 */
export function nextSessionOpen(exchange: ExchangeId, from: Date = new Date()): Date {
  const info = EXCHANGES[exchange];

  // Walk day by day (max 10 days) to find next open session
  for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
    const candidate = new Date(from.getTime() + dayOffset * 86_400_000);
    const local = toLocalParts(candidate, info.timezone);

    if (local.weekday === "Saturday" || local.weekday === "Sunday") continue;

    const dateKey = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
    if (getHolidaySet(exchange, local.year).has(dateKey)) continue;

    // This day is a trading day — compute the open time in UTC
    const openUtc = localTimeToUtc(local, info.openTime, info.timezone);

    // If we're already past open today, skip to next day
    if (dayOffset === 0 && from >= openUtc) continue;

    return openUtc;
  }

  // Fallback (shouldn't happen)
  return new Date(from.getTime() + 3 * 86_400_000);
}

/**
 * Returns the next UTC Date at which the regular session closes.
 * If currently in regular session, returns today's close.
 */
export function nextSessionClose(exchange: ExchangeId, from: Date = new Date()): Date {
  const info = EXCHANGES[exchange];

  for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
    const candidate = new Date(from.getTime() + dayOffset * 86_400_000);
    const local = toLocalParts(candidate, info.timezone);

    if (local.weekday === "Saturday" || local.weekday === "Sunday") continue;

    const dateKey = `${String(local.year).padStart(4, "0")}-${String(local.month).padStart(2, "0")}-${String(local.day).padStart(2, "0")}`;
    if (getHolidaySet(exchange, local.year).has(dateKey)) continue;

    const closeTime = getEarlyCloseSet(exchange, local.year).has(dateKey)
      ? "13:00"
      : info.closeTime;

    const closeUtc = localTimeToUtc(local, closeTime, info.timezone);

    if (from < closeUtc) return closeUtc;
  }

  return new Date(from.getTime() + 3 * 86_400_000);
}
