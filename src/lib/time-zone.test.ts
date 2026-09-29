import { describe, expect, it } from "vitest";
import { fallbackTimeZone, isTimeZone, resolveTimeZone } from "./time-zone";

describe("resolveTimeZone", () => {
  it.each(["Europe/Berlin", "America/New_York", "UTC"])("keeps the zone %s", (zone) => {
    expect(resolveTimeZone(zone)).toBe(zone);
  });

  it.each([undefined, "", "Mars/Olympus", "<script>", 42])("falls back to UTC for %j", (value) => {
    expect(resolveTimeZone(value)).toBe(fallbackTimeZone);
  });
});

describe("isTimeZone", () => {
  it("accepts an IANA zone and refuses anything else", () => {
    expect(isTimeZone("Europe/Berlin")).toBe(true);
    expect(isTimeZone("Europe/Nowhere")).toBe(false);
  });
});
