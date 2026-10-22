import type { Document, DocumentVersion } from "@/domain/document/model";

/** A complete version of a one-page PDF. */
export function aVersion(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: "00000000-0000-4000-8000-0000000000e1",
    documentId: "00000000-0000-4000-8000-0000000000d1",
    fileName: "cv.pdf",
    format: "pdf",
    sizeBytes: 245_760,
    label: null,
    uploadedAt: new Date("2026-09-01T09:00:00Z"),
    storageKey: "00000000-0000-4000-8000-00000000000a/00000000-0000-4000-8000-0000000000f1",
    ...overrides,
  };
}

/** A CV in English with one version. */
export function aDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "00000000-0000-4000-8000-0000000000d1",
    type: "cv",
    title: "CV",
    language: "en",
    versions: [aVersion()],
    ...overrides,
  };
}
