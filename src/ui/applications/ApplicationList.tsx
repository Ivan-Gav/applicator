import Link from "next/link";
import type { Application } from "@/domain/application/model";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/kit/button";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import type { ApplicationActionHandlers } from "./ApplicationActions";
import { ApplicationRow } from "./ApplicationRow";

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
  actions: ApplicationActionHandlers;
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
  actions,
}: ApplicationListProps) {
  const empty = archived ? t.emptyArchived : t.empty;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild>
          <Link href={addHref}>{t.add}</Link>
        </Button>
        <nav aria-label={t.views.label} className="flex gap-1">
          {[
            { href: activeHref, label: t.views.active, current: !archived },
            { href: archivedHref, label: t.views.archived, current: archived },
          ].map(({ href, label, current }) => (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                current ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {applications.length === 0 ? (
        <section aria-labelledby="applications-empty-title" className="flex flex-col gap-3">
          <h2 id="applications-empty-title" className="text-lg font-medium">
            {empty.title}
          </h2>
          <p className="max-w-prose text-muted-foreground">{empty.description}</p>
        </section>
      ) : (
        <Table aria-label={archived ? t.views.archived : t.title}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">{t.columns.appliedAt}</TableHead>
              <TableHead scope="col">{t.columns.company}</TableHead>
              <TableHead scope="col">{t.columns.position}</TableHead>
              <TableHead scope="col">{t.columns.city}</TableHead>
              <TableHead scope="col">{t.columns.status}</TableHead>
              <TableHead scope="col" className="text-right">
                {t.columns.actions}
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
                actions={actions}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
