import { type Application, type ApplicationStatus, applicationStatuses } from "./model";
import { daysWithoutResponse } from "./rules";

// What the list can be ordered by.
export const ApplicationSort = {
  AppliedAt: "applied",
  Company: "company",
  City: "city",
  Status: "status",
  Waiting: "waiting",
} as const;
export type ApplicationSort = (typeof ApplicationSort)[keyof typeof ApplicationSort];

export const SortDirection = {
  Ascending: "asc",
  Descending: "desc",
} as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

/** Days without a response from which an application counts as waiting long. */
export const longWaitDays = 40;

/** Which applications of a view to show, and in what order. */
export type ApplicationListQuery = {
  /** Matched against company, position and city; blank matches everything. */
  search: string;
  /** Any of these; none means every status. */
  statuses: readonly ApplicationStatus[];
  /** Only those waiting {@link longWaitDays} days or more. */
  waitingLong: boolean;
  sort: ApplicationSort;
  direction: SortDirection;
};

export const defaultListQuery: ApplicationListQuery = {
  search: "",
  statuses: [],
  waitingLong: false,
  sort: ApplicationSort.AppliedAt,
  direction: SortDirection.Descending,
};

/** The direction a first click on a column sorts in: dates and waits newest or longest first. */
export function firstDirection(sort: ApplicationSort): SortDirection {
  return sort === ApplicationSort.AppliedAt || sort === ApplicationSort.Waiting
    ? SortDirection.Descending
    : SortDirection.Ascending;
}

/** Whether the query narrows the view at all; the order does not count. */
export function isFiltered(query: ApplicationListQuery): boolean {
  return normalizedSearch(query.search) !== "" || query.statuses.length > 0 || query.waitingLong;
}

export function waitsLong(application: Application, now: Date): boolean {
  const days = daysWithoutResponse(application, now);
  return days !== null && days >= longWaitDays;
}

/** Case-insensitive, in company, position or city. */
export function matchesSearch(application: Application, search: string): boolean {
  const needle = normalizedSearch(search);
  if (needle === "") {
    return true;
  }
  return [application.companyName, application.positionTitle, application.city].some(
    (field) => field !== null && field.toLocaleLowerCase().includes(needle),
  );
}

export function matchesQuery(
  application: Application,
  query: ApplicationListQuery,
  now: Date,
): boolean {
  return (
    matchesSearch(application, query.search) &&
    (query.statuses.length === 0 || query.statuses.includes(application.status)) &&
    (!query.waitingLong || waitsLong(application, now))
  );
}

/**
 * A sorted copy. Missing values sink to the bottom in either direction; ties
 * keep the order they came in.
 */
export function sortApplications(
  applications: readonly Application[],
  sort: ApplicationSort,
  direction: SortDirection,
  now: Date,
): Application[] {
  const key = sortKey(sort, now);
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  return applications.toSorted((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === null || right === null) {
      return left === right ? 0 : left === null ? 1 : -1;
    }
    return sign * compare(left, right);
  });
}

/** One status present in a view, with how many applications of the view hold it. */
export type StatusCount = {
  status: ApplicationStatus;
  count: number;
};

/** What a page of the list needs to know about one view. */
export type ApplicationListView = {
  /** The first `limit` matching applications, in the query's order. */
  shown: Application[];
  /** Every application of the view. */
  total: number;
  /** The applications the query lets through. */
  matching: number;
  /** In process order, only statuses the view holds, counted over the whole view. */
  statusCounts: StatusCount[];
  /** How many of the whole view wait long; their filter is offered only when some do. */
  waitingLongCount: number;
};

export function applicationListView(
  applications: readonly Application[],
  query: ApplicationListQuery,
  now: Date,
  limit: number,
): ApplicationListView {
  const matching = sortApplications(
    applications.filter((application) => matchesQuery(application, query, now)),
    query.sort,
    query.direction,
    now,
  );
  return {
    shown: matching.slice(0, limit),
    total: applications.length,
    matching: matching.length,
    statusCounts: applicationStatuses
      .map((status) => ({
        status,
        count: applications.filter((application) => application.status === status).length,
      }))
      .filter(({ count }) => count > 0),
    waitingLongCount: applications.filter((application) => waitsLong(application, now)).length,
  };
}

function normalizedSearch(search: string): string {
  return search.trim().toLocaleLowerCase();
}

type SortValue = number | string;

function sortKey(sort: ApplicationSort, now: Date): (application: Application) => SortValue | null {
  switch (sort) {
    case ApplicationSort.AppliedAt:
      return (application) => application.appliedAt?.getTime() ?? null;
    case ApplicationSort.Company:
      return (application) => application.companyName;
    case ApplicationSort.City:
      return (application) => application.city;
    case ApplicationSort.Status:
      return (application) => applicationStatuses.indexOf(application.status);
    case ApplicationSort.Waiting:
      return (application) => daysWithoutResponse(application, now);
  }
}

function compare(left: SortValue, right: SortValue): number {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right, undefined, { sensitivity: "base" });
  }
  return (left as number) - (right as number);
}
