import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Document,
  DocumentDetails,
  DocumentVersion,
  NewDocumentVersion,
} from "@/domain/document/model";
import type { DocumentRepository } from "@/domain/document/repository";
import type { StorageKey } from "@/domain/document/storage";
import { createSupabaseServerClient } from "./client";
import type { Database } from "./database.types";
import { toCreateArgs, toDomain, toVersionRow, versionToDomain } from "./document.mapper";

// SQLSTATE foreign_key_violation: the user has no document with that id.
const foreignKeyViolation = "23503";

const documentWithVersions = "*, versions:document_version(*)";

function failure(operation: string, error: { message: string; code?: string }): Error {
  return new Error(`Supabase ${operation} failed: ${error.message}`, { cause: error });
}

/**
 * Queries run with the client's token, so RLS scopes them too; the explicit
 * user filter keeps results identical to implementations without RLS.
 */
export class SupabaseDocumentRepository implements DocumentRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(userId: string): Promise<Document[]> {
    const { data, error } = await this.client
      .from("document")
      .select(documentWithVersions)
      .eq("user_id", userId);
    if (error) {
      throw failure("document list", error);
    }
    return data.map(toDomain);
  }

  async find(userId: string, id: string): Promise<Document | null> {
    const { data, error } = await this.client
      .from("document")
      .select(documentWithVersions)
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw failure("document find", error);
    }
    return data && toDomain(data);
  }

  async findVersion(userId: string, versionId: string): Promise<DocumentVersion | null> {
    const { data, error } = await this.client
      .from("document_version")
      .select()
      .eq("user_id", userId)
      .eq("id", versionId)
      .maybeSingle();
    if (error) {
      throw failure("document version find", error);
    }
    return data && versionToDomain(data);
  }

  async create(
    userId: string,
    details: DocumentDetails,
    version: NewDocumentVersion,
  ): Promise<Document> {
    const { data: id, error } = await this.client.rpc("create_document", {
      p_user_id: userId,
      ...toCreateArgs(details, version),
    });
    if (error) {
      throw failure("document create", error);
    }
    const created = await this.find(userId, id);
    if (!created) {
      throw new Error(`document ${id} is missing right after it was created`);
    }
    return created;
  }

  async addVersion(
    userId: string,
    documentId: string,
    version: NewDocumentVersion,
  ): Promise<DocumentVersion | null> {
    const { data, error } = await this.client
      .from("document_version")
      .insert(toVersionRow(userId, documentId, version))
      .select()
      .single();
    if (error?.code === foreignKeyViolation) {
      return null;
    }
    if (error) {
      throw failure("document version add", error);
    }
    return versionToDomain(data);
  }

  async rename(userId: string, id: string, title: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("document")
      .update({ title })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id");
    if (error) {
      throw failure("document rename", error);
    }
    return data.length > 0;
  }

  async delete(userId: string, id: string): Promise<StorageKey[]> {
    const { data, error } = await this.client.rpc("delete_document", {
      p_user_id: userId,
      p_document_id: id,
    });
    if (error) {
      throw failure("document delete", error);
    }
    return data;
  }
}

/** A repository acting as the user of the current request. */
export async function documentRepositoryForRequest(): Promise<DocumentRepository> {
  return new SupabaseDocumentRepository(await createSupabaseServerClient());
}
