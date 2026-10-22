/**
 * SERVICE ROLE: BYPASSES ROW LEVEL SECURITY AND THE STORAGE POLICIES.
 * For scripts/maintenance.mts only (enforced by ESLint); never part of a request.
 */
import type { DocumentStorage, StorageKey } from "@/domain/document/storage";
import { SupabaseDocumentStorage } from "./document.storage";
import { supabaseUrl } from "./env";
import { createServiceRoleClient } from "./service-role.client";

// The most rows or users one call returns.
const pageSize = 1000;

/** The Supabase project the maintenance functions act on. */
export function maintenanceTarget(): string {
  return supabaseUrl();
}

/** Document storage that reaches every user's files. */
export function storageOfAllUsers(): DocumentStorage {
  return new SupabaseDocumentStorage(createServiceRoleClient());
}

/** The id of the user with this email address, or null when there is none. */
export async function findUserId(email: string): Promise<string | null> {
  const { auth } = createServiceRoleClient();
  const wanted = email.trim().toLowerCase();
  for (let page = 1; ; page += 1) {
    const { data, error } = await auth.admin.listUsers({ page, perPage: pageSize });
    if (error) {
      throw error;
    }
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === wanted);
    if (user) {
      return user.id;
    }
    if (data.users.length < pageSize) {
      return null;
    }
  }
}

/** Deletes the user; the database deletes their rows with them, but not their files. */
export async function deleteUser(userId: string): Promise<void> {
  const { error } = await createServiceRoleClient().auth.admin.deleteUser(userId);
  if (error) {
    throw error;
  }
}

/** The storage key of every document version, whoever owns it. */
export async function referencedStorageKeys(): Promise<Set<StorageKey>> {
  const client = createServiceRoleClient();
  const keys = new Set<StorageKey>();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("document_version")
      .select("storage_key")
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) {
      throw error;
    }
    for (const row of data) {
      keys.add(row.storage_key);
    }
    if (data.length < pageSize) {
      return keys;
    }
  }
}
