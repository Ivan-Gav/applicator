import { describe, expect, it } from "vitest";
import {
  type DocumentVersionRow,
  type DocumentWithVersionsRow,
  toCreateArgs,
  toDomain,
  toVersionRow,
} from "./document.mapper";

function versionRow(overrides: Partial<DocumentVersionRow> = {}): DocumentVersionRow {
  return {
    id: "00000000-0000-4000-8000-0000000000e1",
    user_id: "00000000-0000-4000-8000-00000000000a",
    document_id: "00000000-0000-4000-8000-0000000000d1",
    storage_key: "00000000-0000-4000-8000-00000000000a/f1",
    file_name: "cv.pdf",
    media_type: "application/pdf",
    size_bytes: 1000,
    label: null,
    uploaded_at: "2026-09-01T09:00:00+00:00",
    ...overrides,
  };
}

function documentRow(overrides: Partial<DocumentWithVersionsRow> = {}): DocumentWithVersionsRow {
  return {
    id: "00000000-0000-4000-8000-0000000000d1",
    user_id: "00000000-0000-4000-8000-00000000000a",
    type: "cover_letter",
    title: "Letter",
    language: "de",
    created_at: "2026-09-01T09:00:00+00:00",
    updated_at: "2026-10-01T09:00:00+00:00",
    versions: [versionRow()],
    ...overrides,
  };
}

describe("toDomain", () => {
  it("maps a document and its versions, newest first, with no storage artifacts", () => {
    const document = toDomain(
      documentRow({
        versions: [
          versionRow(),
          versionRow({
            id: "00000000-0000-4000-8000-0000000000e2",
            storage_key: "00000000-0000-4000-8000-00000000000a/f2",
            file_name: "letter.docx",
            media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            label: "short",
            uploaded_at: "2026-10-01T09:00:00+00:00",
          }),
        ],
      }),
    );

    expect(document).toEqual({
      id: "00000000-0000-4000-8000-0000000000d1",
      type: "cover_letter",
      title: "Letter",
      language: "de",
      versions: [
        {
          id: "00000000-0000-4000-8000-0000000000e2",
          documentId: "00000000-0000-4000-8000-0000000000d1",
          fileName: "letter.docx",
          format: "docx",
          sizeBytes: 1000,
          label: "short",
          uploadedAt: new Date("2026-10-01T09:00:00Z"),
          storageKey: "00000000-0000-4000-8000-00000000000a/f2",
        },
        {
          id: "00000000-0000-4000-8000-0000000000e1",
          documentId: "00000000-0000-4000-8000-0000000000d1",
          fileName: "cv.pdf",
          format: "pdf",
          sizeBytes: 1000,
          label: null,
          uploadedAt: new Date("2026-09-01T09:00:00Z"),
          storageKey: "00000000-0000-4000-8000-00000000000a/f1",
        },
      ],
    });
  });

  it.each([
    ["type", documentRow({ type: "passport" }), /document.type/],
    [
      "language the domain does not offer yet",
      documentRow({ language: "fr" }),
      /document.language/,
    ],
    [
      "media type",
      documentRow({ versions: [versionRow({ media_type: "text/html" })] }),
      /media_type/,
    ],
  ])("refuses an unknown %s", (_, row, message) => {
    expect(() => toDomain(row)).toThrow(message);
  });
});

describe("toVersionRow and toCreateArgs", () => {
  const version = {
    storageKey: "u/k",
    fileName: "scan.jpg",
    format: "jpeg",
    sizeBytes: 5,
    label: null,
  } as const;

  it("store the allowlist's media type", () => {
    expect(toVersionRow("u", "d", version)).toEqual({
      user_id: "u",
      document_id: "d",
      storage_key: "u/k",
      file_name: "scan.jpg",
      media_type: "image/jpeg",
      size_bytes: 5,
      label: null,
    });
  });

  it("leave absent values out of the function call, which stores them as null", () => {
    expect(toCreateArgs({ type: "diploma", title: "MSc", language: null }, version)).toEqual({
      p_type: "diploma",
      p_title: "MSc",
      p_language: undefined,
      p_storage_key: "u/k",
      p_file_name: "scan.jpg",
      p_media_type: "image/jpeg",
      p_size_bytes: 5,
      p_label: undefined,
    });
  });
});
