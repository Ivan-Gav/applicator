import { messages } from "@/ui/messages";

const t = messages.applications.waiting;

/**
 * Days without a response, as `daysWithoutResponse` counts them; `null` when
 * not waiting. Short ("14 d") where columns are tight, spelled out ("14 days") where there is room.
 */
export function WaitingDays({
  days,
  spelledOut = false,
}: {
  days: number | null;
  spelledOut?: boolean;
}) {
  if (spelledOut && days !== null) {
    return t.daysSpoken(days);
  }
  return (
    <>
      <span aria-hidden>{days === null ? t.none : t.days(days)}</span>
      <span className="sr-only">{days === null ? t.noneSpoken : t.daysSpoken(days)}</span>
    </>
  );
}
