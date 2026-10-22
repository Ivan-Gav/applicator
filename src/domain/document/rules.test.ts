import { describe, expect, it } from "vitest";
import { aDocument, aVersion } from "@/test/document.fixture";
import { currentVersion, hasVersions, lastUploadedAt, unreferencedFiles } from "./rules";

const first = aVersion({ id: "v1", uploadedAt: new Date("2026-09-01T10:00:00Z") });
const second = aVersion({ id: "v2", uploadedAt: new Date("2026-10-01T10:00:00Z") });

describe("currentVersion and lastUploadedAt", () => {
  it("are the newest version and its upload", () => {
    const document = aDocument({ versions: [second, first] });

    expect(currentVersion(document)).toBe(second);
    expect(lastUploadedAt(document)).toEqual(new Date("2026-10-01T10:00:00Z"));
  });

  it("refuse a document without versions, which cannot exist", () => {
    expect(() => currentVersion(aDocument({ versions: [] }))).toThrow(/no versions/);
  });
});

describe("hasVersions", () => {
  it("is false for a single file without a label, true from a second file or a label on", () => {
    expect(hasVersions(aDocument({ versions: [first] }))).toBe(false);
    expect(hasVersions(aDocument({ versions: [second, first] }))).toBe(true);
    expect(hasVersions(aDocument({ versions: [aVersion({ label: "short" })] }))).toBe(true);
  });
});

describe("unreferencedFiles", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  it("keeps the files no row names that are older than an hour, oldest first", () => {
    const files = [
      { key: "u/referenced", createdAt: hoursAgo(48) },
      { key: "u/orphan-recent", createdAt: hoursAgo(2) },
      { key: "u/orphan-old", createdAt: hoursAgo(30) },
    ];

    expect(unreferencedFiles(files, new Set(["u/referenced"]), now)).toEqual([
      { key: "u/orphan-old", createdAt: hoursAgo(30) },
      { key: "u/orphan-recent", createdAt: hoursAgo(2) },
    ]);
  });

  it("leaves a file younger than an hour, whose row may not be stored yet", () => {
    const files = [
      { key: "u/uploading", createdAt: hoursAgo(0.5) },
      { key: "u/exactly-an-hour", createdAt: hoursAgo(1) },
    ];

    expect(unreferencedFiles(files, new Set(), now).map((file) => file.key)).toEqual([
      "u/exactly-an-hour",
    ]);
  });
});
