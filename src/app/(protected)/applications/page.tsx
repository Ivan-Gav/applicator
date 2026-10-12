import type { Metadata } from "next";
import { geonamesCityIndex } from "@/adapters/geonames/cities";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import {
  ApplicationsView,
  applicationPath,
  applicationsListStateOf,
  applicationsPageSize,
  applicationsPath,
  routes,
} from "@/app/routes";
import { applicationListView } from "@/domain/application/list";
import { cityIndex } from "@/domain/city/search";
import { ApplicationList } from "@/ui/applications/ApplicationList";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { applicationListControls, applicationSortLinks } from "./_utils/list-controls";
import {
  archiveApplication,
  changeApplicationStatus,
  deleteApplication,
  unarchiveApplication,
} from "./actions";

export const metadata: Metadata = {
  title: messages.applications.title,
};

const actions = {
  changeStatus: changeApplicationStatus,
  archive: archiveApplication,
  unarchive: unarchiveApplication,
  delete: deleteApplication,
};

// Protected by living inside (protected); the layout there decides on access.
export default async function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  const user = await currentUser();
  // Only reachable while the layout is redirecting; that render is discarded.
  if (!user) {
    return null;
  }
  const { view, query, shown } = applicationsListStateOf(await searchParams);
  const archived = view === ApplicationsView.Archived;
  const [applications, timeZone] = await Promise.all([
    applicationRepositoryForRequest().then((repository) =>
      archived ? repository.listArchived(user.id) : repository.listActive(user.id),
    ),
    requestTimeZone(),
  ]);
  const now = new Date();
  // Only a search reads the city list, and its first build in a process takes ~100 ms.
  const cities = query.search.trim() === "" ? cityIndex([]) : geonamesCityIndex();
  // The whole view is filtered here; only the rows to show reach the browser.
  const list = applicationListView(applications, query, now, shown, cities);

  return (
    <PageColumn width={ColumnWidth.Wide}>
      <h1 className="sr-only">{messages.applications.title}</h1>
      <ApplicationList
        applications={list.shown}
        archived={archived}
        nothingMatches={list.total > 0 && list.matching === 0}
        controls={applicationListControls({ view, query }, list)}
        sorting={applicationSortLinks({ view, query })}
        showMoreHref={
          list.shown.length < list.matching
            ? applicationsPath(view, query, shown + applicationsPageSize)
            : null
        }
        addHref={routes.newApplication}
        activeHref={applicationsPath(ApplicationsView.Active)}
        archivedHref={applicationsPath(ApplicationsView.Archived)}
        applicationHref={applicationPath}
        timeZone={timeZone}
        now={now}
        actions={actions}
      />
    </PageColumn>
  );
}
