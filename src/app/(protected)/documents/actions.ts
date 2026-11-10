"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { documentStorageForRequest } from "@/adapters/supabase/document.storage";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes } from "@/app/routes";
import {
  checkFileContent,
  type DocumentFormat,
  fileContentCheckBytes,
  formatDetails,
} from "@/domain/document/format";
import {
  DocumentDeleteFailure,
  type DocumentUploadOutcome,
  DocumentUploadFailure,
  type NewDocumentOutcome,
  type NewDocumentVersion,
} from "@/domain/document/model";
import {
  documentDetailsSchema,
  documentFormField,
  documentIdSchema,
  documentTitleSchema,
  versionLabelSchema,
} from "@/domain/document/schema";
import type { DocumentStorage, StorageKey } from "@/domain/document/storage";

const stored: DocumentUploadOutcome = { failure: null };

function refused(failure: DocumentUploadFailure): { failure: DocumentUploadFailure } {
  return { failure };
}

type CheckedFile =
  | { ok: true; file: File; format: DocumentFormat }
  | { ok: false; failure: DocumentUploadFailure };

/** The file of an upload form, if it passes the checks, or why it does not. */
async function checkedFile(entry: FormDataEntryValue | null): Promise<CheckedFile> {
  if (!(entry instanceof File)) {
    return { ok: false, failure: DocumentUploadFailure.Invalid };
  }
  const leadingBytes = new Uint8Array(await entry.slice(0, fileContentCheckBytes).arrayBuffer());
  const check = checkFileContent(entry.name, entry.size, leadingBytes);
  return check.ok ? { ok: true, file: entry, format: check.format } : check;
}

/**
 * Removes files whose rows are gone, trying twice. A file that still fails is
 * left behind for the maintenance script; the rows, which the app shows, are
 * already correct.
 */
async function removeFiles(storage: DocumentStorage, keys: readonly StorageKey[]): Promise<void> {
  try {
    await storage.remove(keys);
  } catch {
    try {
      await storage.remove(keys);
    } catch (error) {
      console.error("Document files left in storage:", keys, error);
    }
  }
}

/**
 * Stores the file, then the row naming it, so that a row never names a
 * missing file. `storeRow` resolves with the id of the document the row went
 * to, or null when there is none; then, or when it fails, the file is removed again.
 */
async function storeVersion(
  storage: DocumentStorage,
  userId: string,
  { file, format }: { file: File; format: DocumentFormat },
  label: string | null,
  storeRow: (version: NewDocumentVersion) => Promise<string | null>,
): Promise<string | null> {
  const storageKey = await storage.save(userId, file, formatDetails[format].mediaType);
  const version = { storageKey, fileName: file.name, format, sizeBytes: file.size, label };
  let documentId: string | null = null;
  try {
    documentId = await storeRow(version);
  } finally {
    if (documentId === null) {
      await removeFiles(storage, [storageKey]);
    }
  }
  return documentId;
}

// The documents list, and every application page, which lists documents to attach.
function revalidateDocuments() {
  revalidatePath(routes.documents);
  revalidatePath(routes.applications, "layout");
}

/** Stores a new document with the uploaded file as its first version, and resolves with its id. */
export async function uploadDocument(form: FormData): Promise<NewDocumentOutcome> {
  const user = await requireUser();
  const f = documentFormField;
  const details = documentDetailsSchema.safeParse({
    type: form.get(f.type),
    title: form.get(f.title),
    language: form.get(f.language),
  });
  const label = versionLabelSchema.safeParse(form.get(f.label));
  if (!details.success || !label.success) {
    return refused(DocumentUploadFailure.Invalid);
  }
  const upload = await checkedFile(form.get(f.file));
  if (!upload.ok) {
    return refused(upload.failure);
  }

  const [repository, storage] = await Promise.all([
    documentRepositoryForRequest(),
    documentStorageForRequest(),
  ]);
  const documentId = await storeVersion(
    storage,
    user.id,
    upload,
    label.data,
    async (version) => (await repository.create(user.id, details.data, version)).id,
  );
  revalidateDocuments();
  return documentId === null
    ? refused(DocumentUploadFailure.Missing)
    : { failure: null, documentId };
}

/** Adds the uploaded file as the newest version of a document, which is then its current one. */
export async function addDocumentVersion(
  documentId: unknown,
  form: FormData,
): Promise<DocumentUploadOutcome> {
  const user = await requireUser();
  const id = documentIdSchema.safeParse(documentId);
  const label = versionLabelSchema.safeParse(form.get(documentFormField.label));
  if (!id.success || !label.success) {
    return refused(DocumentUploadFailure.Invalid);
  }
  const upload = await checkedFile(form.get(documentFormField.file));
  if (!upload.ok) {
    return refused(upload.failure);
  }

  const [repository, storage] = await Promise.all([
    documentRepositoryForRequest(),
    documentStorageForRequest(),
  ]);
  const added = await storeVersion(
    storage,
    user.id,
    upload,
    label.data,
    async (version) => (await repository.addVersion(user.id, id.data, version))?.documentId ?? null,
  );
  revalidateDocuments();
  return added === null ? refused(DocumentUploadFailure.Missing) : stored;
}

/** Whether the title was valid and the document still there to take it. */
export async function renameDocument(documentId: unknown, title: unknown): Promise<boolean> {
  const user = await requireUser();
  const id = documentIdSchema.safeParse(documentId);
  const parsed = documentTitleSchema.safeParse(title);
  if (!id.success || !parsed.success) {
    return false;
  }
  const repository = await documentRepositoryForRequest();
  const renamed = await repository.rename(user.id, id.data, parsed.data);
  revalidateDocuments();
  return renamed;
}

/**
 * Deletes the rows first, then the files. A failure between the two leaves a
 * file no row names, never a row naming a missing file. The files go after
 * the response: once the rows are gone, the deletion is done for the user.
 * Resolves with why nothing was deleted, or null.
 */
export async function deleteDocument(documentId: unknown): Promise<DocumentDeleteFailure | null> {
  const user = await requireUser();
  const id = documentIdSchema.safeParse(documentId);
  if (!id.success) {
    return null;
  }
  const [repository, storage] = await Promise.all([
    documentRepositoryForRequest(),
    documentStorageForRequest(),
  ]);
  const keys = await repository.delete(user.id, id.data);
  revalidateDocuments();
  if (keys === null) {
    return DocumentDeleteFailure.InUse;
  }
  after(() => removeFiles(storage, keys));
  return null;
}
