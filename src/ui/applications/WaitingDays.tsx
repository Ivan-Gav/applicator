import { messages } from "@/ui/messages";

const t = messages.applications.waiting;

/** Days without a response, as `daysWithoutResponse` counts them; `null` when not waiting. */
export function WaitingDays({ days }: { days: number | null }) {
  return (
    <>
      <span aria-hidden>{days === null ? t.none : t.days(days)}</span>
      <span className="sr-only">{days === null ? t.noneSpoken : t.daysSpoken(days)}</span>
    </>
  );
}
