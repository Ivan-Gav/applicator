import { describe, expect, it } from "vitest";
import { aDocument, aVersion } from "@/test/document.fixture";
import { messages } from "@/ui/messages";
import { documentRowData } from "./document-row-data";

const t = messages.documents.versions;

const original = aVersion({
  id: "v1",
  storageKey: "user-a/key-1",
  fileName: "cv.pdf",
  uploadedAt: new Date("2026-09-01T09:00:00Z"),
});
const revised = aVersion({
  id: "v2",
  storageKey: "user-a/key-2",
  fileName: "cv-ats.pdf",
  label: "ats",
  uploadedAt: new Date("2026-10-01T09:00:00Z"),
});

function rowOf(versions = [revised, original]) {
  return documentRowData(
    aDocument({ id: "d1", title: "CV", type: "cv", language: "de", versions }),
    (id) => `/files/${id}`,
    (id) => `/files/${id}?open`,
  );
}

describe("documentRowData", () => {
  it("keeps what the row shows, with each version's addresses, newest first", () => {
    expect(rowOf()).toEqual({
      title: "CV",
      type: "cv",
      language: "de",
      withVersions: true,
      versions: [
        {
          id: "v2",
          name: "ats",
          fileName: "cv-ats.pdf",
          format: "pdf",
          sizeBytes: revised.sizeBytes,
          uploadedAt: revised.uploadedAt,
          open: "/files/v2?open",
          download: "/files/v2",
        },
        {
          id: "v1",
          name: t.original,
          fileName: "cv.pdf",
          format: "pdf",
          sizeBytes: original.sizeBytes,
          uploadedAt: original.uploadedAt,
          open: "/files/v1?open",
          download: "/files/v1",
        },
      ],
    });
  });

  it("sends the browser no storage key and no document id", () => {
    const sent = JSON.stringify(rowOf());

    expect(sent).not.toContain("user-a/key");
    expect(sent).not.toContain("storageKey");
    expect(sent).not.toContain("d1");
  });

  it("numbers later unlabelled versions, and has none to tell apart for a lone unlabelled file", () => {
    expect(
      rowOf([aVersion({ id: "v2" }), aVersion({ id: "v1" })]).versions.map((v) => v.name),
    ).toEqual([t.numbered(2), t.original]);
    expect(rowOf([original]).withVersions).toBe(false);
  });
});
