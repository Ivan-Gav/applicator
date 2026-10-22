import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DocumentStorage,
  type FileDelivery,
  FileDeliveryKind,
  FileDisposition,
  type FileDownload,
  type StorageKey,
  type StoredFile,
} from "@/domain/document/storage";
import { createSupabaseServerClient } from "./client";
import type { Database } from "./database.types";
import { documentsBucket } from "./storage.constants";

// Long enough for the browser to follow the redirect, short enough that a
// leaked address is soon useless.
const signedUrlLifetimeSeconds = 60;

type Bucket = ReturnType<SupabaseClient<Database>["storage"]["from"]>;
// A file or a folder, as list() returns it.
type FileObject = NonNullable<Awaited<ReturnType<Bucket["list"]>>["data"]>[number];

// The most entries one list call returns.
const listPageSize = 1000;

function failure(operation: string, error: { message: string }): Error {
  return new Error(`Supabase Storage ${operation} failed: ${error.message}`, { cause: error });
}

// list() returns folders as entries without an id.
function isFile(entry: FileObject): boolean {
  return entry.id !== null;
}

function storedFile(key: StorageKey, entry: FileObject): StoredFile {
  return { key, createdAt: new Date(entry.created_at ?? 0) };
}

/**
 * Files live in the documents bucket under `<owner id>/<random id>`: the
 * storage policies let a user reach the folder named by their id only.
 */
export class SupabaseDocumentStorage implements DocumentStorage {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private get bucket() {
    return this.client.storage.from(documentsBucket);
  }

  async save(ownerId: string, file: Blob, mediaType: string): Promise<StorageKey> {
    const key = `${ownerId}/${randomUUID()}`;
    // As bytes: given a Blob, the SDK stores the Blob's own type and ignores contentType.
    const { error } = await this.bucket.upload(key, await file.arrayBuffer(), {
      contentType: mediaType,
      upsert: false,
    });
    if (error) {
      throw failure("upload", error);
    }
    return key;
  }

  /**
   * A file to save is a redirect to a signed link, which names it. A file to
   * show is downloaded and handed over: a signed link without `download`
   * shows it, but under its key instead of its name.
   */
  async deliver(key: StorageKey, download: FileDownload): Promise<FileDelivery> {
    if (download.disposition === FileDisposition.Inline) {
      const { data, error } = await this.bucket.download(key);
      if (error) {
        throw failure("download", error);
      }
      return { kind: FileDeliveryKind.Content, body: data };
    }
    const { data, error } = await this.bucket.createSignedUrl(key, signedUrlLifetimeSeconds, {
      download: download.fileName,
    });
    if (error) {
      throw failure("signed URL", error);
    }
    return { kind: FileDeliveryKind.Redirect, url: data.signedUrl };
  }

  async remove(keys: readonly StorageKey[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const { error } = await this.bucket.remove([...keys]);
    if (error) {
      throw failure("remove", error);
    }
  }

  async listOwnedBy(ownerId: string): Promise<StoredFile[]> {
    const entries = await this.listFolder(ownerId);
    return entries.filter(isFile).map((entry) => storedFile(`${ownerId}/${entry.name}`, entry));
  }

  async listAll(): Promise<StoredFile[]> {
    const root = await this.listFolder("");
    const atRoot = root.filter(isFile).map((entry) => storedFile(entry.name, entry));
    const inFolders = await Promise.all(
      root.filter((entry) => !isFile(entry)).map((folder) => this.listOwnedBy(folder.name)),
    );
    return [...atRoot, ...inFolders.flat()];
  }

  private async listFolder(folder: string): Promise<FileObject[]> {
    const entries: FileObject[] = [];
    for (let offset = 0; ; offset += listPageSize) {
      const { data, error } = await this.bucket.list(folder, {
        limit: listPageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw failure("list", error);
      }
      entries.push(...data);
      if (data.length < listPageSize) {
        return entries;
      }
    }
  }
}

/** Storage acting as the user of the current request: it reaches their files only. */
export async function documentStorageForRequest(): Promise<DocumentStorage> {
  return new SupabaseDocumentStorage(await createSupabaseServerClient());
}
