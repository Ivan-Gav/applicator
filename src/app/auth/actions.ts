"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendMagicLink, signOutCurrentSession } from "@/adapters/supabase/auth";
import { magicLinkCallbackPath, routes } from "@/app/routes";
import { MagicLinkRequestStatus, type MagicLinkRequestOutcome } from "@/domain/user/model";
import { signInSchema } from "@/domain/user/schema";
import { sameSitePath } from "@/lib/same-site-path";
import { requireUser } from "./_utils/require-user";

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) {
    return origin;
  }
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) {
    throw new Error("Cannot determine the request origin for the magic link callback");
  }
  return `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${host}`;
}

// Not behind requireUser(): it creates the session. `redirectTo` is bound by
// the sign-in page, so it is client-supplied.
export async function requestMagicLink(
  redirectTo: unknown,
  input: unknown,
): Promise<MagicLinkRequestOutcome> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { status: MagicLinkRequestStatus.InvalidEmail };
  }
  // The callback must hit the origin that holds the PKCE verifier cookie.
  const callbackUrl = new URL(
    magicLinkCallbackPath(sameSitePath(redirectTo)),
    await requestOrigin(),
  ).toString();
  return sendMagicLink(parsed.data.email, callbackUrl);
}

// Never a GET: any third-party page could trigger it with an image tag.
export async function signOut(): Promise<void> {
  await requireUser();
  await signOutCurrentSession();
  revalidatePath(routes.home, "layout");
  redirect(routes.signIn);
}
