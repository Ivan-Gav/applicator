import { describe, expect, it } from "vitest";
import { normalizeForSearch } from "./normalize-for-search";

describe("normalizeForSearch", () => {
  it.each([
    ["München", "munchen"],
    ["ZÜRICH", "zurich"],
    ["Weißenfels", "weissenfels"],
    ["Kraków", "krakow"],
    ["Łódź", "lodz"],
    ["Tromsø", "tromso"],
    ["İstanbul", "istanbul"],
    ["Кёльн", "кельн"],
    ["МЮНХЕН", "мюнхен"],
  ])("normalizes %j to %j", (text, normalized) => {
    expect(normalizeForSearch(text)).toBe(normalized);
  });

  it("turns punctuation and runs of spaces into one space, and trims", () => {
    expect(normalizeForSearch("  Neustadt a.d.  Weinstraße ")).toBe("neustadt a d weinstrasse");
    expect(normalizeForSearch("Frankfurt (Oder)")).toBe("frankfurt oder");
    expect(normalizeForSearch("Saint-Étienne")).toBe("saint etienne");
  });
});
