import { randomUUID } from "node:crypto";
import {
  type DocumentStorage,
  type FileDelivery,
  FileDeliveryKind,
  type StorageKey,
  type StoredFile,
} from "@/domain/document/storage";

type Stored = { ownerId: string; file: Blob; mediaType: string; createdAt: Date };

/** DocumentStorage over a map, for tests that need no storage service. Delivers the bytes. */
export class InMemoryDocumentStorage implements DocumentStorage {
  private readonly files = new Map<StorageKey, Stored>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  save(ownerId: string, file: Blob, mediaType: string): Promise<StorageKey> {
    const key = `${ownerId}/${randomUUID()}`;
    this.files.set(key, { ownerId, file, mediaType, createdAt: this.now() });
    return Promise.resolve(key);
  }

  deliver(key: StorageKey): Promise<FileDelivery> {
    const stored = this.files.get(key);
    if (!stored) {
      return Promise.reject(new Error(`no file under ${key}`));
    }
    return Promise.resolve({ kind: FileDeliveryKind.Content, body: stored.file });
  }

  remove(keys: readonly StorageKey[]): Promise<void> {
    for (const key of keys) {
      this.files.delete(key);
    }
    return Promise.resolve();
  }

  listOwnedBy(ownerId: string): Promise<StoredFile[]> {
    return Promise.resolve(
      this.storedFiles().filter((file) => this.files.get(file.key)?.ownerId === ownerId),
    );
  }

  listAll(): Promise<StoredFile[]> {
    return Promise.resolve(this.storedFiles());
  }

  /** The keys of every stored file, for assertions on what was written. */
  keys(): StorageKey[] {
    return [...this.files.keys()];
  }

  /** The stored file and its media type, for assertions on what was written. */
  get(key: StorageKey): { file: Blob; mediaType: string } | undefined {
    return this.files.get(key);
  }

  private storedFiles(): StoredFile[] {
    return [...this.files].map(([key, stored]) => ({ key, createdAt: stored.createdAt }));
  }
}
