import { describe, expect, it } from "vitest";
import {
  getSession,
  isEarlyClose,
  isHoliday,
  isMarketOpen,
  nextSessionClose,
  nextSessionOpen,
} from "../../../src/calendar/session.js";

// A known NYSE trading day: 2025-07-07 Monday
// Regular hours: 9:30 AM – 4:00 PM ET (UTC-4 in summer)

describe("getSession / isMarketOpen (NYSE)", () => {
  it("returns 'regular' during market hours on a trading day", () => {
    // 2025-07-07 13:00 UTC = 9:00 AM ET (DST, UTC-4) — actually pre-market
    // 2025-07-07 14:00 UTC = 10:00 AM ET — regular
    const at = new Date("2025-07-07T14:00:00Z");
    expect(getSession("NYSE", at)).toBe("regular");
    expect(isMarketOpen("NYSE", at)).toBe(true);
  });

  it("returns 'pre' in pre-market hours", () => {
    // 2025-07-07 09:00 UTC = 5:00 AM ET (UTC-4) — pre-market (04:00–09:30 ET)
    const at = new Date("2025-07-07T09:00:00Z");
    expect(getSession("NYSE", at)).toBe("pre");
    expect(isMarketOpen("NYSE", at)).toBe(false);
  });

  it("returns 'post' in after-hours", () => {
    // 2025-07-07 21:00 UTC = 5:00 PM ET — post-market (16:00–20:00 ET)
    const at = new Date("2025-07-07T21:00:00Z");
    expect(getSession("NYSE", at)).toBe("post");
  });

  it("returns 'closed' after post-market", () => {
    // 2025-07-07 01:00 UTC = 9:00 PM previous day ET — after 20:00
    // Actually 2025-07-08 02:00 UTC = 10:00 PM ET (still same trading day midnight area)
    const at = new Date("2025-07-08T02:00:00Z");
    expect(getSession("NYSE", at)).toBe("closed");
  });

  it("returns 'closed' on Saturday", () => {
    // 2025-07-05 is a Saturday
    const at = new Date("2025-07-05T14:00:00Z");
    expect(getSession("NYSE", at)).toBe("closed");
    expect(isMarketOpen("NYSE", at)).toBe(false);
  });

  it("returns 'closed' on Sunday", () => {
    const at = new Date("2025-07-06T14:00:00Z");
    expect(getSession("NYSE", at)).toBe("closed");
  });

  it("returns 'closed' on NYSE holiday (Thanksgiving 2025-11-27)", () => {
    // 2025-11-27 14:00 UTC = 9:00 AM ET (UTC-5 in November)
    const at = new Date("2025-11-27T14:00:00Z");
    expect(getSession("NYSE", at)).toBe("closed");
    expect(isMarketOpen("NYSE", at)).toBe(false);
  });

  it("returns 'closed' on New Year's Day 2025-01-01", () => {
    const at = new Date("2025-01-01T15:00:00Z");
    expect(getSession("NYSE", at)).toBe("closed");
  });
});

describe("getSession (LSE)", () => {
  it("returns 'regular' during LSE hours on a trading day", () => {
    // 2025-07-07 09:30 UTC = 10:30 BST (UTC+1) — within 08:00–16:30
    const at = new Date("2025-07-07T09:30:00Z");
    expect(getSession("LSE", at)).toBe("regular");
  });

  it("returns 'closed' outside LSE hours", () => {
    // 2025-07-07 07:00 UTC = 08:00 BST — exactly at open boundary, pre-open
    // 07:50 UTC = pre-open start; 07:00 is before pre-open
    const at = new Date("2025-07-07T06:00:00Z");
    expect(getSession("LSE", at)).toBe("closed");
  });
});

describe("isHoliday", () => {
  it("Good Friday 2025 is a holiday for NYSE", () => {
    // 2025-04-18 is Good Friday
    const at = new Date("2025-04-18T14:00:00Z");
    expect(isHoliday("NYSE", at)).toBe(true);
  });

  it("Regular trading day is not a holiday", () => {
    const at = new Date("2025-07-07T14:00:00Z");
    expect(isHoliday("NYSE", at)).toBe(false);
  });
});

describe("isEarlyClose", () => {
  it("Day before Thanksgiving (2025-11-26) is an early close", () => {
    const at = new Date("2025-11-26T14:00:00Z");
    expect(isEarlyClose("NYSE", at)).toBe(true);
  });

  it("Regular day is not early close", () => {
    const at = new Date("2025-07-07T14:00:00Z");
    expect(isEarlyClose("NYSE", at)).toBe(false);
  });
});

describe("nextSessionOpen", () => {
  it("returns next Monday when called on Friday after close", () => {
    // 2025-07-04 is a Friday AND a holiday (Independence Day)
    // 2025-07-03 Thursday 22:00 UTC = 6 PM ET — after post close
    // next open should be 2025-07-07 Monday
    const from = new Date("2025-07-03T22:00:00Z");
    const next = nextSessionOpen("NYSE", from);
    // Should be Monday 2025-07-07 at 09:30 ET
    const nextLocal = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(next);
    expect(nextLocal).toContain("Monday");
    expect(nextLocal).toContain("09:30");
  });

  it("skips weekend — Saturday returns Monday open", () => {
    // Saturday 2025-07-05 noon UTC
    const from = new Date("2025-07-05T12:00:00Z");
    const next = nextSessionOpen("NYSE", from);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
    }).format(next);
    expect(parts).toBe("Monday");
  });

  it("returns same-day open when called before open time", () => {
    // Monday 2025-07-07 08:00 UTC = 4:00 AM ET — before 9:30 AM open
    const from = new Date("2025-07-07T08:00:00Z");
    const next = nextSessionOpen("NYSE", from);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      month: "2-digit",
      day: "2-digit",
    }).format(next);
    expect(parts).toContain("Monday");
    expect(parts).toContain("07/07");
  });
});

describe("nextSessionClose", () => {
  it("returns today's close when currently in session", () => {
    // Monday 2025-07-07 14:00 UTC = 10:00 AM ET — in regular session
    const from = new Date("2025-07-07T14:00:00Z");
    const close = nextSessionClose("NYSE", from);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(close);
    expect(parts).toBe("16:00");
  });
});
