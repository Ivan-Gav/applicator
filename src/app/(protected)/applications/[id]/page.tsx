import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import { applicationsPath } from "@/app/routes";
import { applicationIdSchema } from "@/domain/application/schema";
import { ApplicationFacts } from "@/ui/applications/ApplicationFacts";
import { ApplicationForm } from "@/ui/applications/ApplicationForm";
import { StatusTag, StatusTagSize } from "@/ui/applications/StatusTag";
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

  return (
    <PageColumn width={ColumnWidth.Narrow}>
      <Link
        href={applicationsPath()}
        className="self-start text-[13px] text-muted-foreground underline-offset-4 hover:underline"
      >
        {t.back}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] leading-tight font-semibold">{application.companyName}</h1>
        <p className="text-lg text-muted-foreground">{application.positionTitle}</p>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
        <StatusTag
          application={application}
          changeStatus={changeApplicationStatus}
          size={StatusTagSize.Page}
        />
        <ApplicationFacts application={application} timeZone={timeZone} now={new Date()} />
      </div>

      <StatusHistory events={history} timeZone={timeZone} />

      <section aria-labelledby="application-details-title" className="flex flex-col gap-4">
        <h2 id="application-details-title" className="text-xl font-medium">
          {t.page.details}
        </h2>
        <ApplicationForm
          application={application}
          save={updateApplication.bind(null, application.id)}
          backHref={applicationsPath()}
        />
      </section>
    </PageColumn>
  );
}
