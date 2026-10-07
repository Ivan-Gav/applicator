import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import { applicationsPath } from "@/app/routes";
import { applicationIdSchema } from "@/domain/application/schema";
import { formatDay, isoDay } from "@/lib/date";
import { ApplicationForm } from "@/ui/applications/ApplicationForm";
import { StatusBadge } from "@/ui/applications/StatusBadge";
import { StatusChangeDialog } from "@/ui/applications/StatusChangeDialog";
import { StatusHistory } from "@/ui/applications/StatusHistory";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { changeApplicationStatus, updateApplication } from "../actions";

const t = messages.applications;

// Shared by generateMetadata and the page within one request.
const loadApplication = cache(async (id: string) => {
  const user = await currentUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!user || !applicationId.success) {
    return null;
  }
  const repository = await applicationRepositoryForRequest();
  const application = await repository.find(user.id, applicationId.data);
  return application && { user, repository, application };
});

export async function generateMetadata({
  params,
}: PageProps<"/applications/[id]">): Promise<Metadata> {
  const loaded = await loadApplication((await params).id);
  return { title: loaded ? t.name(loaded.application) : t.title };
}

// Protected by living inside (protected); the actions check on their own.
export default async function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  const loaded = await loadApplication((await params).id);
  if (!loaded) {
    notFound();
  }
  const { user, repository, application } = loaded;
  const [history, timeZone] = await Promise.all([
    repository.statusHistory(user.id, application.id),
    requestTimeZone(),
  ]);

  const day = (instant: Date) => (
    <time dateTime={isoDay(instant, timeZone)}>{formatDay(instant, timeZone)}</time>
  );

  return (
    <PageColumn width={ColumnWidth.Narrow}>
      <Link
        href={applicationsPath()}
        className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {t.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t.name(application)}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={application.status} />
        <StatusChangeDialog application={application} changeStatus={changeApplicationStatus} />
      </div>

      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t.page.appliedAt}</dt>
        <dd>{application.appliedAt ? day(application.appliedAt) : t.notApplied}</dd>
        <dt className="text-muted-foreground">{t.page.lastContactAt}</dt>
        <dd>{application.lastContactAt ? day(application.lastContactAt) : t.page.noContact}</dd>
        {application.archivedAt && (
          <>
            <dt className="text-muted-foreground">{t.page.archivedAt}</dt>
            <dd>{day(application.archivedAt)}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-10">
        <section aria-labelledby="application-details-title" className="flex flex-col gap-4">
          <h2 id="application-details-title" className="text-lg font-medium">
            {t.page.details}
          </h2>
          <ApplicationForm
            application={application}
            save={updateApplication.bind(null, application.id)}
            backHref={applicationsPath()}
          />
        </section>
        <StatusHistory events={history} timeZone={timeZone} />
      </div>
    </PageColumn>
  );
}
