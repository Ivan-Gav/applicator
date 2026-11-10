import type { Metadata } from "next";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import {
  applicationJsonFormatUrl,
  citySearch,
  documentFileOpenPath,
  routes,
  sourceSearch,
} from "@/app/routes";
import { ApplicationForm } from "@/ui/applications/ApplicationForm";
import { attachableDocuments } from "@/ui/applications/attachable-documents";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { uploadDocument } from "../../documents/actions";
import { createApplication } from "../actions";

export const metadata: Metadata = {
  title: messages.applications.form.title,
};

// Protected by living inside (protected); createApplication checks on its own.
export default async function NewApplicationPage() {
  const user = await currentUser();
  // Only reachable while the layout is redirecting; that render is discarded.
  if (!user) {
    return null;
  }
  const [documents, timeZone] = await Promise.all([
    documentRepositoryForRequest().then((repository) => repository.list(user.id)),
    requestTimeZone(),
  ]);

  return (
    <PageColumn width={ColumnWidth.Narrow}>
      <h1 className="text-[30px] leading-tight font-semibold">
        {messages.applications.form.title}
      </h1>
      <ApplicationForm
        save={createApplication}
        backHref={routes.applications}
        citySearch={citySearch}
        sourceSearch={sourceSearch}
        jsonFormatHref={applicationJsonFormatUrl}
        documents={attachableDocuments(documents, documentFileOpenPath, timeZone, new Date())}
        uploadDocument={uploadDocument}
      />
    </PageColumn>
  );
}
