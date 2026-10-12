import { describe, expect, it } from "vitest";
import { mostCommonFirst } from "./most-common-first";

describe("mostCommonFirst", () => {
  it("lists each value once, the most frequent first, ties alphabetically", () => {
    expect(mostCommonFirst(["b", "a", "c", "c", "b", "c"])).toEqual(["c", "b", "a"]);
    expect(mostCommonFirst(["b", "a"])).toEqual(["a", "b"]);
  });

  it("leaves out nulls and keeps spellings that differ in case apart", () => {
    expect(mostCommonFirst([null, "LinkedIn", "linkedin", null])).toEqual(["linkedin", "LinkedIn"]);
  });
});
