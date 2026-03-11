import type { ExchangeId } from "./types.js";

// ---------------------------------------------------------------------------
// Generic date helpers
// ---------------------------------------------------------------------------

/** Returns a UTC Date for a given year/month/day (1-based month). */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Given a date that might fall on a weekend, return the nearest weekday:
 * Saturday → Friday, Sunday → Monday.
 */
export function observedDate(date: Date): Date {
  const dow = date.getUTCDay(); // 0=Sun, 6=Sat
  if (dow === 6) return new Date(date.getTime() - 86_400_000); // Sat → Fri
  if (dow === 0) return new Date(date.getTime() + 86_400_000); // Sun → Mon
  return date;
}

/** Nth weekday in a given month/year. weekday: 0=Sun … 6=Sat */
export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = utcDate(year, month, 1);
  const firstDow = first.getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return utcDate(year, month, day);
}

/** Last occurrence of a weekday in a given month/year. weekday: 0=Sun … 6=Sat */
export function lastWeekday(year: number, month: number, weekday: number): Date {
  // Start from the last day of the month and walk back
  const lastDay = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  const lastDow = lastDay.getUTCDay();
  const offset = (lastDow - weekday + 7) % 7;
  return new Date(lastDay.getTime() - offset * 86_400_000);
}

/**
 * Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm.
 * Returns a UTC Date.
 */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

/** Good Friday: 2 days before Easter */
export function goodFriday(year: number): Date {
  return new Date(easterSunday(year).getTime() - 2 * 86_400_000);
}

/** Easter Monday: 1 day after Easter */
export function easterMonday(year: number): Date {
  return new Date(easterSunday(year).getTime() + 86_400_000);
}

// ---------------------------------------------------------------------------
// NYSE / NASDAQ holidays
// ---------------------------------------------------------------------------

function nyseHolidays(year: number): Date[] {
  const holidays: Date[] = [
    observedDate(utcDate(year, 1, 1)), // New Year's Day
    nthWeekday(year, 1, 1, 3), // MLK Day: 3rd Monday Jan
    nthWeekday(year, 2, 1, 3), // Presidents' Day: 3rd Monday Feb
    goodFriday(year), // Good Friday
    lastWeekday(year, 5, 1), // Memorial Day: last Monday May
    observedDate(utcDate(year, 6, 19)), // Juneteenth (from 2022)
    observedDate(utcDate(year, 7, 4)), // Independence Day
    nthWeekday(year, 9, 1, 1), // Labor Day: 1st Monday Sep
    nthWeekday(year, 11, 4, 4), // Thanksgiving: 4th Thursday Nov
    observedDate(utcDate(year, 12, 25)), // Christmas
  ];

  // Juneteenth was added in 2022
  return year >= 2022
    ? holidays
    : holidays.filter((d) => {
        const m = d.getUTCMonth() + 1;
        const day = d.getUTCDate();
        return !(m === 6 && (day === 18 || day === 19 || day === 20));
      });
}

/** NYSE/NASDAQ early-close days (1:00 PM ET):
 * - July 3rd when July 4th is a weekday (or Friday before Independence Day weekend)
 * - Day before Thanksgiving
 * - Christmas Eve when Dec 25 is observed on a weekday
 */
function nyseEarlyCloses(year: number): Date[] {
  const earlyCloses: Date[] = [];

  // Day before Thanksgiving (4th Thursday Nov → day before = Wednesday)
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  earlyCloses.push(new Date(thanksgiving.getTime() - 86_400_000));

  // Independence Day early close handling
  const jul4 = utcDate(year, 7, 4);
  const jul4Dow = jul4.getUTCDay();
  if (jul4Dow === 0) {
    // Jul 4 is Sunday → observed Monday Jul 5, early close Friday Jul 3
    earlyCloses.push(utcDate(year, 7, 3));
  } else if (jul4Dow !== 6) {
    // Jul 4 is a weekday → early close day before (Jul 3)
    earlyCloses.push(utcDate(year, 7, 3));
  }

  // Christmas Eve
  const dec25 = utcDate(year, 12, 25);
  const dec25Dow = dec25.getUTCDay();
  if (dec25Dow === 0) {
    // Dec 25 Sunday → observed Monday Dec 26; Christmas Eve (Dec 24) is Friday → early close
    earlyCloses.push(utcDate(year, 12, 24));
  } else if (dec25Dow !== 6 && dec25Dow !== 1) {
    // Dec 25 is a normal weekday (not Mon/Sat/Sun) → Dec 24 is early close
    earlyCloses.push(utcDate(year, 12, 24));
  }

  return earlyCloses;
}

// ---------------------------------------------------------------------------
// LSE holidays (UK bank holidays)
// ---------------------------------------------------------------------------

