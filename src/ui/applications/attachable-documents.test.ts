import { describe, expect, it } from "vitest";
import { aDocument, aVersion } from "@/test/document.fixture";
import { messages } from "@/ui/messages";
import { attachableDocuments } from "./attachable-documents";

const t = messages.documents.versions;
const now = new Date("2026-11-08T12:00:00Z");
const open = (id: string) => `/files/${id}?open`;

const cv = aDocument({
  id: "cv",
  title: "CV",
  versions: [
    aVersion({ id: "cv-2", label: "ats", uploadedAt: new Date("2026-10-02T09:00:00Z") }),
    aVersion({ id: "cv-1", uploadedAt: new Date("2025-08-12T09:00:00Z") }),
  ],
});
const letter = aDocument({
  id: "letter",
  type: "cover_letter",
  title: "Letter",
  versions: [aVersion({ id: "letter-1", uploadedAt: new Date("2026-10-20T09:00:00Z") })],
});

describe("attachableDocuments", () => {
  it("lists the newest upload first, each with its versions newest first", () => {
    const [first, second] = attachableDocuments([cv, letter], open, "Europe/Berlin", now);

    expect(first).toEqual({
      id: "letter",
      title: "Letter",
      type: "cover_letter",
      uploadedOn: "20 Oct",
      versions: [
        {
          id: "letter-1",
          name: t.original,
          uploadedOn: "20 Oct 2026",
          open: "/files/letter-1?open",
        },
      ],
      withVersions: false,
    });
    expect(second?.versions.map(({ id, name }) => [id, name])).toEqual([
      ["cv-2", "ats"],
      ["cv-1", t.original],
    ]);
    expect(second?.withVersions).toBe(true);
  });

  it("sends the browser no storage key and no file details", () => {
    const sent = JSON.stringify(attachableDocuments([cv], open, "Europe/Berlin", now));

    expect(sent).not.toContain("storageKey");
    expect(sent).not.toContain(cv.versions[0]?.storageKey);
    expect(sent).not.toContain("cv.pdf");
  });
});
