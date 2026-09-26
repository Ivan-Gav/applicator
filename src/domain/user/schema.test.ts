import { describe, expect, it } from "vitest";
import { emailSchema } from "./schema";

describe("emailSchema", () => {
  it("trims surrounding whitespace before validating", () => {
    expect(emailSchema.parse("  ivan@example.com\n")).toBe("ivan@example.com");
  });

  it("rejects a string that is not an address", () => {
    expect(emailSchema.safeParse("ivan").success).toBe(false);
  });
});
