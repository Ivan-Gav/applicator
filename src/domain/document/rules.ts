import type { Document, DocumentVersion } from "./model";
import type { StorageKey, StoredFile } from "./storage";

/** The newest version: the one a document stands for. */
export function currentVersion(document: Document): DocumentVersion {
  const [newest] = document.versions;
  if (newest === undefined) {
    throw new Error(`document ${document.id} has no versions`);
  }
  return newest;
}

/** When the document's newest file was uploaded. */
export function lastUploadedAt(document: Document): Date {
  return currentVersion(document).uploadedAt;
}

/**
 * Whether the document has versions to tell apart: more than one file, or a
 * labelled one. A single file without a label is just the document.
 */
export function hasVersions(document: Document): boolean {
  return (
    document.versions.length > 1 || document.versions.some((version) => version.label !== null)
  );
}

/**
 * How old a file must be before it may count as unreferenced: an upload
 * stores its file before the row naming it, so a younger file may simply have
 * no row yet.
 */
export const unreferencedFileGracePeriodMs = 60 * 60 * 1000;

/** The files no row names that are older than the grace period at `now`, oldest first. */
export function unreferencedFiles(
  files: readonly StoredFile[],
  referencedKeys: ReadonlySet<StorageKey>,
  now: Date,
): StoredFile[] {
  const youngestRemovable = now.getTime() - unreferencedFileGracePeriodMs;
  return files
    .filter((file) => !referencedKeys.has(file.key))
    .filter((file) => file.createdAt.getTime() <= youngestRemovable)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
