import { DocumentSort, sortDocuments } from "@/domain/document/list";
import type { Document, DocumentType } from "@/domain/document/model";
import { hasVersions, lastUploadedAt } from "@/domain/document/rules";
import { SortDirection } from "@/lib/sort-direction";
import { formatDay, formatShortDay } from "@/lib/date";
import { versionName } from "@/ui/documents/document-row-data";

/** One version as the version menu lists it. */
export type AttachableVersion = {
  id: string;
  /** Its label, or "Original" or "Version N" without one. */
  name: string;
  /** "2 Oct 2026". */
  uploadedOn: string;
  /** Where its file is opened. */
  open: string;
};

/**
 * What the documents panel needs of a document and nothing more: it goes to
 * the browser, so storage keys and file details stay on the server.
 */
export type AttachableDocument = {
  id: string;
  title: string;
  type: DocumentType;
  /** When its newest file was uploaded, short: "28 Sept". */
  uploadedOn: string;
  /** Newest first; the first is current. */
  versions: AttachableVersion[];
  /** Whether there are versions to tell apart; without, the panel names no version. */
  withVersions: boolean;
};

/** The documents to attach, newest upload first, with dates as they fall in `timeZone`. */
export function attachableDocuments(
  documents: readonly Document[],
  fileOpenHref: (versionId: string) => string,
  timeZone: string,
  now: Date,
): AttachableDocument[] {
  return sortDocuments(documents, DocumentSort.Uploaded, SortDirection.Descending).map(
    (document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      uploadedOn: formatShortDay(lastUploadedAt(document), timeZone, now),
      versions: document.versions.map((version) => ({
        id: version.id,
        name: versionName(document, version),
        uploadedOn: formatDay(version.uploadedAt, timeZone),
        open: fileOpenHref(version.id),
      })),
      withVersions: hasVersions(document),
    }),
  );
}
