import { describe, expect, it } from "vitest";
import { roundedMedian } from "./median";

describe("roundedMedian", () => {
  it("is the middle value of an odd count, in any order", () => {
    expect(roundedMedian([9, 1, 4])).toBe(4);
  });

  it("is the mean of the middle two of an even count, rounded", () => {
    expect(roundedMedian([1, 2, 4, 10])).toBe(3);
    expect(roundedMedian([2, 5])).toBe(4);
    expect(roundedMedian([4, 4])).toBe(4);
  });

  it("sorts by value, not as text", () => {
    expect(roundedMedian([10, 9, 100])).toBe(10);
  });

  it("is null for no values", () => {
    expect(roundedMedian([])).toBeNull();
  });

  it("leaves its input as it was", () => {
    const values = [3, 1, 2];
    roundedMedian(values);

    expect(values).toEqual([3, 1, 2]);
  });
});
