import { randomUUID } from "node:crypto";
import type {
  Document,
  DocumentDetails,
  DocumentVersion,
  NewDocumentVersion,
} from "@/domain/document/model";
import type { DocumentRepository } from "@/domain/document/repository";
import type { StorageKey } from "@/domain/document/storage";

type Stored = { userId: string; document: Document };

/** DocumentRepository over an array, for tests that need no database. */
export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly stored: Stored[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  list(userId: string): Promise<Document[]> {
    return Promise.resolve(
      this.stored
        .filter((entry) => entry.userId === userId)
        .map((entry) => structuredClone(entry.document)),
    );
  }

  find(userId: string, id: string): Promise<Document | null> {
    const entry = this.entry(userId, id);
    return Promise.resolve(entry ? structuredClone(entry.document) : null);
  }

  findVersion(userId: string, versionId: string): Promise<DocumentVersion | null> {
    const version = this.stored
      .filter((entry) => entry.userId === userId)
      .flatMap((entry) => entry.document.versions)
      .find((candidate) => candidate.id === versionId);
    return Promise.resolve(version ? structuredClone(version) : null);
  }

  create(userId: string, details: DocumentDetails, version: NewDocumentVersion): Promise<Document> {
    const id = randomUUID();
    const document: Document = { ...details, id, versions: [this.version(id, version)] };
    this.stored.push({ userId, document });
    return Promise.resolve(structuredClone(document));
  }

  addVersion(
    userId: string,
    documentId: string,
    version: NewDocumentVersion,
  ): Promise<DocumentVersion | null> {
    const entry = this.entry(userId, documentId);
    if (!entry) {
      return Promise.resolve(null);
    }
    const added = this.version(documentId, version);
    entry.document = { ...entry.document, versions: [added, ...entry.document.versions] };
    return Promise.resolve(structuredClone(added));
  }

  rename(userId: string, id: string, title: string): Promise<boolean> {
    const entry = this.entry(userId, id);
    if (entry) {
      entry.document = { ...entry.document, title };
    }
    return Promise.resolve(entry !== undefined);
  }

  delete(userId: string, id: string): Promise<StorageKey[]> {
    const entry = this.entry(userId, id);
    if (!entry) {
      return Promise.resolve([]);
    }
    this.stored.splice(this.stored.indexOf(entry), 1);
    return Promise.resolve(entry.document.versions.map((version) => version.storageKey));
  }

  /** Every stored document with its owner, for assertions on what was written. */
  all(): Stored[] {
    return structuredClone(this.stored);
  }

  private entry(userId: string, id: string): Stored | undefined {
    return this.stored.find((entry) => entry.userId === userId && entry.document.id === id);
  }

  private version(documentId: string, version: NewDocumentVersion): DocumentVersion {
    return { ...version, id: randomUUID(), documentId, uploadedAt: this.now() };
  }
}
