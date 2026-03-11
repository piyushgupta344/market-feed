import { describe, expect, it } from "vitest";
import {
  easterMonday,
  easterSunday,
  getHolidayDates,
  goodFriday,
  lastWeekday,
  nthWeekday,
  observedDate,
  toDateKey,
  utcDate,
} from "../../../src/calendar/holidays.js";

describe("Easter algorithm", () => {
  it("computes Easter Sunday correctly for known years", () => {
    // Known Easter dates
    expect(toDateKey(easterSunday(2024))).toBe("2024-03-31");
    expect(toDateKey(easterSunday(2025))).toBe("2025-04-20");
    expect(toDateKey(easterSunday(2026))).toBe("2026-04-05");
    expect(toDateKey(easterSunday(2019))).toBe("2019-04-21");
  });

  it("computes Good Friday as 2 days before Easter", () => {
    expect(toDateKey(goodFriday(2024))).toBe("2024-03-29");
    expect(toDateKey(goodFriday(2025))).toBe("2025-04-18");
    expect(toDateKey(goodFriday(2026))).toBe("2026-04-03");
  });

  it("computes Easter Monday as 1 day after Easter", () => {
    expect(toDateKey(easterMonday(2024))).toBe("2024-04-01");
    expect(toDateKey(easterMonday(2025))).toBe("2025-04-21");
  });
});

describe("Date utilities", () => {
  it("nthWeekday: 3rd Monday in January 2025", () => {
    // MLK Day 2025
    expect(toDateKey(nthWeekday(2025, 1, 1, 3))).toBe("2025-01-20");
  });

  it("nthWeekday: 4th Thursday in November 2025 (Thanksgiving)", () => {
    expect(toDateKey(nthWeekday(2025, 11, 4, 4))).toBe("2025-11-27");
  });

  it("lastWeekday: last Monday in May 2025 (Memorial Day)", () => {
    expect(toDateKey(lastWeekday(2025, 5, 1))).toBe("2025-05-26");
  });

  it("lastWeekday: last Monday in May 2024 (Memorial Day)", () => {
    expect(toDateKey(lastWeekday(2024, 5, 1))).toBe("2024-05-27");
  });

  it("observedDate: Saturday → Friday", () => {
    // July 4 2026 is a Saturday → observed Friday July 3
    const july4 = utcDate(2026, 7, 4);
    expect(july4.getUTCDay()).toBe(6); // Saturday
    expect(toDateKey(observedDate(july4))).toBe("2026-07-03");
  });

  it("observedDate: Sunday → Monday", () => {
    // July 4 2021 is a Sunday → observed Monday July 5
    const july4 = utcDate(2021, 7, 4);
    expect(july4.getUTCDay()).toBe(0); // Sunday
    expect(toDateKey(observedDate(july4))).toBe("2021-07-05");
  });

  it("observedDate: weekday unchanged", () => {
    const date = utcDate(2025, 7, 4); // Friday
    expect(date.getUTCDay()).toBe(5);
    expect(toDateKey(observedDate(date))).toBe("2025-07-04");
  });
});

describe("NYSE holidays", () => {
  it("returns 10 holidays for 2025", () => {
    const holidays = getHolidayDates("NYSE", 2025);
    expect(holidays).toHaveLength(10);
  });

  it("includes known 2025 NYSE holidays", () => {
    const keys = new Set(getHolidayDates("NYSE", 2025).map(toDateKey));
    expect(keys.has("2025-01-01")).toBe(true); // New Year's Day
    expect(keys.has("2025-01-20")).toBe(true); // MLK Day
    expect(keys.has("2025-02-17")).toBe(true); // Presidents' Day
    expect(keys.has("2025-04-18")).toBe(true); // Good Friday
    expect(keys.has("2025-05-26")).toBe(true); // Memorial Day
    expect(keys.has("2025-06-19")).toBe(true); // Juneteenth
    expect(keys.has("2025-07-04")).toBe(true); // Independence Day
    expect(keys.has("2025-09-01")).toBe(true); // Labor Day
    expect(keys.has("2025-11-27")).toBe(true); // Thanksgiving
    expect(keys.has("2025-12-25")).toBe(true); // Christmas
  });

  it("Juneteenth absent before 2022", () => {
    const keys = new Set(getHolidayDates("NYSE", 2021).map(toDateKey));
    // Juneteenth not observed before 2022
    expect(keys.has("2021-06-18")).toBe(false);
    expect(keys.has("2021-06-19")).toBe(false);
    expect(keys.has("2021-06-21")).toBe(false);
  });

  it("includes 2024 Good Friday (2024-03-29)", () => {
    const keys = new Set(getHolidayDates("NYSE", 2024).map(toDateKey));
    expect(keys.has("2024-03-29")).toBe(true);
  });
});

describe("LSE holidays", () => {
  it("includes Good Friday and Easter Monday", () => {
    const keys = new Set(getHolidayDates("LSE", 2025).map(toDateKey));
    expect(keys.has("2025-04-18")).toBe(true); // Good Friday
    expect(keys.has("2025-04-21")).toBe(true); // Easter Monday
  });

  it("includes Christmas and Boxing Day", () => {
    const keys = new Set(getHolidayDates("LSE", 2025).map(toDateKey));
    expect(keys.has("2025-12-25")).toBe(true);
    expect(keys.has("2025-12-26")).toBe(true);
  });
});
