import {
  type ApplicationListQuery,
  ApplicationSort,
  defaultListQuery,
  SortDirection,
} from "@/domain/application/list";
import { applicationStatuses } from "@/domain/application/model";
import {
  type DocumentListQuery,
  DocumentSort,
  defaultDocumentListQuery,
} from "@/domain/document/list";
import { documentLanguages, documentTypes } from "@/domain/document/model";
import type { SignInFailureReason } from "@/domain/user/model";
import { sameSitePath } from "@/lib/same-site-path";

export const routes = {
  home: "/",
  signIn: "/sign-in",
  authCallback: "/auth/callback",
  applications: "/applications",
  newApplication: "/applications/new",
  documents: "/documents",
  apiMe: "/api/me",
  apiCities: "/api/cities",
  apiSources: "/api/sources",
  apiDocumentFiles: "/api/document-files",
} as const;

// Present on a document file's address when the browser is to show the file
// rather than save it.
export const documentFileOpenParam = "open";

/** Where the browser saves the file of one document version. */
export function documentFilePath(versionId: string): string {
  return `${routes.apiDocumentFiles}/${encodeURIComponent(versionId)}`;
}

/** Where the browser shows the file of one document version, for a format it can show. */
export function documentFileOpenPath(versionId: string): string {
  return `${documentFilePath(versionId)}?${documentFileOpenParam}`;
}

export const documentsSearchParam = {
  search: "q",
  // Comma-separated, e.g. "cv,diploma".
  type: "type",
  // Comma-separated, e.g. "en,de".
  language: "lang",
  sort: "sort",
  direction: "dir",
  // How many documents the list shows; "Show more" raises it by a page.
  shown: "shown",
} as const;

/** Documents the list shows at first, and adds per "Show more". */
export const documentsPageSize = 20;

/** The documents list as `query` and `shown` describe it; defaults stay out of the URL. */
export function documentsPath(
  query: DocumentListQuery = defaultDocumentListQuery,
  shown: number = documentsPageSize,
): string {
  const p = documentsSearchParam;
  const params = new URLSearchParams();
  if (query.search.trim() !== "") {
    params.set(p.search, query.search);
  }
  if (query.types.length > 0) {
    params.set(p.type, query.types.join(","));
  }
  if (query.languages.length > 0) {
    params.set(p.language, query.languages.join(","));
  }
  // The order is written whole, field and direction, or not at all.
  if (
    query.sort !== defaultDocumentListQuery.sort ||
    query.direction !== defaultDocumentListQuery.direction
  ) {
    params.set(p.sort, query.sort);
    params.set(p.direction, query.direction);
  }
  if (shown !== documentsPageSize) {
    params.set(p.shown, String(shown));
  }
  const search = params.toString();
  return search ? `${routes.documents}?${search}` : routes.documents;
}

export type DocumentsListState = {
  query: DocumentListQuery;
  shown: number;
};

/** What a documents list request asks for. Anything unknown or malformed falls back to the default. */
export function documentsListStateOf(params: SearchParams): DocumentsListState {
  const p = documentsSearchParam;
  const value = (name: string) => {
    const raw = params[name];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const listed = (name: string) => new Set(value(name)?.split(","));
  const types = listed(p.type);
  const languages = listed(p.language);

  return {
    query: {
      search: value(p.search) ?? defaultDocumentListQuery.search,
      types: documentTypes.filter((type) => types.has(type)),
      languages: documentLanguages.filter((language) => languages.has(language)),
      sort: oneOf(Object.values(DocumentSort), value(p.sort)) ?? defaultDocumentListQuery.sort,
      direction:
        oneOf(Object.values(SortDirection), value(p.direction)) ??
        defaultDocumentListQuery.direction,
    },
    shown: shownOf(value(p.shown), documentsPageSize),
  };
}

// Digits only, so "1e3" or "2.5" are not taken for a count; never less than a page.
function shownOf(param: string | undefined, pageSize: number): number {
  const shown = /^\d+$/.test(param ?? "") ? Number(param) : pageSize;
  return Number.isSafeInteger(shown) ? Math.max(shown, pageSize) : pageSize;
}

// The search `routes.apiCities` answers.
export const citySearchParam = "q";

/** The city search, as the city field asks it. */
export const citySearch = { action: routes.apiCities, name: citySearchParam } as const;

// The search `routes.apiSources` answers.
export const sourceSearchParam = "q";

/** The source search, as the source field asks it. */
export const sourceSearch = { action: routes.apiSources, name: sourceSearchParam } as const;

export const afterSignInRoute = routes.applications;

/** The page of one application. */
export function applicationPath(id: string): string {
  return `${routes.applications}/${encodeURIComponent(id)}`;
}

export const applicationsSearchParam = {
  view: "view",
  search: "q",
  // Repeated, once per city: a city's name may hold a comma.
  city: "city",
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
  for (const city of query.cities) {
    params.append(p.city, city);
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
  const values = (name: string) => {
    const raw = params[name];
    return Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  };
  const requested = new Set(value(p.status)?.split(","));
  const sort = oneOf(Object.values(ApplicationSort), value(p.sort)) ?? defaultListQuery.sort;

  return {
    view: applicationsViewOf(value(p.view)),
    query: {
      search: value(p.search) ?? defaultListQuery.search,
      cities: values(p.city)
        .map((city) => city.trim())
        .filter((city) => city !== ""),
      statuses: applicationStatuses.filter((status) => requested.has(status)),
      waitingLong: value(p.waiting) === waitingLongParam,
      sort,
      // A missing direction reads the same for every column.
      direction:
        oneOf(Object.values(SortDirection), value(p.direction)) ?? SortDirection.Descending,
    },
    shown: shownOf(value(p.shown), applicationsPageSize),
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

/** The description of the JSON an application can be pasted as. */
export const applicationJsonFormatUrl = `${sourceRepositoryUrl}/blob/main/docs/application-json.md`;

// The source of the city list and its licence, which requires attribution.
export const placeDataSource = {
  sourceHref: "https://www.geonames.org/",
  licenceHref: "https://creativecommons.org/licenses/by/4.0/",
} as const;

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
