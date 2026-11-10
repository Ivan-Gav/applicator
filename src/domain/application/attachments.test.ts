import { describe, expect, it } from "vitest";
import {
  isAttached,
  sameAttachments,
  withAttached,
  withoutDocument,
  withVersionSent,
} from "./attachments";

const cv = { id: "cv", versions: [{ id: "cv-2" }, { id: "cv-1" }] };
const attachedCv = { documentId: "cv", versionId: "cv-1" };
const attachedLetter = { documentId: "letter", versionId: "letter-1" };

describe("withAttached", () => {
  it("adds the document last, at its current version", () => {
    expect(withAttached([attachedLetter], cv)).toEqual([
      attachedLetter,
      { documentId: "cv", versionId: "cv-2" },
    ]);
  });

  it("attaches a document once: one already attached leaves the list as it is", () => {
    const attached = [attachedCv];

    expect(withAttached(attached, cv)).toBe(attached);
  });

  it("leaves the list as it is for a document without versions", () => {
    expect(withAttached([], { id: "empty", versions: [] })).toEqual([]);
  });
});

describe("withVersionSent", () => {
  it("changes the version on the document's attachment, in the same place", () => {
    expect(withVersionSent([attachedCv, attachedLetter], "cv", "cv-2")).toEqual([
      { documentId: "cv", versionId: "cv-2" },
      attachedLetter,
    ]);
  });
});

describe("withoutDocument", () => {
  it("removes the document's attachment only", () => {
    expect(withoutDocument([attachedCv, attachedLetter], "cv")).toEqual([attachedLetter]);
  });
});

describe("isAttached", () => {
  it("tells whether the document is attached, at any version", () => {
    expect(isAttached([attachedCv], "cv")).toBe(true);
    expect(isAttached([attachedCv], "letter")).toBe(false);
  });
});

describe("sameAttachments", () => {
  it("counts the same versions in the same order as the same", () => {
    expect(sameAttachments([attachedCv, attachedLetter], [{ ...attachedCv }, attachedLetter])).toBe(
      true,
    );
  });

  it("tells apart another version, another order and another length", () => {
    expect(sameAttachments([attachedCv], [{ documentId: "cv", versionId: "cv-2" }])).toBe(false);
    expect(sameAttachments([attachedCv, attachedLetter], [attachedLetter, attachedCv])).toBe(false);
    expect(sameAttachments([attachedCv], [attachedCv, attachedLetter])).toBe(false);
  });
});
