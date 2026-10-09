import {
  type ApplicationsListState,
  applicationsPath,
  applicationsSearchParam,
  routes,
} from "@/app/routes";
import {
  type ApplicationListQuery,
  type ApplicationListView,
  ApplicationSort,
  defaultListQuery,
  firstDirection,
  isFiltered,
  SortDirection,
} from "@/domain/application/list";
import { type ApplicationStatus, applicationStatuses } from "@/domain/application/model";
import type { ApplicationListControls, SortLink } from "@/ui/applications/ApplicationList";

type ListState = Pick<ApplicationsListState, "view" | "query">;

/**
 * Search, filters and counts for one view of the list, each control's link
 * built here. Every link starts the list over at its first page.
 */
export function applicationListControls(
  { view, query }: ListState,
  list: ApplicationListView,
): ApplicationListControls | null {
  if (list.total === 0) {
    return null;
  }
  const path = (changed: Partial<ApplicationListQuery>) =>
    applicationsPath(view, { ...query, ...changed });
  // A status filtered on stays offered, so it can be switched off, even once the view holds none.
  const counts = new Map(list.statusCounts.map(({ status, count }) => [status, count]));
  const offered = applicationStatuses.filter(
    (status) => counts.has(status) || query.statuses.includes(status),
  );

  return {
    search: {
      action: routes.applications,
      name: applicationsSearchParam.search,
      value: query.search,
      hiddenFields: [...new URLSearchParams(path({ search: "" }).split("?")[1])],
    },
    filters: {
      statuses: offered.map((status) => {
        const on = query.statuses.includes(status);
        return {
          status,
          count: counts.get(status) ?? 0,
          on,
          href: path({ statuses: toggled(query.statuses, status) }),
        };
      }),
      waitingLong:
        list.waitingLongCount > 0 || query.waitingLong
          ? {
              on: query.waitingLong,
              href: path({ waitingLong: !query.waitingLong }),
              count: list.waitingLongCount,
            }
          : null,
      clearHref: isFiltered(query)
        ? path({
            search: defaultListQuery.search,
            statuses: defaultListQuery.statuses,
            waitingLong: defaultListQuery.waitingLong,
          })
        : null,
    },
    total: list.total,
    matching: list.matching,
    filtered: isFiltered(query),
  };
}

/** Each column's header link: the ordered column reverses, any other starts in its first direction. */
export function applicationSortLinks({
  view,
  query,
}: ListState): Record<ApplicationSort, SortLink> {
  const link = (sort: ApplicationSort): SortLink => {
    const ordered = query.sort === sort;
    const direction = ordered ? reversed(query.direction) : firstDirection(sort);
    return {
      href: applicationsPath(view, { ...query, sort, direction }),
      direction: ordered ? query.direction : null,
    };
  };
  return {
    [ApplicationSort.AppliedAt]: link(ApplicationSort.AppliedAt),
    [ApplicationSort.Company]: link(ApplicationSort.Company),
    [ApplicationSort.City]: link(ApplicationSort.City),
    [ApplicationSort.Status]: link(ApplicationSort.Status),
    [ApplicationSort.Waiting]: link(ApplicationSort.Waiting),
  };
}

function toggled(
  statuses: readonly ApplicationStatus[],
  status: ApplicationStatus,
): ApplicationStatus[] {
  return applicationStatuses.filter((candidate) =>
    candidate === status ? !statuses.includes(status) : statuses.includes(candidate),
  );
}

function reversed(direction: SortDirection): SortDirection {
  return direction === SortDirection.Ascending ? SortDirection.Descending : SortDirection.Ascending;
}
