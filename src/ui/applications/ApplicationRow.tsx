import Link from "next/link";
import type { Application } from "@/domain/application/model";
import { daysWithoutResponse, isClosedStatus } from "@/domain/application/rules";
import { formatDay, isoDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import { TableCell, TableRow } from "@/ui/kit/table";
import { messages } from "@/ui/messages";
import { type ApplicationActionHandlers, ApplicationActions } from "./ApplicationActions";
import { type ChangeStatus, StatusTag } from "./StatusTag";
import { WaitingDays } from "./WaitingDays";

export type ApplicationRowActions = ApplicationActionHandlers & { changeStatus: ChangeStatus };

export type ApplicationRowProps = {
  // The whole record, not only what the row shows.
  application: Application;
  href: string;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  // What "waiting" is counted up to.
  now: Date;
  actions: ApplicationRowActions;
};

const t = messages.applications;
const secondLine = "block text-[13px] text-muted-foreground";
// Lifts a control above the link stretched over the row.
const aboveRowLink = "relative z-10";

export function ApplicationRow({ application, href, timeZone, now, actions }: ApplicationRowProps) {
  const workMode = application.workMode && t.workMode[application.workMode];

  return (
    <TableRow className="relative hover:bg-accent">
      <TableCell>
        {application.appliedAt ? (
          <time
            dateTime={isoDay(application.appliedAt, timeZone)}
            className="font-mono text-[13px]"
          >
            {formatDay(application.appliedAt, timeZone)}
          </time>
        ) : (
          <span className="text-muted-foreground">{t.notApplied}</span>
        )}
      </TableCell>
      <TableCell className="min-w-65 whitespace-normal">
        {/* The one link of the row; its ::after covers the whole row. */}
        <Link
          href={href}
          aria-label={t.name(application)}
          className="block outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
        >
          <span
            className={cn(
              "block font-semibold",
              isClosedStatus(application.status) && "text-muted-foreground",
            )}
          >
            {application.companyName}
          </span>
          <span className={secondLine}>{application.positionTitle}</span>
        </Link>
      </TableCell>
      <TableCell>
        {application.city}
        {workMode && <span className={secondLine}>{workMode}</span>}
      </TableCell>
      <TableCell>
        <div className={cn(aboveRowLink, "w-fit")}>
          <StatusTag application={application} changeStatus={actions.changeStatus} />
        </div>
      </TableCell>
      <TableCell className="text-right font-mono text-[13px]">
        <WaitingDays days={daysWithoutResponse(application, now)} />
      </TableCell>
      <TableCell>
        <div className={aboveRowLink}>
          <ApplicationActions application={application} actions={actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}
