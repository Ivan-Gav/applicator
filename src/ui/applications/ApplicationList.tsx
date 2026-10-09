import Link from "next/link";
import { ApplicationSort, SortDirection } from "@/domain/application/list";
import type { Application } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/kit/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import { ApplicationFilters, type ApplicationFiltersProps } from "./ApplicationFilters";
import { ApplicationRow, type ApplicationRowActions } from "./ApplicationRow";
import { ApplicationSearch, type ApplicationSearchProps } from "./ApplicationSearch";

/** A column header's link; `direction` is set on the column the list is ordered by. */
export type SortLink = {
  href: string;
  direction: SortDirection | null;
};

/** Search, filters and counts; absent while the view holds no application at all. */
export type ApplicationListControls = {
  search: ApplicationSearchProps;
  filters: ApplicationFiltersProps;
  /** Applications in the view. */
  total: number;
  /** Applications the search and filters let through. */
  matching: number;
  /** Whether anything narrows the view. */
  filtered: boolean;
};

export type ApplicationListProps = {
  /** The rows to show: those matching the filters, at most one "Show more" step's worth. */
  applications: readonly Application[];
  /** Whether these are the archived applications rather than the active ones. */
  archived: boolean;
  /** No row shown because the filters let none through, though the view has some. */
  nothingMatches: boolean;
  /** Where "Show more" leads; null once every matching row is shown. */
  showMoreHref: string | null;
  controls: ApplicationListControls | null;
  sorting: Record<ApplicationSort, SortLink>;
  addHref: string;
  activeHref: string;
  archivedHref: string;
  applicationHref: (id: string) => string;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  // What "waiting" is counted up to.
  now: Date;
  actions: ApplicationRowActions;
};

const t = messages.applications;

export function ApplicationList({
  applications,
  archived,
  nothingMatches,
  showMoreHref,
  controls,
  sorting,
  addHref,
  activeHref,
  archivedHref,
  applicationHref,
  timeZone,
  now,
  actions,
}: ApplicationListProps) {
  const empty = nothingMatches ? t.nothingMatches : archived ? t.emptyArchived : t.empty;

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label={t.views.label} className="flex gap-0.5 rounded-lg bg-muted p-0.75">
          {[
            { href: activeHref, label: t.views.active, current: !archived },
            { href: archivedHref, label: t.views.archived, current: archived },
          ].map(({ href, label, current }) => (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-[3px] px-3.5 py-1.25 text-sm",
                current
                  ? "bg-card font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Button asChild size="lg" className="rounded-[3px] px-3.5 font-semibold">
          <Link href={addHref}>{t.add}</Link>
        </Button>
      </div>

      {controls && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-115">
              <ApplicationSearch {...controls.search} />
            </div>
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {controls.filtered
                ? t.countFiltered(controls.matching, controls.total)
                : t.count(controls.total)}
            </p>
          </div>
          <ApplicationFilters {...controls.filters} />
        </div>
      )}

      {applications.length === 0 ? (
        <section aria-labelledby="applications-empty-title" className="flex flex-col gap-3">
          <h2 id="applications-empty-title" className="text-lg font-medium">
            {empty.title}
          </h2>
          <p className="max-w-prose text-muted-foreground">{empty.description}</p>
        </section>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table
            aria-label={archived ? t.views.archived : t.title}
            className="[&_td]:px-3.5 [&_td]:py-2.25 [&_th]:px-1.5"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHead
                  label={t.columns.appliedAt}
                  link={sorting[ApplicationSort.AppliedAt]}
                  className="w-32"
                />
                <SortableHead label={t.columns.company} link={sorting[ApplicationSort.Company]} />
                <SortableHead
                  label={t.columns.city}
                  link={sorting[ApplicationSort.City]}
                  className="w-42.5"
                />
                <SortableHead
                  label={t.columns.status}
                  link={sorting[ApplicationSort.Status]}
                  className="w-35"
                />
                <SortableHead
                  label={t.columns.waiting}
                  link={sorting[ApplicationSort.Waiting]}
                  className="w-25 text-right"
                />
                <TableHead scope="col" className="w-22">
                  <span className="sr-only">{t.columns.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((application) => (
                <ApplicationRow
                  key={application.id}
                  application={application}
                  href={applicationHref(application.id)}
                  timeZone={timeZone}
                  now={now}
                  actions={actions}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showMoreHref && (
        <Button asChild variant="outline" className="self-center">
          {/* Stays where it is: the new rows appear below the ones already read. */}
          <Link href={showMoreHref} scroll={false}>
            {t.showMore}
          </Link>
        </Button>
      )}
    </div>
  );
}

const ariaSort = {
  [SortDirection.Ascending]: "ascending",
  [SortDirection.Descending]: "descending",
} as const satisfies Record<SortDirection, string>;

function SortableHead({
  label,
  link,
  className,
}: {
  label: string;
  link: SortLink;
  className?: string;
}) {
  return (
    <TableHead
      scope="col"
      aria-sort={link.direction ? ariaSort[link.direction] : undefined}
      className={className}
    >
      {/* A click on the ordered column reverses it; on another, orders by that one. */}
      <Link
        href={link.href}
        scroll={false}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-xs px-2 text-[13px] font-medium hover:text-foreground hover:no-underline",
          link.direction ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {/* Holds its place on every column, so the label does not shift when the order moves. */}
        <span aria-hidden className="w-2.5 text-[10px]">
          {link.direction && t.sortIndicator[link.direction]}
        </span>
      </Link>
    </TableHead>
  );
}
