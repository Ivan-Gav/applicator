import type { SignInFailureReason } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";

export const routes = {
  home: "/",
  signIn: "/sign-in",
  authCallback: "/auth/callback",
  applications: "/applications",
  apiMe: "/api/me",
} as const;

export const afterSignInRoute = routes.applications;

export const sourceRepositoryUrl = "https://github.com/Ivan-Gav/applicator";

// Where to go once signed in. Read by the sign-in page and the magic link
// callback, and by the guest layout when a signed-in user lands on sign-in.
export const redirectToParam = "redirectTo";

export const signInSearchParam = {
  reason: "reason",
  redirectTo: redirectToParam,
} as const;

// Carries a SignInFailureReason from the proxy to requireUser(), which is where
// the redirect to sign-in happens. Only the proxy may set it; a copy sent by a
// client is stripped there. Forged, it could only change which message the
// sign-in page shows.
export const signInReasonHeader = "x-sign-in-reason";

// The path and query of the request, set by the proxy, because layouts get
// neither. Only the proxy may set it; a copy sent by a client is overwritten
// there. Every reader still passes it through sameSitePath().
export const requestedPathHeader = "x-requested-path";

export type SignInPathOptions = {
  reason?: SignInFailureReason | undefined;
  redirectTo?: string | null | undefined;
};

export function signInPath({ reason, redirectTo }: SignInPathOptions = {}): string {
  const params = new URLSearchParams();
  if (reason) {
    params.set(signInSearchParam.reason, reason);
  }
  if (redirectTo) {
    params.set(signInSearchParam.redirectTo, redirectTo);
  }
  const query = params.toString();
  return query ? `${routes.signIn}?${query}` : routes.signIn;
}

export function magicLinkCallbackPath(redirectTo?: string | null): string {
  if (!redirectTo) {
    return routes.authCallback;
  }
  const params = new URLSearchParams({ [redirectToParam]: redirectTo });
  return `${routes.authCallback}?${params.toString()}`;
}

/** The destination after sign-in: `redirectTo` if it stays on this site, the default otherwise. */
export function afterSignInPath(redirectTo: unknown): string {
  return sameSitePath(redirectTo) ?? afterSignInRoute;
}

/** The `redirectTo` a path carries in its query, if any; not yet validated. */
export function redirectToIn(path: string): string | null {
  const queryStart = path.indexOf("?");
  return queryStart === -1
    ? null
    : new URLSearchParams(path.slice(queryStart)).get(redirectToParam);
}
