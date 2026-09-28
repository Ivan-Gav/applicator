import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { callbackParam, supabaseErrorCode } from "@/adapters/supabase/auth.constants";
import { createServiceRoleClient } from "@/adapters/supabase/service-role.client";
import { afterSignInRoute } from "@/app/routes";
import { authCallbackPath, isAt } from "./urls";

export const authStateFile = path.resolve("e2e/.auth/user.json");

// One address per scenario that mints its own link: generating a link replaces
// the previous token for that address, so two workers sharing an address would
// invalidate each other's links.
export const sharedUser = { email: "e2e@applicator.test" };
export const formUser = { email: "e2e-form@applicator.test" };
export const signOutUser = { email: "e2e-sign-out@applicator.test" };
export const expiredSessionUser = { email: "e2e-expired-session@applicator.test" };

export async function ensureUser(email: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error && error.code !== supabaseErrorCode.emailExists) {
    throw error;
  }
}

/**
 * A callback URL that signs `email` in without a mailbox. Uses the token hash:
 * the admin API's action_link carries no PKCE code.
 */
export async function magicLinkCallbackUrl(email: string): Promise<string> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    throw error;
  }
  return authCallbackPath({ [callbackParam.tokenHash]: data.properties.hashed_token });
}

export async function signInWithMagicLink(page: Page, email: string): Promise<void> {
  await ensureUser(email);
  await page.goto(await magicLinkCallbackUrl(email));
  await expect(page).toHaveURL(isAt(afterSignInRoute));
}
