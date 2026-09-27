import { type NextRequest, NextResponse } from "next/server";
import { authenticate, completeSignInFromCallback } from "@/adapters/supabase/auth";
import { afterSignInPath, redirectToParam, signInPath } from "@/app/routes";
import { AuthenticationStatus } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * Where the magic link lands. Every failure ends on the sign-in page with a
 * reason; the user needs the same thing in each case, a fresh link.
 *
 * Deliberately not behind requireUser(): this handler is what turns a link
 * into a session, so by definition its caller has none yet.
 *
 * `redirectTo` has been through an email and is validated again here.
 */
export async function GET(request: NextRequest) {
  const requested = sameSitePath(request.nextUrl.searchParams.get(redirectToParam));
  const destination = afterSignInPath(requested);

  // Reloading this URL replays a code that was already exchanged. The session
  // from the first exchange is still in the cookies, so honour it rather than
  // telling a signed-in user that sign-in failed.
  // With Supabase unreachable this falls through, and the exchange below
  // reports the outage.
  if ((await authenticate()).status === AuthenticationStatus.SignedIn) {
    return redirectTo(request, destination);
  }

  const result = await completeSignInFromCallback(request.nextUrl.searchParams);
  return redirectTo(
    request,
    result.ok ? destination : signInPath({ reason: result.reason, redirectTo: requested }),
  );
}
