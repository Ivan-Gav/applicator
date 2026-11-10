import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import { applicationsPath, citySearch, documentFileOpenPath, sourceSearch } from "@/app/routes";
import { applicationIdSchema } from "@/domain/application/schema";
import { ApplicationFacts } from "@/ui/applications/ApplicationFacts";
import { ApplicationForm } from "@/ui/applications/ApplicationForm";
import { attachableDocuments } from "@/ui/applications/attachable-documents";
import { StatusTag, StatusTagSize } from "@/ui/applications/StatusTag";
import { StatusHistory } from "@/ui/applications/StatusHistory";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { uploadDocument } from "../../documents/actions";
import { changeApplicationStatus, updateApplication } from "../actions";

const t = messages.applications;

// The signed-in user, a repository acting for them, and the id if it is one.
// Shared by generateMetadata and the page within one request, as is the application.
const loadRequest = cache(async (id: string) => {
  const user = await currentUser();
  const applicationId = applicationIdSchema.safeParse(id);
  if (!user || !applicationId.success) {
    return null;
  }
  return { user, repository: await applicationRepositoryForRequest(), id: applicationId.data };
});

const loadApplication = cache(async (id: string) => {
  const request = await loadRequest(id);
  return request && request.repository.find(request.user.id, request.id);
});

export async function generateMetadata({
  params,
}: PageProps<"/applications/[id]">): Promise<Metadata> {
  const application = await loadApplication((await params).id);
  return { title: application ? t.name(application) : t.title };
}

// Protected by living inside (protected); the actions check on their own.
export default async function ApplicationPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  const request = await loadRequest(id);
  if (!request) {
    notFound();
  }
  const { user, repository } = request;
  // Read beside the application, not after it: RLS answers nothing for an id the user does not own.
  const [application, history, attached, documents, timeZone] = await Promise.all([
    loadApplication(id),
    repository.statusHistory(user.id, request.id),
    repository.attachedVersions(user.id, request.id),
    documentRepositoryForRequest().then((documentRepository) => documentRepository.list(user.id)),
    requestTimeZone(),
  ]);
  if (!application) {
    notFound();
  }

  return (
    <PageColumn width={ColumnWidth.Narrow}>
      <div className="flex flex-col gap-4.5">
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

        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <StatusTag
            application={application}
            changeStatus={changeApplicationStatus}
            size={StatusTagSize.Page}
          />
          <ApplicationFacts application={application} timeZone={timeZone} now={new Date()} />
        </div>
      </div>

      <StatusHistory events={history} timeZone={timeZone} />

      <section aria-labelledby="application-details-title" className="flex flex-col gap-4.5">
        <h2 id="application-details-title" className="text-xl font-medium">
          {t.page.details}
        </h2>
        <ApplicationForm
          application={application}
          save={updateApplication.bind(null, application.id)}
          backHref={applicationsPath()}
          citySearch={citySearch}
          sourceSearch={sourceSearch}
          documents={attachableDocuments(documents, documentFileOpenPath, timeZone, new Date())}
          attached={attached}
          uploadDocument={uploadDocument}
        />
      </section>
    </PageColumn>
  );
}
