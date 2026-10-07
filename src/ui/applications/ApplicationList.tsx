import Link from "next/link";
import type { Application } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/kit/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import { ApplicationRow, type ApplicationRowActions } from "./ApplicationRow";

export type ApplicationListProps = {
  applications: readonly Application[];
  /** Whether these are the archived applications rather than the active ones. */
  archived: boolean;
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
  addHref,
  activeHref,
  archivedHref,
  applicationHref,
  timeZone,
  now,
  actions,
}: ApplicationListProps) {
  const empty = archived ? t.emptyArchived : t.empty;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t.views.label} className="flex gap-1 rounded-md bg-muted p-1">
          {[
            { href: activeHref, label: t.views.active, current: !archived },
            { href: archivedHref, label: t.views.archived, current: archived },
          ].map(({ href, label, current }) => (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-sm px-4 py-1.5 text-[15px] font-medium",
                current
                  ? "bg-card font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Button asChild size="lg" className="px-4 font-semibold">
          <Link href={addHref}>{t.add}</Link>
        </Button>
      </div>

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
            className="[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3"
          >
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">{t.columns.appliedAt}</TableHead>
                <TableHead scope="col">{t.columns.company}</TableHead>
                <TableHead scope="col">{t.columns.city}</TableHead>
                <TableHead scope="col">{t.columns.status}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t.columns.waiting}
                </TableHead>
                <TableHead scope="col">
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
    </div>
  );
}
