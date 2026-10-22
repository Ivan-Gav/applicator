import Link from "next/link";
import { DocumentSort } from "@/domain/document/list";
import type {
  Document,
  DocumentLanguage,
  DocumentType,
  DocumentUploadOutcome,
} from "@/domain/document/model";
import { FilterChip, type FilterToggle } from "@/ui/FilterChip";
import { Button } from "@/ui/kit/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/ui/kit/table";
import { ListSearch, type ListSearchQuery } from "@/ui/ListSearch";
import { messages } from "@/ui/messages";
import { SortableHead, type SortLink } from "@/ui/SortableHead";
import { DocumentRow } from "./DocumentRow";
import { documentRowData } from "./document-row-data";
import { TypeSwatch } from "./TypeTag";
import { UploadDocumentDialog } from "./UploadDocumentDialog";

/** The document actions, each taking the document it acts on first. */
export type DocumentListActions = {
  upload: (form: FormData) => Promise<DocumentUploadOutcome>;
  addVersion: (documentId: string, form: FormData) => Promise<DocumentUploadOutcome>;
  rename: (documentId: string, title: string) => Promise<boolean>;
  delete: (documentId: string) => Promise<void>;
};

/** Search, filters and counts; absent while there is no document at all. */
export type DocumentListControls = {
  search: ListSearchQuery;
  /** In list order, the types some document holds or a filter is on for. */
  types: readonly (FilterToggle & { type: DocumentType })[];
  /** Likewise for languages. */
  languages: readonly (FilterToggle & { language: DocumentLanguage })[];
  /** The list without any filter; null while none is on. */
  clearHref: string | null;
  /** Every document. */
  total: number;
  /** The documents the search and filters let through. */
  matching: number;
  /** Whether anything narrows the list. */
  filtered: boolean;
};

export type DocumentListProps = {
  /** The documents to show: those matching, at most one "Show more" step's worth, in order. */
  documents: readonly Document[];
  controls: DocumentListControls | null;
  sorting: Record<DocumentSort, SortLink>;
  /** No document shown because the search and filters let none through. */
  nothingMatches: boolean;
  /** Where "Show more" leads; null once every matching document is shown. */
  showMoreHref: string | null;
  /** Where a version's file is saved from. */
  fileHref: (versionId: string) => string;
  /** Where a version's file is opened from; formats browsers cannot show are saved instead. */
  fileOpenHref: (versionId: string) => string;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  actions: DocumentListActions;
};

const t = messages.documents;

export function DocumentList({
  documents,
  controls,
  sorting,
  nothingMatches,
  showMoreHref,
  fileHref,
  fileOpenHref,
  timeZone,
  actions,
}: DocumentListProps) {
  const empty = nothingMatches ? t.nothingMatches : t.empty;

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {controls && (
            <>
              <div className="w-full max-w-115">
                <ListSearch
                  {...controls.search}
                  label={t.search.label}
                  placeholder={t.search.placeholder}
                />
              </div>
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                {controls.filtered
                  ? t.countFiltered(controls.matching, controls.total)
                  : t.count(controls.total)}
              </p>
            </>
          )}
          <div className="ml-auto">
            <UploadDocumentDialog upload={actions.upload} />
          </div>
        </div>
        {controls && <Filters controls={controls} />}
      </div>

      {documents.length === 0 ? (
        <section aria-labelledby="documents-empty-title" className="flex flex-col gap-3">
          <h2 id="documents-empty-title" className="text-lg font-medium">
            {empty.title}
          </h2>
          <p className="max-w-prose text-muted-foreground">{empty.description}</p>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table aria-label={t.title} className="[&_td]:px-3.5 [&_td]:py-2.25 [&_th]:px-1.5">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead label={t.columns.document} link={sorting[DocumentSort.Title]} />
                <SortableHead
                  label={t.columns.type}
                  link={sorting[DocumentSort.Type]}
                  className="w-35"
                />
                <SortableHead
                  label={t.columns.language}
                  link={sorting[DocumentSort.Language]}
                  className="w-30"
                />
                <TableHead scope="col" className="w-58.5">
                  <span className="inline-flex h-10 items-center px-2 text-[13px] font-medium text-muted-foreground">
                    {t.columns.version}
                  </span>
                </TableHead>
                <SortableHead
                  label={t.columns.uploaded}
                  link={sorting[DocumentSort.Uploaded]}
                  className="w-31"
                />
                <TableHead scope="col" className="w-32">
                  <span className="sr-only">{t.columns.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <DocumentRow
                  // Changes with a new version, which then starts out chosen.
                  key={`${document.id}:${document.versions[0]?.id}`}
                  row={documentRowData(document, fileHref, fileOpenHref)}
                  timeZone={timeZone}
                  // Bound here: a client component receives server actions, not closures.
                  actions={{
                    addVersion: actions.addVersion.bind(null, document.id),
                    rename: actions.rename.bind(null, document.id),
                    delete: actions.delete.bind(null, document.id),
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showMoreHref && (
        <Button asChild variant="outline" className="self-center">
          {/* Stays where it is: the new documents appear below the ones already read. */}
          <Link href={showMoreHref} scroll={false}>
            {t.showMore}
          </Link>
        </Button>
      )}
    </div>
  );
}

function Filters({ controls }: { controls: DocumentListControls }) {
  return (
    <div role="group" aria-label={t.filters.label} className="flex flex-wrap items-center gap-2">
      {controls.types.map(({ type, ...toggle }) => (
        <FilterChip key={type} {...toggle}>
          <TypeSwatch type={type} />
          {t.type[type]}
        </FilterChip>
      ))}
      {controls.languages.length > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-border" />}
      {controls.languages.map(({ language, ...toggle }) => (
        <FilterChip key={language} {...toggle}>
          {t.language[language]}
        </FilterChip>
      ))}
      {controls.clearHref && (
        <Link
          href={controls.clearHref}
          scroll={false}
          className="ml-1 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t.filters.clear}
        </Link>
      )}
    </div>
  );
}
