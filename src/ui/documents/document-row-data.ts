import type { DocumentFormat } from "@/domain/document/format";
import type {
  Document,
  DocumentLanguage,
  DocumentType,
  DocumentVersion,
} from "@/domain/document/model";
import { hasVersions } from "@/domain/document/rules";
import { messages } from "@/ui/messages";

/** One version as its row shows it, with where its file is opened and saved from. */
export type DocumentRowVersion = {
  id: string;
  /** Its label, or "Original" or "Version N" without one. */
  name: string;
  fileName: string;
  format: DocumentFormat;
  sizeBytes: number;
  uploadedAt: Date;
  open: string;
  download: string;
};

/**
 * What a document's row needs and nothing more: it goes to the browser, so
 * storage keys and ids the row does not use stay on the server.
 */
export type DocumentRowData = {
  title: string;
  type: DocumentType;
  language: DocumentLanguage | null;
  /** Newest first, as the version select lists them. */
  versions: DocumentRowVersion[];
  /** Whether there are versions to tell apart; without, the row names no version. */
  withVersions: boolean;
};

const t = messages.documents.versions;

// A version's label, or its place counting from the first upload, which is the original.
function versionName(document: Document, version: DocumentVersion): string {
  if (version.label !== null) {
    return version.label;
  }
  const number = document.versions.length - document.versions.indexOf(version);
  return number === 1 ? t.original : t.numbered(number);
}

export function documentRowData(
  document: Document,
  fileHref: (versionId: string) => string,
  fileOpenHref: (versionId: string) => string,
): DocumentRowData {
  return {
    title: document.title,
    type: document.type,
    language: document.language,
    versions: document.versions.map((version) => ({
      id: version.id,
      name: versionName(document, version),
      fileName: version.fileName,
      format: version.format,
      sizeBytes: version.sizeBytes,
      uploadedAt: version.uploadedAt,
      open: fileOpenHref(version.id),
      download: fileHref(version.id),
    })),
    withVersions: hasVersions(document),
  };
}
