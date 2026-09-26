import type { NextRequest } from "next/server";
import { resolveSession } from "@/adapters/supabase/proxy-session";
import { signInReasonHeader } from "@/app/routes";
import { SessionState, SignInFailureReason } from "@/domain/user/model";

/**
 * Keeps the access token fresh. That is its only real job: server components
 * cannot write cookies, so a refresh they triggered would rotate the tokens
 * without the browser ever storing the new ones.
 *
 * This is NOT an authorisation check, and it never redirects. Whether a path
 * is protected is decided where the path is defined: the (protected) layout,
 * requireUser() in every route handler and server action, and RLS. A list of
 * paths kept here would duplicate that and drift from it.
 */
export async function proxy(request: NextRequest) {
  const session = await resolveSession(request);

  request.headers.delete(signInReasonHeader);
  if (session.state === SessionState.Expired) {
    // The dead session is already gone from the request, so requireUser() will
    // find nobody. This lets it say why, on paths that need a user only: the
    // sign-in page and the magic link callback carry on undisturbed.
    request.headers.set(signInReasonHeader, SignInFailureReason.SessionExpired);
  }

  return session.forward();
}

export const config = {
  matcher: [
    // Everything except Next.js internals, the favicon and static assets.
    // Must be a literal: Next.js reads the matcher statically at build time.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
