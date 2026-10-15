import { describe, expect, it } from "vitest";
import { formatDay, isoDay, localDay, readDay, startOfLocalDay } from "./date";

// Midnight in Berlin (CEST, UTC+2) on 1 September; still 31 August in New York.
const berlinMidnight = new Date("2026-08-31T22:00:00.000Z");

describe("startOfLocalDay", () => {
  it("is midnight of that day in the runtime's time zone", () => {
    expect(startOfLocalDay("2026-09-01")).toEqual(new Date(2026, 8, 1));
  });

  it.each(["2026-02-30", "2026-13-01", "01.09.2026", "2026-9-1", ""])(
    "refuses %j, which is not a real day",
    (day) => {
      expect(startOfLocalDay(day)).toBeNull();
    },
  );
});

describe("formatDay", () => {
  it("shows the day the instant falls on in the given zone", () => {
    expect(formatDay(berlinMidnight, "Europe/Berlin")).toMatch(/^1 Sept? 2026$/);
    expect(formatDay(berlinMidnight, "America/New_York")).toMatch(/^31 Aug 2026$/);
  });
});

describe("isoDay", () => {
  it("is the day in the given zone as YYYY-MM-DD", () => {
    expect(isoDay(berlinMidnight, "Europe/Berlin")).toBe("2026-09-01");
    expect(isoDay(berlinMidnight, "America/New_York")).toBe("2026-08-31");
    expect(isoDay(berlinMidnight, "UTC")).toBe("2026-08-31");
  });
});

describe("localDay", () => {
  it("is the day of the instant in the runtime's time zone, undoing startOfLocalDay", () => {
    expect(localDay(new Date(2026, 8, 1))).toBe("2026-09-01");
    expect(localDay(new Date(2026, 8, 1, 23, 59))).toBe("2026-09-01");
  });
});

describe("readDay", () => {
  it.each([
    ["2026-09-01", "2026-09-01"],
    ["2026-9-1", "2026-09-01"],
    ["2026/09/01", "2026-09-01"],
    ["2026-09-01T23:30:00+02:00", "2026-09-01"],
    ["01.09.2026", "2026-09-01"],
    ["1. 9. 2026", "2026-09-01"],
    ["13/09/2026", "2026-09-13"],
    ["09/13/2026", "2026-09-13"],
    ["05-05-2026", "2026-05-05"],
    ["1 September 2026", "2026-09-01"],
    ["1. März 2026", "2026-03-01"],
    ["September 1, 2026", "2026-09-01"],
    ["Sept 1st, 2026", "2026-09-01"],
    ["  2026-09-01  ", "2026-09-01"],
  ])("reads %j as %j", (text, day) => {
    expect(readDay(text)).toBe(day);
  });

  it.each([
    ["09/01/2026", "day and month could be either way round"],
    ["2026-02-30", "not a real day"],
    ["31/31/2026", "neither reading is a real day"],
    ["1 Smarch 2026", "no such month"],
    ["01.09.26", "a two-digit year"],
    ["next Tuesday", "no date at all"],
    ["", "nothing"],
  ])("refuses %j: %s", (text) => {
    expect(readDay(text)).toBeNull();
  });
});
