"use client";

import { useCallback, useState } from "react";
import { ApplicationsView, applicationPath, applicationsPath, dashboardPath } from "@/app/routes";
import {
  type DashboardApplication,
  type DashboardQuery,
  openStatuses,
} from "@/domain/application/dashboard";
import { defaultListQuery } from "@/domain/application/list";
import { DashboardView } from "@/ui/dashboard/DashboardView";

// The list showing what Waiting now counts.
const waitingListHref = applicationsPath(ApplicationsView.Active, {
  ...defaultListQuery,
  statuses: openStatuses,
});

export type DashboardScreenProps = {
  /** As the request's URL asked. */
  initialQuery: DashboardQuery;
  applications: readonly DashboardApplication[];
  now: Date;
  timeZone: string;
};

/**
 * The dashboard, its query held here and mirrored in the URL. A change
 * replaces the URL in place: the data is already here, so nothing is fetched
 * again. The router reads a replaced URL only later, too late for a
 * controlled input, so the URL is not read back.
 */
export function DashboardScreen({
  initialQuery,
  applications,
  now,
  timeZone,
}: DashboardScreenProps) {
  const [query, setQuery] = useState(initialQuery);
  const changeQuery = useCallback((next: DashboardQuery) => {
    setQuery(next);
    window.history.replaceState(null, "", dashboardPath(next));
  }, []);

  return (
    <DashboardView
      applications={applications}
      query={query}
      onQueryChange={changeQuery}
      applicationHref={applicationPath}
      waitingListHref={waitingListHref}
      now={now}
      timeZone={timeZone}
    />
  );
}
