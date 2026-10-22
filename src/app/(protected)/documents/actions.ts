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
  type DocumentUploadOutcome,
  DocumentUploadFailure,
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

function refused(failure: DocumentUploadFailure): DocumentUploadOutcome {
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
 * missing file. When the row cannot be stored, the file is removed again.
 */
async function storeVersion(
  storage: DocumentStorage,
  userId: string,
  { file, format }: { file: File; format: DocumentFormat },
  label: string | null,
  storeRow: (version: NewDocumentVersion) => Promise<boolean>,
): Promise<boolean> {
  const storageKey = await storage.save(userId, file, formatDetails[format].mediaType);
  const version = { storageKey, fileName: file.name, format, sizeBytes: file.size, label };
  let rowStored = false;
  try {
    rowStored = await storeRow(version);
  } finally {
    if (!rowStored) {
      await removeFiles(storage, [storageKey]);
    }
  }
  return rowStored;
}

function revalidateDocuments() {
  revalidatePath(routes.documents);
}

/** Stores a new document with the uploaded file as its first version. */
export async function uploadDocument(form: FormData): Promise<DocumentUploadOutcome> {
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
  await storeVersion(storage, user.id, upload, label.data, async (version) => {
    await repository.create(user.id, details.data, version);
    return true;
  });
  revalidateDocuments();
  return stored;
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
    async (version) => (await repository.addVersion(user.id, id.data, version)) !== null,
  );
  revalidateDocuments();
  return added ? stored : refused(DocumentUploadFailure.Missing);
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
 */
export async function deleteDocument(documentId: unknown): Promise<void> {
  const user = await requireUser();
  const id = documentIdSchema.safeParse(documentId);
  if (!id.success) {
    return;
  }
  const [repository, storage] = await Promise.all([
    documentRepositoryForRequest(),
    documentStorageForRequest(),
  ]);
  const keys = await repository.delete(user.id, id.data);
  revalidateDocuments();
  after(() => removeFiles(storage, keys));
}
