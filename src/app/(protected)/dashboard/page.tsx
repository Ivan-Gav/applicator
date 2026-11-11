import type { Metadata } from "next";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import { dashboardQueryOf } from "@/app/routes";
import { dashboardApplication } from "@/domain/application/dashboard";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { DashboardScreen } from "./_utils/DashboardScreen";

export const metadata: Metadata = {
  title: messages.dashboard.title,
};

// Protected by living inside (protected); the layout there decides on access.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await currentUser();
  // Only reachable while the layout is redirecting; that render is discarded.
  if (!user) {
    return null;
  }
  // One read; every card is computed from it in the browser.
  const [applications, timeZone, params] = await Promise.all([
    applicationRepositoryForRequest().then((repository) =>
      repository.listWithStatusHistory(user.id),
    ),
    requestTimeZone(),
    searchParams,
  ]);

  return (
    <PageColumn width={ColumnWidth.Wide}>
      <h1 className="sr-only">{messages.dashboard.title}</h1>
      <DashboardScreen
        initialQuery={dashboardQueryOf(params)}
        applications={applications.map(dashboardApplication)}
        now={new Date()}
        timeZone={timeZone}
      />
    </PageColumn>
  );
}