function lseHolidays(year: number): Date[] {
  return [
    observedDate(utcDate(year, 1, 1)), // New Year's Day
    goodFriday(year), // Good Friday
    easterMonday(year), // Easter Monday
    nthWeekday(year, 5, 1, 1), // Early May Bank Holiday: 1st Monday May
    lastWeekday(year, 5, 1), // Spring Bank Holiday: last Monday May
    lastWeekday(year, 8, 1), // Summer Bank Holiday: last Monday Aug
    observedDate(utcDate(year, 12, 25)), // Christmas Day
    observedDate(utcDate(year, 12, 26)), // Boxing Day
  ];
}

// ---------------------------------------------------------------------------
// TSX holidays (Canadian federal)
// ---------------------------------------------------------------------------

function tsxHolidays(year: number): Date[] {
  return [
    observedDate(utcDate(year, 1, 1)), // New Year's Day
    nthWeekday(year, 2, 1, 3), // Family Day: 3rd Monday Feb (Ontario)
    goodFriday(year), // Good Friday
    lastWeekday(year, 5, 1), // Victoria Day: last Monday before May 25
    observedDate(utcDate(year, 7, 1)), // Canada Day
    nthWeekday(year, 8, 1, 1), // Civic Holiday: 1st Monday Aug
    nthWeekday(year, 9, 1, 1), // Labour Day: 1st Monday Sep
    nthWeekday(year, 10, 1, 2), // Thanksgiving: 2nd Monday Oct
    observedDate(utcDate(year, 12, 25)), // Christmas
    observedDate(utcDate(year, 12, 26)), // Boxing Day
  ];
}

// ---------------------------------------------------------------------------
// ASX holidays (Australian)
// ---------------------------------------------------------------------------

function asxHolidays(year: number): Date[] {
  return [
    observedDate(utcDate(year, 1, 1)), // New Year's Day
    observedDate(utcDate(year, 1, 26)), // Australia Day
    goodFriday(year), // Good Friday
    easterMonday(year), // Easter Monday
    nthWeekday(year, 4, 1, 2), // Easter Saturday (Sat) — actually Mon after if needed
    observedDate(utcDate(year, 4, 25)), // ANZAC Day
    nthWeekday(year, 6, 1, 2), // Queen's Birthday: 2nd Monday Jun (NSW)
    nthWeekday(year, 8, 1, 1), // Bank Holiday: 1st Monday Aug
    nthWeekday(year, 10, 1, 1), // Labour Day: 1st Monday Oct (NSW)
    observedDate(utcDate(year, 12, 25)), // Christmas
    observedDate(utcDate(year, 12, 26)), // Boxing Day
  ];
}

// ---------------------------------------------------------------------------
// XETRA holidays (Germany)
// ---------------------------------------------------------------------------

function xetraHolidays(year: number): Date[] {
  return [
    utcDate(year, 1, 1), // New Year's Day
    goodFriday(year), // Good Friday
    easterMonday(year), // Easter Monday
    nthWeekday(year, 5, 1, 1), // Labour Day: May 1
    utcDate(year, 5, 1), // Tag der Arbeit
    observedDate(utcDate(year, 10, 3)), // German Unity Day
    utcDate(year, 12, 24), // Christmas Eve (early close / closed)
    utcDate(year, 12, 25), // Christmas Day 1
    utcDate(year, 12, 26), // Christmas Day 2
    utcDate(year, 12, 31), // New Year's Eve (early close)
  ];
}

// ---------------------------------------------------------------------------
// NSE / BSE holidays (India)
// ---------------------------------------------------------------------------

// India has many regional/religious holidays that vary year to year.
// We include the fixed-rule ones; others are published by exchanges each year.
function nseHolidays(year: number): Date[] {
  return [
    observedDate(utcDate(year, 1, 26)), // Republic Day
    goodFriday(year), // Good Friday
    observedDate(utcDate(year, 4, 14)), // Dr. Ambedkar Jayanti / Baisakhi
    observedDate(utcDate(year, 5, 1)), // Maharashtra Day
    observedDate(utcDate(year, 8, 15)), // Independence Day
    observedDate(utcDate(year, 10, 2)), // Gandhi Jayanti
    observedDate(utcDate(year, 11, 1)), // Diwali Laxmi Pujan (approximate; varies)
    observedDate(utcDate(year, 12, 25)), // Christmas
  ];
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

/** Returns all market holidays for a given exchange and year as UTC Dates. */
export function getHolidayDates(exchange: ExchangeId, year: number): Date[] {
  switch (exchange) {
    case "NYSE":
    case "NASDAQ":
      return nyseHolidays(year);
    case "LSE":
      return lseHolidays(year);
    case "TSX":
      return tsxHolidays(year);
    case "ASX":
      return asxHolidays(year);
    case "XETRA":
      return xetraHolidays(year);
    case "NSE":
    case "BSE":
      return nseHolidays(year);
  }
}

/** Returns early-close dates for a given exchange and year.
 *  Currently only NYSE/NASDAQ have well-known early-close rules. */
export function getEarlyCloseDates(exchange: ExchangeId, year: number): Date[] {
  switch (exchange) {
    case "NYSE":
    case "NASDAQ":
      return nyseEarlyCloses(year);
    default:
      return [];
  }
}

/** Format a Date as "YYYY-MM-DD" (UTC) for fast set lookups */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
