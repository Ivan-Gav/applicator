import type { Application } from "@/domain/application/model";
import { formatDay, isoDay } from "@/lib/date";
import { TableCell, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import { type ApplicationActionHandlers, ApplicationActions } from "./ApplicationActions";
import { StatusBadge } from "./StatusBadge";

export type ApplicationRowProps = {
  // The whole record, not only what the row shows.
  application: Application;
  href: string;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  actions: ApplicationActionHandlers;
};

const t = messages.applications;

export function ApplicationRow({ application, href, timeZone, actions }: ApplicationRowProps) {
  return (
    <TableRow>
      <TableCell>
        {application.appliedAt ? (
          <time dateTime={isoDay(application.appliedAt, timeZone)}>
            {formatDay(application.appliedAt, timeZone)}
          </time>
        ) : (
          <span className="text-muted-foreground">{t.notApplied}</span>
        )}
      </TableCell>
      <TableCell className="font-medium">{application.companyName}</TableCell>
      <TableCell>{application.positionTitle}</TableCell>
      <TableCell>{application.city}</TableCell>
      <TableCell>
        <StatusBadge status={application.status} />
      </TableCell>
      <TableCell>
        <ApplicationActions application={application} editHref={href} actions={actions} />
      </TableCell>
    </TableRow>
  );
}
