import { describe, expect, it } from "vitest";
import { formatFileSize } from "./file-size";

describe("formatFileSize", () => {
  it.each([
    [512, "512 byte"],
    [1024, "1 kB"],
    [245_760, "240 kB"],
    [1_300_000, "1.2 MB"],
    [4 * 1024 * 1024, "4 MB"],
  ])("shows %i bytes as %s", (bytes, shown) => {
    expect(formatFileSize(bytes)).toBe(shown);
  });
});
