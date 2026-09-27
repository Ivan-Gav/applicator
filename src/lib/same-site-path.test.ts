import { describe, expect, it } from "vitest";
import { sameSitePath } from "./same-site-path";

describe("sameSitePath", () => {
  it.each([
    "/",
    "/applications",
    "/applications/42",
    "/applications?status=rejected&sort=date",
    "/applications#notes",
    "/sign-in?redirectTo=%2Fapplications",
    "/documents/cv%20final.pdf",
  ])("accepts the same-site path %j", (path) => {
    expect(sameSitePath(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["protocol-relative with a path", "//evil.com/applications"],
    ["protocol-relative with three slashes", "///evil.com"],
    ["absolute URL", "https://evil.com"],
    ["absolute URL on this path", "https://evil.com/applications"],
    ["backslash after the slash", "/\\evil.com"],
    ["two backslashes", "\\\\evil.com"],
    ["tab inside the leading slashes", "/\t/evil.com"],
    ["newline inside the leading slashes", "/\n/evil.com"],
    ["encoded slashes", "%2F%2Fevil.com"],
    ["encoded second slash", "/%2Fevil.com"],
    ["encoded backslash", "/%5Cevil.com"],
    ["malformed encoding", "/applications%E0%A4%A"],
    ["javascript: URL", "javascript:alert(1)"],
    ["data: URL", "data:text/html,<script>alert(1)</script>"],
    ["relative path", "applications"],
    ["leading space", " /applications"],
    ["empty string", ""],
  ])("refuses a %s", (_, value) => {
    expect(sameSitePath(value)).toBeNull();
  });

  it.each([null, undefined, 42, ["/applications"], { path: "/applications" }])(
    "refuses the non-string %j",
    (value) => {
      expect(sameSitePath(value)).toBeNull();
    },
  );
});
