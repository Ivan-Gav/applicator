import type { Metadata } from "next";
import { documentRepositoryForRequest } from "@/adapters/supabase/document.repository";
import { requestTimeZone } from "@/app/_utils/request-time-zone";
import { currentUser } from "@/app/auth/_utils/current-user";
import {
  documentFileOpenPath,
  documentFilePath,
  documentsListStateOf,
  documentsPageSize,
  documentsPath,
} from "@/app/routes";
import { documentListView } from "@/domain/document/list";
import { DocumentList } from "@/ui/documents/DocumentList";
import { messages } from "@/ui/messages";
import { ColumnWidth, PageColumn } from "@/ui/shell/PageColumn";
import { documentListControls, documentSortLinks } from "./_utils/list-controls";
import { addDocumentVersion, deleteDocument, renameDocument, uploadDocument } from "./actions";

export const metadata: Metadata = {
  title: messages.documents.title,
};

const actions = {
  upload: uploadDocument,
  addVersion: addDocumentVersion,
  rename: renameDocument,
  delete: deleteDocument,
};

// Protected by living inside (protected); the layout there decides on access.
export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const user = await currentUser();
  // Only reachable while the layout is redirecting; that render is discarded.
  if (!user) {
    return null;
  }
  const { query, shown } = documentsListStateOf(await searchParams);
  const [documents, timeZone] = await Promise.all([
    documentRepositoryForRequest().then((repository) => repository.list(user.id)),
    requestTimeZone(),
  ]);
  // The whole list is filtered here; only the documents to show reach the browser.
  const list = documentListView(documents, query, shown);

  return (
    <PageColumn width={ColumnWidth.Wide}>
      <h1 className="sr-only">{messages.documents.title}</h1>
      <DocumentList
        documents={list.shown}
        controls={documentListControls(query, list)}
        sorting={documentSortLinks(query)}
        nothingMatches={list.total > 0 && list.matching === 0}
        showMoreHref={
          list.shown.length < list.matching ? documentsPath(query, shown + documentsPageSize) : null
        }
        fileHref={documentFilePath}
        fileOpenHref={documentFileOpenPath}
        timeZone={timeZone}
        actions={actions}
      />
    </PageColumn>
  );
}
