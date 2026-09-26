import type { SignInFailureReason } from "@/domain/user/model";

export const routes = {
  home: "/",
  signIn: "/sign-in",
  authCallback: "/auth/callback",
  applications: "/applications",
  apiMe: "/api/me",
} as const;

export const afterSignInRoute = routes.applications;

export const signInSearchParam = {
  reason: "reason",
} as const;

// Carries a SignInFailureReason from the proxy to requireUser(), which is where
// the redirect to sign-in happens. Only the proxy may set it; a copy sent by a
// client is stripped there. Forged, it could only change which message the
// sign-in page shows.
export const signInReasonHeader = "x-sign-in-reason";

export function signInPath(reason?: SignInFailureReason): string {
  if (!reason) {
    return routes.signIn;
  }
  const params = new URLSearchParams({ [signInSearchParam.reason]: reason });
  return `${routes.signIn}?${params.toString()}`;
}
