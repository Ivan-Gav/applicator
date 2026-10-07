import type { Metadata } from "next";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import {
  ApplicationsView,
  applicationPath,
  applicationsPath,
  applicationsSearchParam,
  applicationsViewOf,
  routes,
} from "@/app/routes";
import { ApplicationList } from "@/ui/applications/ApplicationList";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
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
  const archived =
    applicationsViewOf((await searchParams)[applicationsSearchParam.view]) ===
    ApplicationsView.Archived;
  const [applications, timeZone] = await Promise.all([
    applicationRepositoryForRequest().then((repository) =>
      archived ? repository.listArchived(user.id) : repository.listActive(user.id),
    ),
    requestTimeZone(),
  ]);

  return (
    <PageColumn width={ColumnWidth.Wide}>
      <h1 className="sr-only">{messages.applications.title}</h1>
      <ApplicationList
        applications={applications}
        archived={archived}
        addHref={routes.newApplication}
        activeHref={applicationsPath(ApplicationsView.Active)}
        archivedHref={applicationsPath(ApplicationsView.Archived)}
        applicationHref={applicationPath}
        timeZone={timeZone}
        actions={actions}
      />
    </PageColumn>
  );
}
