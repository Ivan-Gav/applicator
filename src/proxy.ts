import type { NextRequest } from "next/server";
import { resolveSession } from "@/adapters/supabase/proxy-session";
import { requestedPathHeader, signInReasonHeader } from "@/app/routes";
import { SessionState, SignInFailureReason } from "@/domain/user/model";

/**
 * Refreshes the access token, which server components cannot write back as
 * cookies, and tags the request with the requested path and why a session
 * ended. Not an authorisation check; never redirects.
 */
export async function proxy(request: NextRequest) {
  const session = await resolveSession(request);

  request.headers.set(requestedPathHeader, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  request.headers.delete(signInReasonHeader);
  if (session.state === SessionState.Expired) {
    // The dead session is already gone from the request; this tells requireUser() why.
    request.headers.set(signInReasonHeader, SignInFailureReason.SessionExpired);
  }

  return session.forward();
}

export const config = {
  matcher: [
    // Must be a literal: Next.js reads the matcher statically at build time.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
