import {
  type ApplicationListQuery,
  ApplicationSort,
  defaultListQuery,
  SortDirection,
} from "@/domain/application/list";
import { applicationStatuses } from "@/domain/application/model";
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
  search: "q",
  // Comma-separated, e.g. "applied,interview".
  status: "status",
  waiting: "waiting",
  sort: "sort",
  direction: "dir",
  // How many rows the list shows; "Show more" raises it by a page.
  shown: "shown",
} as const;

// The value of `waiting` that keeps only applications waiting long.
export const waitingLongParam = "long";

/** Rows the list shows at first, and adds per "Show more". */
export const applicationsPageSize = 50;

// Which applications the list shows.
export const ApplicationsView = {
  Active: "active",
  Archived: "archived",
} as const;
export type ApplicationsView = (typeof ApplicationsView)[keyof typeof ApplicationsView];

/** The list as `view`, `query` and `shown` describe it; defaults stay out of the URL. */
export function applicationsPath(
  view: ApplicationsView = ApplicationsView.Active,
  query: ApplicationListQuery = defaultListQuery,
  shown: number = applicationsPageSize,
): string {
  const p = applicationsSearchParam;
  const params = new URLSearchParams();
  if (view !== ApplicationsView.Active) {
    params.set(p.view, view);
  }
  if (query.search.trim() !== "") {
    params.set(p.search, query.search);
  }
  if (query.statuses.length > 0) {
    params.set(p.status, query.statuses.join(","));
  }
  if (query.waitingLong) {
    params.set(p.waiting, waitingLongParam);
  }
  // The order is written whole, column and direction, or not at all.
  if (query.sort !== defaultListQuery.sort || query.direction !== defaultListQuery.direction) {
    params.set(p.sort, query.sort);
    params.set(p.direction, query.direction);
  }
  if (shown !== applicationsPageSize) {
    params.set(p.shown, String(shown));
  }
  const search = params.toString();
  return search ? `${routes.applications}?${search}` : routes.applications;
}

export type ApplicationsListState = {
  view: ApplicationsView;
  query: ApplicationListQuery;
  shown: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

/** What a list request asks for. Anything unknown or malformed falls back to the default. */
export function applicationsListStateOf(params: SearchParams): ApplicationsListState {
  const p = applicationsSearchParam;
  const value = (name: string) => {
    const raw = params[name];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const requested = new Set(value(p.status)?.split(","));
  const sort = oneOf(Object.values(ApplicationSort), value(p.sort)) ?? defaultListQuery.sort;
  const shownParam = value(p.shown) ?? "";
  // Digits only, so "1e3" or "2.5" are not taken for a count.
  const shown = /^\d+$/.test(shownParam) ? Number(shownParam) : applicationsPageSize;

  return {
    view: applicationsViewOf(value(p.view)),
    query: {
      search: value(p.search) ?? defaultListQuery.search,
      statuses: applicationStatuses.filter((status) => requested.has(status)),
      waitingLong: value(p.waiting) === waitingLongParam,
      sort,
      // A missing direction reads the same for every column.
      direction:
        oneOf(Object.values(SortDirection), value(p.direction)) ?? SortDirection.Descending,
    },
    shown: Number.isSafeInteger(shown)
      ? Math.max(shown, applicationsPageSize)
      : applicationsPageSize,
  };
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | undefined {
  return values.find((candidate) => candidate === value);
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
