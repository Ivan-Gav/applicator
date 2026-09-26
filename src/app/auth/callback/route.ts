import { type NextRequest, NextResponse } from "next/server";
import { authenticate, completeSignInFromCallback } from "@/adapters/supabase/auth";
import { afterSignInRoute, signInPath } from "@/app/routes";
import { AuthenticationStatus } from "@/domain/user/model";

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * Where the magic link lands. Every failure ends on the sign-in page with a
 * reason; the user needs the same thing in each case, a fresh link.
 *
 * Deliberately not behind requireUser(): this handler is what turns a link
 * into a session, so by definition its caller has none yet.
 */
export async function GET(request: NextRequest) {
  // Reloading this URL replays a code that was already exchanged. The session
  // from the first exchange is still in the cookies, so honour it rather than
  // telling a signed-in user that sign-in failed.
  // With Supabase unreachable this falls through, and the exchange below
  // reports the outage.
  if ((await authenticate()).status === AuthenticationStatus.SignedIn) {
    return redirectTo(request, afterSignInRoute);
  }

  const result = await completeSignInFromCallback(request.nextUrl.searchParams);
  return redirectTo(request, result.ok ? afterSignInRoute : signInPath(result.reason));
}
