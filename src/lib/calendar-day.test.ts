import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dayInZone,
  earlierDay,
  firstOfMonth,
  isCalendarDay,
  laterDay,
  mondayOf,
} from "./calendar-day";

describe("isCalendarDay", () => {
  it("accepts a real day written as YYYY-MM-DD", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
  });

  it.each(["2026-02-29", "2026-13-01", "2026-9-1", "", "1 Sept 2026", null, 20260901])(
    "refuses %s",
    (value) => {
      expect(isCalendarDay(value)).toBe(false);
    },
  );
});

describe("addDays", () => {
  it("moves across month and year ends, both ways", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is not moved by a change to summer time, having no zone", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("mondayOf", () => {
  it("is the day itself on a Monday and the Monday before otherwise", () => {
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
  });

  it("reaches into the previous month and year", () => {
    expect(mondayOf("2026-10-01")).toBe("2026-09-28");
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("firstOfMonth and addMonths", () => {
  it("find the first of this and later months", () => {
    expect(firstOfMonth("2026-11-30")).toBe("2026-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
  });
});

describe("earlierDay and laterDay", () => {
  it("compare days in calendar order", () => {
    expect(earlierDay("2026-10-01", "2026-09-30")).toBe("2026-09-30");
    expect(laterDay("2026-10-01", "2026-09-30")).toBe("2026-10-01");
  });
});

describe("dayInZone", () => {
  it("is the day the instant falls on in the zone", () => {
    const instant = new Date("2026-08-31T22:30:00.000Z");

    expect(dayInZone("UTC")(instant)).toBe("2026-08-31");
    expect(dayInZone("Europe/Berlin")(instant)).toBe("2026-09-01");
    expect(dayInZone("America/Los_Angeles")(instant)).toBe("2026-08-31");
  });
});
