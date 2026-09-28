import { type NextRequest, NextResponse } from "next/server";
import { authenticate, completeSignInFromCallback } from "@/adapters/supabase/auth";
import { afterSignInPath, redirectToParam, signInPath } from "@/app/routes";
import { AuthenticationStatus } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

/**
 * Where the magic link lands; every failure ends on the sign-in page with a
 * reason. Not behind requireUser(): it creates the session.
 */
export async function GET(request: NextRequest) {
  const requested = sameSitePath(request.nextUrl.searchParams.get(redirectToParam));
  const destination = afterSignInPath(requested);

  // A reload replays an already exchanged code; the session from the first
  // exchange is still in the cookies. When Supabase is unreachable, the
  // exchange below reports it.
  if ((await authenticate()).status === AuthenticationStatus.SignedIn) {
    return redirectTo(request, destination);
  }

  const result = await completeSignInFromCallback(request.nextUrl.searchParams);
  return redirectTo(
    request,
    result.ok ? destination : signInPath({ reason: result.reason, redirectTo: requested }),
  );
}
