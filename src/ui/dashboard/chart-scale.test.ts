import { describe, expect, it } from "vitest";
import { mostXLabels, xLabelEvery, yScale, yTicks } from "./chart-scale";

describe("yScale", () => {
  it("tops out at four at the least, so a few applications do not fill the height", () => {
    expect(yScale(0)).toEqual({ step: 1, top: 4 });
    expect(yScale(2)).toEqual({ step: 1, top: 4 });
  });

  it.each([
    [4, { step: 1, top: 4 }],
    [5, { step: 2, top: 6 }],
    [8, { step: 2, top: 8 }],
    [9, { step: 5, top: 10 }],
    [20, { step: 5, top: 20 }],
    [21, { step: 10, top: 30 }],
    [140, { step: 10, top: 140 }],
  ])("steps by 1, 2, 5 or 10: largest %i gives %o", (largest, scale) => {
    expect(yScale(largest)).toEqual(scale);
  });
});

describe("yTicks", () => {
  it("runs from zero to the top", () => {
    expect(yTicks({ step: 2, top: 6 })).toEqual([0, 2, 4, 6]);
  });
});

describe("xLabelEvery", () => {
  it("labels every bucket while they fit", () => {
    expect(xLabelEvery(mostXLabels)).toBe(1);
  });

  it("skips buckets so that no more labels show than fit", () => {
    expect(xLabelEvery(mostXLabels + 1)).toBe(2);
    expect(Math.ceil(365 / xLabelEvery(365))).toBeLessThanOrEqual(mostXLabels);
  });
});
