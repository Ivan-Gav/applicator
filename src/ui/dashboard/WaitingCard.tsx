import Link from "next/link";
import type { Waiting } from "@/domain/application/dashboard";
import { longWaitDays, waitsLong } from "@/domain/application/list";
import { daysWithoutResponse } from "@/domain/application/rules";
import { formatShortDay, isoDay } from "@/lib/date";
import type { SortDirection } from "@/lib/sort-direction";
import { cn } from "@/lib/utils";
import { StatusSwatch } from "@/ui/applications/StatusSwatch";
import { WaitingDays } from "@/ui/applications/WaitingDays";
import { messages } from "@/ui/messages";
import { DashboardCard, Figure, hintClass } from "./DashboardCard";

const t = messages.dashboard.waiting;

/** Rows the card lists; the rest are on the applications list. */
export const waitingRowsShown = 6;

export type WaitingCardProps = {
  waiting: Waiting;
  direction: SortDirection;
  onReverse: () => void;
  applicationHref: (id: string) => string;
  /** The applications list, showing what waits. */
  allHref: string;
  now: Date;
  timeZone: string;
};

export function WaitingCard({
  waiting,
  direction,
  onReverse,
  applicationHref,
  allHref,
  now,
  timeZone,
}: WaitingCardProps) {
  const { open, waitingLong } = waiting;
  return (
    <DashboardCard
      title={t.title}
      className="gap-2.5"
      aside={
        <button
          type="button"
          onClick={onReverse}
          aria-label={t.sortLabel[direction]}
          className="inline-flex h-6.5 items-center gap-1.5 rounded-xs px-1 text-[13px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t.sortButton}
          <span aria-hidden className="text-[10px]">
            {messages.list.sortIndicator[direction]}
          </span>
        </button>
      }
    >
      <div className="flex gap-8 pt-1 pb-1.5">
        <Figure value={open.length} word={t.open} />
        <Figure value={waitingLong} word={t.long(longWaitDays)} muted={waitingLong === 0} />
      </div>
      {open.length === 0 ? (
        <p className={hintClass}>{t.none}</p>
      ) : (
        <ul className="border-t">
          {open.slice(0, waitingRowsShown).map((application) => (
            <li key={application.id} className="border-b">
              <Link
                href={applicationHref(application.id)}
                aria-label={t.rowLabel(application)}
                className="-mx-2 grid min-h-8.5 grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[3px] px-2 py-1 outline-none hover:bg-accent hover:no-underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {application.appliedAt ? (
                  <time
                    dateTime={isoDay(application.appliedAt, timeZone)}
                    className="font-mono text-xs whitespace-nowrap text-muted-foreground"
                  >
                    {formatShortDay(application.appliedAt, timeZone, now)}
                  </time>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {messages.applications.waiting.none}
                  </span>
                )}
                <span className="flex min-w-0 items-center gap-1.75">
                  <StatusSwatch status={application.status} />
                  <span className="truncate text-sm font-semibold">{application.companyName}</span>
                </span>
                <span
                  className={cn(
                    "text-right font-mono text-[13px] whitespace-nowrap",
                    waitsLong(application, now)
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <WaitingDays days={daysWithoutResponse(application, now)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open.length > waitingRowsShown && (
        <Link
          href={allHref}
          className="mt-auto self-start text-[13px] font-semibold underline underline-offset-3"
        >
          {t.all(open.length)}
        </Link>
      )}
    </DashboardCard>
  );
}
