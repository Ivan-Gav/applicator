import type { Metadata } from "next";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import { routes } from "@/app/routes";
import { ApplicationList } from "@/ui/applications/ApplicationList";
import { messages } from "@/ui/messages";

export const metadata: Metadata = {
  title: messages.applications.title,
};

// Protected by living inside (protected); the layout there decides on access.
export default async function ApplicationsPage() {
  const user = await currentUser();
  // Only reachable while the layout is redirecting; that render is discarded.
  if (!user) {
    return null;
  }
  const [applications, timeZone] = await Promise.all([
    applicationRepositoryForRequest().then((repository) => repository.list(user.id)),
    requestTimeZone(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{messages.applications.title}</h1>
      <ApplicationList
        applications={applications}
        addHref={routes.newApplication}
        timeZone={timeZone}
      />
    </>
  );
}
