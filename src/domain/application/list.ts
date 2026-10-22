import { alternateNameMatches, type CityIndex } from "@/domain/city/search";
import { normalizeForSearch } from "@/lib/normalize-for-search";
import { SortDirection } from "@/lib/sort-direction";
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

export { SortDirection } from "@/lib/sort-direction";

/** Days without a response from which an application counts as waiting long. */
export const longWaitDays = 40;

/** Which applications of a view to show, and in what order. */
export type ApplicationListQuery = {
  /** Matched against company, position and city (see {@link matchesSearch}); blank matches everything. */
  search: string;
  /** Any of these, ignoring case and accents; none means every city. */
  cities: readonly string[];
  /** Any of these; none means every status. */
  statuses: readonly ApplicationStatus[];
  /** Only those waiting {@link longWaitDays} days or more. */
  waitingLong: boolean;
  sort: ApplicationSort;
  direction: SortDirection;
};

export const defaultListQuery: ApplicationListQuery = {
  search: "",
  cities: [],
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
  return (
    normalizedSearch(query.search) !== "" ||
    query.cities.length > 0 ||
    query.statuses.length > 0 ||
    query.waitingLong
  );
}

export function waitsLong(application: Application, now: Date): boolean {
  const days = daysWithoutResponse(application, now);
  return days !== null && days >= longWaitDays;
}

/**
 * In company or position, ignoring case; in the city, ignoring case and
 * accents; or in another name the reference list knows the city by, from the
 * start of a word.
 */
export function matchesSearch(
  application: Application,
  search: string,
  cities: CityIndex,
): boolean {
  const lowercaseSearch = normalizedSearch(search);
  if (lowercaseSearch === "") {
    return true;
  }
  if (
    [application.companyName, application.positionTitle].some((field) =>
      field.toLocaleLowerCase().includes(lowercaseSearch),
    )
  ) {
    return true;
  }
  const { city, country } = application;
  if (city === null) {
    return false;
  }
  const citySearch = normalizeForSearch(search);
  return (
    (citySearch !== "" && normalizeForSearch(city).includes(citySearch)) ||
    alternateNameMatches(cities, city, country, search)
  );
}

/** Whether an application passes every filter of `query`; prepared once for a whole view. */
export function applicationFilter(
  query: ApplicationListQuery,
  now: Date,
  cities: CityIndex,
): (application: Application) => boolean {
  // Spellings differing only in case or accents name one city.
  const chosenCities = new Set(query.cities.map(normalizeForSearch));
  return (application) =>
    matchesSearch(application, query.search, cities) &&
    (chosenCities.size === 0 ||
      (application.city !== null && chosenCities.has(normalizeForSearch(application.city)))) &&
    (query.statuses.length === 0 || query.statuses.includes(application.status)) &&
    (!query.waitingLong || waitsLong(application, now));
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

/** One city of a view, spelled as first stored, with how many applications are there. */
export type CityCount = {
  city: string;
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
  /** Alphabetically, every city of the whole view; spellings differing in case or accents count as one. */
  cityCounts: CityCount[];
};

export function applicationListView(
  applications: readonly Application[],
  query: ApplicationListQuery,
  now: Date,
  limit: number,
  cities: CityIndex,
): ApplicationListView {
  const matching = sortApplications(
    applications.filter(applicationFilter(query, now, cities)),
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
    cityCounts: cityCounts(applications),
  };
}

function cityCounts(applications: readonly Application[]): CityCount[] {
  const counts = new Map<string, CityCount>();
  for (const { city } of applications) {
    if (city !== null) {
      const key = normalizeForSearch(city);
      const counted = counts.get(key) ?? { city, count: 0 };
      counts.set(key, { ...counted, count: counted.count + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => compare(a.city, b.city));
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
