import type { SignInFailureReason } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";

export const routes = {
  home: "/",
  signIn: "/sign-in",
  authCallback: "/auth/callback",
  applications: "/applications",
  newApplication: "/applications/new",
  apiMe: "/api/me",
} as const;

export const afterSignInRoute = routes.applications;

/** The page of one application. */
export function applicationPath(id: string): string {
  return `${routes.applications}/${encodeURIComponent(id)}`;
}

export const applicationsSearchParam = {
  view: "view",
} as const;

// Which applications the list shows.
export const ApplicationsView = {
  Active: "active",
  Archived: "archived",
} as const;
export type ApplicationsView = (typeof ApplicationsView)[keyof typeof ApplicationsView];

export function applicationsPath(view: ApplicationsView = ApplicationsView.Active): string {
  if (view === ApplicationsView.Active) {
    return routes.applications;
  }
  const params = new URLSearchParams({ [applicationsSearchParam.view]: view });
  return `${routes.applications}?${params.toString()}`;
}

/** The view a list request asks for; anything unknown is the active view. */
export function applicationsViewOf(value: unknown): ApplicationsView {
  return value === ApplicationsView.Archived ? ApplicationsView.Archived : ApplicationsView.Active;
}

export const sourceRepositoryUrl = "https://github.com/Ivan-Gav/applicator";

export const redirectToParam = "redirectTo";

export const signInSearchParam = {
  reason: "reason",
  redirectTo: redirectToParam,
} as const;

// A SignInFailureReason from the proxy to requireUser(). Only the proxy may set
// it; a client's copy is stripped there.
export const signInReasonHeader = "x-sign-in-reason";

// The path and query of the request, which layouts cannot read otherwise. Only
// the proxy may set it; a client's copy is overwritten there. Every reader
// still passes it through sameSitePath().
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
