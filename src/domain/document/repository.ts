import type { Document, DocumentDetails, DocumentVersion, NewDocumentVersion } from "./model";
import type { StorageKey } from "./storage";

/**
 * Every method acts only on the given user's documents; another user's
 * document behaves as if it did not exist. Versions are never changed, only
 * added or deleted with their document.
 */
export interface DocumentRepository {
  /** Every document, in no particular order. */
  list(userId: string): Promise<Document[]>;

  find(userId: string, id: string): Promise<Document | null>;

  findVersion(userId: string, versionId: string): Promise<DocumentVersion | null>;

  /** A new document whose first version is `version`. */
  create(userId: string, details: DocumentDetails, version: NewDocumentVersion): Promise<Document>;

  /** Adds a version, which as the newest becomes current. `null` when there is no such document. */
  addVersion(
    userId: string,
    documentId: string,
    version: NewDocumentVersion,
  ): Promise<DocumentVersion | null>;

  /** Whether there was such a document to rename. */
  rename(userId: string, id: string, title: string): Promise<boolean>;

  /**
   * Deletes the document with its versions, and returns the keys of their
   * files, which are not deleted with it. None when there was no such document.
   */
  delete(userId: string, id: string): Promise<StorageKey[]>;
}
