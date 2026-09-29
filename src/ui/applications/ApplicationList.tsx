import Link from "next/link";
import type { Application } from "@/domain/application/model";
import { formatDay, isoDay } from "@/lib/date";
import { Button } from "@/ui/kit/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import { StatusBadge } from "./StatusBadge";

export type ApplicationListProps = {
  applications: readonly Application[];
  addHref: string;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
};

const t = messages.applications;

export function ApplicationList({ applications, addHref, timeZone }: ApplicationListProps) {
  const addLink = (
    <Button asChild className="self-start">
      <Link href={addHref}>{t.add}</Link>
    </Button>
  );

  if (applications.length === 0) {
    return (
      <section aria-labelledby="applications-empty-title" className="flex flex-col gap-3">
        <h2 id="applications-empty-title" className="text-lg font-medium">
          {t.empty.title}
        </h2>
        <p className="max-w-prose text-muted-foreground">{t.empty.description}</p>
        {addLink}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {addLink}
      <Table aria-label={t.title}>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t.columns.company}</TableHead>
            <TableHead scope="col">{t.columns.position}</TableHead>
            <TableHead scope="col">{t.columns.status}</TableHead>
            <TableHead scope="col">{t.columns.appliedAt}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id}>
              <TableCell className="font-medium">{application.companyName}</TableCell>
              <TableCell>{application.positionTitle}</TableCell>
              <TableCell>
                <StatusBadge status={application.status} />
              </TableCell>
              <TableCell>
                {application.appliedAt ? (
                  <time dateTime={isoDay(application.appliedAt, timeZone)}>
                    {formatDay(application.appliedAt, timeZone)}
                  </time>
                ) : (
                  <span className="text-muted-foreground">{t.notApplied}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
