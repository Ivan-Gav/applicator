import type { DocumentFormat } from "./format";
import type { StorageKey } from "./storage";

export const documentTypes = [
  "cv",
  "cover_letter",
  "certificate",
  "diploma",
  "reference",
  "portfolio",
  "other",
] as const;
export type DocumentType = (typeof documentTypes)[number];

/**
 * ISO 639-1 codes a document can be written in, in alphabetical order of their
 * English names: the list sorts languages in this order. The database takes
 * any code; a new language needs only a new entry here.
 */
export const documentLanguages = ["en", "de", "ru"] as const;
export type DocumentLanguage = (typeof documentLanguages)[number];

/** One file of a document. Never changes once stored; a revision is a new version. */
export type DocumentVersion = {
  id: string;
  documentId: string;
  /** The name the file had when it was uploaded; shown, never used to find the file. */
  fileName: string;
  format: DocumentFormat;
  sizeBytes: number;
  /** Free text: "backend-heavy", "DE short". */
  label: string | null;
  uploadedAt: Date;
  storageKey: StorageKey;
};

/** An identity, such as "CV, English", whose content lives in its versions. */
export type Document = {
  id: string;
  type: DocumentType;
  title: string;
  language: DocumentLanguage | null;
  /** Newest first, and the newest is current; never empty. */
  versions: DocumentVersion[];
};

/** What a version is stored with, before it has an id. */
export type NewDocumentVersion = Pick<
  DocumentVersion,
  "fileName" | "format" | "sizeBytes" | "label" | "storageKey"
>;

/** What makes a document what it is, apart from its files. */
export type DocumentDetails = Pick<Document, "type" | "title" | "language">;

// Why an upload was refused.
export const DocumentUploadFailure = {
  // The form's other fields do not describe a document.
  Invalid: "invalid",
  Empty: "empty",
  TooLarge: "too_large",
  // The file's name ends in an extension the allowlist does not hold.
  UnsupportedType: "unsupported_type",
  // The file's content is not what its extension says.
  ContentMismatch: "content_mismatch",
  // The document to add a version to is gone.
  Missing: "missing",
} as const;
export type DocumentUploadFailure =
  (typeof DocumentUploadFailure)[keyof typeof DocumentUploadFailure];

/** What the upload actions return: why the upload was refused, or null once stored. */
export type DocumentUploadOutcome = { failure: DocumentUploadFailure | null };
