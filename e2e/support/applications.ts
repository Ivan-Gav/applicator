import type { APIRequestContext } from "@playwright/test";
import { toRow } from "@/adapters/supabase/application.mapper";
import { createServiceRoleClient } from "@/adapters/supabase/service-role.client";
import { routes } from "@/app/routes";
import { type CreateApplicationInput, createApplicationSchema } from "@/domain/application/schema";

/** The id of the user whose session `request` carries. */
async function signedInUserId(request: APIRequestContext): Promise<string> {
  const response = await request.get(routes.apiMe, { maxRedirects: 0 });
  if (!response.ok()) {
    throw new Error(`${routes.apiMe} answered ${response.status()}; is the session stored?`);
  }
  const { id } = (await response.json()) as { id: string };
  return id;
}

/** Deletes every application of the user whose session `request` carries. */
export async function removeApplications(request: APIRequestContext): Promise<void> {
  const userId = await signedInUserId(request);
  const { error } = await createServiceRoleClient()
    .from("application")
    .delete()
    .eq("user_id", userId);
  if (error) {
    throw error;
  }
}

/** Stores an application for the user whose session `request` carries. */
export async function seedApplication(
  request: APIRequestContext,
  input: CreateApplicationInput,
): Promise<void> {
  const userId = await signedInUserId(request);
  const { error } = await createServiceRoleClient()
    .from("application")
    .insert(toRow(userId, createApplicationSchema.parse(input)));
  if (error) {
    throw error;
  }
}
