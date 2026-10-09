import type { ReactNode } from "react";
import type { Application } from "@/domain/application/model";
import { daysWithoutResponse } from "@/domain/application/rules";
import { formatDay, isoDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { WaitingDays } from "./WaitingDays";

export type ApplicationFactsProps = {
  application: Application;
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
  // What "waiting" is counted up to.
  now: Date;
};

const t = messages.applications;

/** The dates of an application, each value under its label. */
export function ApplicationFacts({ application, timeZone, now }: ApplicationFactsProps) {
  const day = (instant: Date) => (
    <time dateTime={isoDay(instant, timeZone)} className="font-mono">
      {formatDay(instant, timeZone)}
    </time>
  );

  return (
    <dl className="flex flex-wrap gap-x-7 gap-y-3">
      <Fact label={t.page.appliedAt}>
        {application.appliedAt ? day(application.appliedAt) : t.notApplied}
      </Fact>
      <Fact label={t.page.lastContactAt}>
        {application.lastContactAt ? day(application.lastContactAt) : t.page.noContact}
      </Fact>
      <Fact label={t.page.waiting}>
        <span className="font-mono">
          <WaitingDays days={daysWithoutResponse(application, now)} spelledOut />
        </span>
      </Fact>
      {application.archivedAt && (
        <Fact label={t.page.archivedAt}>{day(application.archivedAt)}</Fact>
      )}
    </dl>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
