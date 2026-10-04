"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes } from "@/app/routes";
import { type Application, StatusChangeFailure } from "@/domain/application/model";
import { IllegalStatusTransitionError, statusTransition } from "@/domain/application/rules";
import {
  type ApplicationRejection,
  applicationIdSchema,
  createApplicationSchema,
  invalidApplicationFields,
  statusChangeSchema,
  updateApplicationSchema,
} from "@/domain/application/schema";

// The list and every application page below it.
function revalidateApplications() {
  revalidatePath(routes.applications, "layout");
}

/**
 * Stores a new application for the signed-in user, then redirects to the list:
 * on success it never returns. It returns only when the input is rejected.
 */
export async function createApplication(input: unknown): Promise<ApplicationRejection> {
  const user = await requireUser();
  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { invalidFields: invalidApplicationFields(parsed.error) };
  }
  const repository = await applicationRepositoryForRequest();
  await repository.create(user.id, parsed.data);
  revalidatePath(routes.applications);
  redirect(routes.applications);
}

/**
 * Replaces the fields `input` carries. Resolves with no invalid fields once
 * saved; responds with not-found when there is no such application.
 */
export async function updateApplication(
  id: unknown,
  input: unknown,
): Promise<ApplicationRejection> {
  const user = await requireUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!applicationId.success) {
    notFound();
  }
  const parsed = updateApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { invalidFields: invalidApplicationFields(parsed.error) };
  }
  const repository = await applicationRepositoryForRequest();
  const updated = await repository.update(user.id, applicationId.data, parsed.data);
  if (!updated) {
    notFound();
  }
  revalidateApplications();
  return { invalidFields: [] };
}

/**
 * Moves an application to another status, dated now. Legality is decided here
 * against the stored status, whatever the caller offered. Resolves with `null`
 * once stored.
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
  let moved: Application;
  try {
    moved = statusTransition(current, change.data.status, new Date());
  } catch (error) {
    if (error instanceof IllegalStatusTransitionError) {
      return StatusChangeFailure.Illegal;
    }
    throw error;
  }
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
