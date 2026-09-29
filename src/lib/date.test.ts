import { describe, expect, it } from "vitest";
import { formatDay, isoDay, startOfLocalDay } from "./date";

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
