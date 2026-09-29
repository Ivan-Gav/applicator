"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes } from "@/app/routes";
import {
  type CreateApplicationRejection,
  createApplicationSchema,
  invalidCreateFields,
} from "@/domain/application/schema";

/**
 * Stores a new application for the signed-in user, then redirects to the list:
 * on success it never returns. It returns only when the input is rejected.
 */
export async function createApplication(input: unknown): Promise<CreateApplicationRejection> {
  const user = await requireUser();
  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { invalidFields: invalidCreateFields(parsed.error) };
  }
  const repository = await applicationRepositoryForRequest();
  await repository.create(user.id, parsed.data);
  revalidatePath(routes.applications);
  redirect(routes.applications);
}
