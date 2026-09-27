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

// Deliberately not behind requireUser(): this is how a session comes to exist.
// It is the one server action a signed-out visitor is meant to reach.
// `redirectTo` is bound by the sign-in page, which makes it client-supplied
// like any other argument.
export async function requestMagicLink(
  redirectTo: unknown,
  input: unknown,
): Promise<MagicLinkRequestOutcome> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { status: MagicLinkRequestStatus.InvalidEmail };
  }
  // The link must bring the user back to the same origin that holds the PKCE
  // verifier cookie, so the callback URL is derived from this request.
  const callbackUrl = new URL(
    magicLinkCallbackPath(sameSitePath(redirectTo)),
    await requestOrigin(),
  ).toString();
  return sendMagicLink(parsed.data.email, callbackUrl);
}

// A server action, never a GET link: a GET sign-out could be triggered by any
// third-party page with an image tag.
export async function signOut(): Promise<void> {
  await requireUser();
  await signOutCurrentSession();
  // Nothing rendered for the signed-in user may be served from cache afterwards.
  revalidatePath(routes.home, "layout");
  redirect(routes.signIn);
}
