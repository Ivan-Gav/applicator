import { formatDetails, formatOfMediaType } from "@/domain/document/format";
import {
  type Document,
  type DocumentDetails,
  type DocumentVersion,
  documentLanguages,
  documentTypes,
  type NewDocumentVersion,
} from "@/domain/document/model";
import type { Tables, TablesInsert } from "./database.types";

export type DocumentRow = Tables<"document">;
export type DocumentVersionRow = Tables<"document_version">;
export type DocumentVersionInsertRow = TablesInsert<"document_version">;
export type DocumentWithVersionsRow = DocumentRow & { versions: DocumentVersionRow[] };

// The CHECK constraints keep type and media_type in range; a value outside it
// means the schema and the domain have drifted apart. language takes any code,
// so one outside the domain's list means a language was added to the database only.
function oneOf<T extends string>(allowed: readonly T[], value: string, column: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${column} holds unknown value "${value}"`);
  }
  return value as T;
}

export function versionToDomain(row: DocumentVersionRow): DocumentVersion {
  const format = formatOfMediaType(row.media_type);
  if (format === null) {
    throw new Error(`document_version.media_type holds unknown value "${row.media_type}"`);
  }
  return {
    id: row.id,
    documentId: row.document_id,
    fileName: row.file_name,
    format,
    sizeBytes: row.size_bytes,
    label: row.label,
    uploadedAt: new Date(row.uploaded_at),
    storageKey: row.storage_key,
  };
}

const newestFirst = (a: DocumentVersion, b: DocumentVersion) =>
  b.uploadedAt.getTime() - a.uploadedAt.getTime() || b.id.localeCompare(a.id);

export function toDomain(row: DocumentWithVersionsRow): Document {
  return {
    id: row.id,
    type: oneOf(documentTypes, row.type, "document.type"),
    title: row.title,
    language:
      row.language === null ? null : oneOf(documentLanguages, row.language, "document.language"),
    versions: row.versions.map(versionToDomain).sort(newestFirst),
  };
}

/** The row of a version added to an existing document. */
export function toVersionRow(
  userId: string,
  documentId: string,
  version: NewDocumentVersion,
): DocumentVersionInsertRow {
  return {
    user_id: userId,
    document_id: documentId,
    storage_key: version.storageKey,
    file_name: version.fileName,
    media_type: formatDetails[version.format].mediaType,
    size_bytes: version.sizeBytes,
    label: version.label,
  };
}

/** The arguments of create_document; absent values are left out and become null. */
export function toCreateArgs(details: DocumentDetails, version: NewDocumentVersion) {
  return {
    p_type: details.type,
    p_title: details.title,
    p_language: details.language ?? undefined,
    p_storage_key: version.storageKey,
    p_file_name: version.fileName,
    p_media_type: formatDetails[version.format].mediaType,
    p_size_bytes: version.sizeBytes,
    p_label: version.label ?? undefined,
  };
}
