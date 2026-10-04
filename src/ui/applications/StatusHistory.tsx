import type { StatusEvent } from "@/domain/application/model";
import { formatDay, isoDay } from "@/lib/date";
import { messages } from "@/ui/messages";

export type StatusHistoryProps = {
  /** Oldest first. */
  events: readonly StatusEvent[];
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
};

const t = messages.applications;

export function StatusHistory({ events, timeZone }: StatusHistoryProps) {
  return (
    <section aria-labelledby="status-history-title" className="flex flex-col gap-3">
      <h2 id="status-history-title" className="text-lg font-medium">
        {t.page.history}
      </h2>
      <ol className="flex flex-col gap-2 border-l pl-4">
        {events.map((event, index) => (
          // The journal is append-only and a status may repeat at the same instant.
          <li key={index} className="flex flex-wrap items-baseline gap-x-3 text-sm">
            <span className="font-medium">{t.status[event.status]}</span>
            <time dateTime={isoDay(event.occurredAt, timeZone)} className="text-muted-foreground">
              {formatDay(event.occurredAt, timeZone)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
