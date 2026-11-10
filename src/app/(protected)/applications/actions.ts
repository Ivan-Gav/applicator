"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import type { ZodError } from "zod";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes } from "@/app/routes";
import { StatusChangeFailure } from "@/domain/application/model";
import { statusTransition } from "@/domain/application/rules";
import {
  type ApplicationField,
  type ApplicationRejection,
  applicationIdSchema,
  attachedVersionIdsSchema,
  createApplicationSchema,
  invalidApplicationFields,
  statusChangeSchema,
  updateApplicationSchema,
} from "@/domain/application/schema";

// The list and every application page below it, and the documents list,
// which names the applications its documents are attached to.
function revalidateApplications() {
  revalidatePath(routes.applications, "layout");
  revalidatePath(routes.documents);
}

const attachmentsRefused: ApplicationRejection = { invalidFields: ["attachments"] };

// What a submission was rejected on: the fields that failed to parse, then the attachments.
function rejectedFields(
  fieldsError: ZodError | undefined,
  attachmentsValid: boolean,
): ApplicationField[] {
  return [
    ...(fieldsError ? invalidApplicationFields(fieldsError) : []),
    ...(attachmentsValid ? [] : (["attachments"] as const)),
  ];
}

/**
 * Stores a new application for the signed-in user with `attachedVersionIds`
 * attached, then redirects to the list: on success it never returns. It
 * returns only when the input is rejected; refused attachments store nothing.
 */
export async function createApplication(
  input: unknown,
  attachedVersionIds: unknown = [],
): Promise<ApplicationRejection> {
  const user = await requireUser();
  const parsed = createApplicationSchema.safeParse(input);
  const attached = attachedVersionIdsSchema.safeParse(attachedVersionIds);
  if (!parsed.success || !attached.success) {
    return { invalidFields: rejectedFields(parsed.error, attached.success) };
  }
  const repository = await applicationRepositoryForRequest();
  const created = await repository.create(user.id, parsed.data);
  // Without its attachments the application is not what was submitted.
  let stored = false;
  try {
    stored = await repository.replaceAttachedVersions(user.id, created.id, attached.data);
  } finally {
    if (!stored) {
      await repository.delete(user.id, created.id);
    }
  }
  if (!stored) {
    return attachmentsRefused;
  }
  revalidatePath(routes.applications);
  revalidatePath(routes.documents);
  redirect(routes.applications);
}

/**
 * Replaces the fields `input` carries, then, when given, the attached
 * versions. Resolves with no invalid fields once saved; refused attachments
 * leave the fields saved. Responds with not-found when there is no such
 * application.
 */
export async function updateApplication(
  id: unknown,
  input: unknown,
  attachedVersionIds?: unknown,
): Promise<ApplicationRejection> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!applicationId.success) {
    notFound();
  }
  const parsed = updateApplicationSchema.safeParse(input);
  const attached =
    attachedVersionIds === undefined
      ? null
      : attachedVersionIdsSchema.safeParse(attachedVersionIds);
  if (!parsed.success || (attached !== null && !attached.success)) {
    return { invalidFields: rejectedFields(parsed.error, attached?.success ?? true) };
  }
  const repository = await applicationRepositoryForRequest();
  const updated = await repository.update(user.id, applicationId.data, parsed.data);
  if (!updated) {
    notFound();
  }
  const stored =
    attached === null ||
    (await repository.replaceAttachedVersions(user.id, applicationId.data, attached.data));
  revalidateApplications();
  return stored ? { invalidFields: [] } : attachmentsRefused;
}

/**
 * Moves an application to any status, dated now. Stored only while the status
 * is still the one just read; resolves with `null` once stored.
 */
export async function changeApplicationStatus(
  id: unknown,
  input: unknown,
): Promise<StatusChangeFailure | null> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  const change = statusChangeSchema.safeParse(input);
  if (!applicationId.success || !change.success) {
    return StatusChangeFailure.Invalid;
  }
  const repository = await applicationRepositoryForRequest();
  const current = await repository.find(user.id, applicationId.data);
  if (!current) {
    return StatusChangeFailure.Outdated;
  }
  const moved = statusTransition(current, change.data.status, new Date());
  if (!(await repository.recordStatusTransition(user.id, current.status, moved))) {
    return StatusChangeFailure.Outdated;
  }
  revalidateApplications();
  return null;
}

export async function archiveApplication(id: unknown): Promise<void> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!applicationId.success) {
    return;
  }
  const repository = await applicationRepositoryForRequest();
  await repository.archive(user.id, applicationId.data, new Date());
  revalidateApplications();
}

export async function unarchiveApplication(id: unknown): Promise<void> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!applicationId.success) {
    return;
  }
  const repository = await applicationRepositoryForRequest();
  await repository.unarchive(user.id, applicationId.data);
  revalidateApplications();
}

export async function deleteApplication(id: unknown): Promise<void> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!applicationId.success) {
    return;
  }
  const repository = await applicationRepositoryForRequest();
  await repository.delete(user.id, applicationId.data);
  revalidateApplications();
}
