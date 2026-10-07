import type { StatusEvent } from "@/domain/application/model";
import { formatDay, isoDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { StatusSwatch } from "./StatusSwatch";

export type StatusHistoryProps = {
  /** Oldest first. */
  events: readonly StatusEvent[];
  // The viewer's zone; dates show the day they fall on there.
  timeZone: string;
};

const t = messages.applications;

/** A chain of steps, oldest first, that wraps onto further lines. */
export function StatusHistory({ events, timeZone }: StatusHistoryProps) {
  return (
    <section aria-labelledby="status-history-title" className="flex flex-col gap-3">
      <h2 id="status-history-title" className="text-xl font-medium">
        {t.page.history}
      </h2>
      <ol className="flex flex-wrap items-center gap-y-3 text-sm">
        {events.map((event, index) => (
          // The journal is append-only and a status may repeat at the same instant.
          <li key={index} className="flex items-center">
            {index > 0 && <span aria-hidden className="mx-3 h-px w-6 bg-input" />}
            <span className="flex items-center gap-2">
              <StatusSwatch status={event.status} />
              <span className="font-semibold">{t.status[event.status]}</span>
              <time
                dateTime={isoDay(event.occurredAt, timeZone)}
                className="font-mono text-[13px] text-muted-foreground"
              >
                {formatDay(event.occurredAt, timeZone)}
              </time>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
