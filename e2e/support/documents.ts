import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { createServiceRoleClient } from "@/adapters/supabase/service-role.client";
import { documentsBucket } from "@/adapters/supabase/storage.constants";
import { formatDetails } from "@/domain/document/format";
import type { DocumentType } from "@/domain/document/model";
import { signedInUserId } from "./applications";

/** The keys of every file stored for the user whose session `request` carries. */
export async function storedFileKeys(request: APIRequestContext): Promise<string[]> {
  const userId = await signedInUserId(request);
  const { data, error } = await createServiceRoleClient()
    .storage.from(documentsBucket)
    .list(userId, { limit: 1000 });
  if (error) {
    throw error;
  }
  return data.map((entry) => `${userId}/${entry.name}`);
}

/** Deletes every document and stored file of the user whose session `request` carries. */
export async function removeDocuments(request: APIRequestContext): Promise<void> {
  const userId = await signedInUserId(request);
  const client = createServiceRoleClient();
  const { error } = await client.from("document").delete().eq("user_id", userId);
  if (error) {
    throw error;
  }
  const keys = await storedFileKeys(request);
  if (keys.length > 0) {
    const removed = await client.storage.from(documentsBucket).remove(keys);
    if (removed.error) {
      throw removed.error;
    }
  }
}

/**
 * Stores a document with `versions` PDF versions for the user whose session
 * `request` carries. Its versions name files that were never uploaded: for
 * pages that only show them. Returns its id.
 */
export async function seedDocument(
  request: APIRequestContext,
  { title, type, versions }: { title: string; type: DocumentType; versions: number },
): Promise<string> {
  const userId = await signedInUserId(request);
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("document")
    .insert({ user_id: userId, type, title, language: "en" })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  const inserted = await client.from("document_version").insert(
    Array.from({ length: versions }, (_, index) => ({
      user_id: userId,
      document_id: data.id,
      storage_key: `${userId}/${randomUUID()}`,
      file_name: `${title} ${index + 1}.pdf`,
      media_type: formatDetails.pdf.mediaType,
      size_bytes: 1000 * (index + 1),
      uploaded_at: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
    })),
  );
  if (inserted.error) {
    throw inserted.error;
  }
  return data.id;
}

/** Deletes the documents with these ids, whoever owns them. */
export async function removeDocumentsById(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const { error } = await createServiceRoleClient().from("document").delete().in("id", ids);
  if (error) {
    throw error;
  }
}
