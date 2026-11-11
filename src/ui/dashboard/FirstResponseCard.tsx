import type { FirstResponseSummary } from "@/domain/application/dashboard";
import { messages } from "@/ui/messages";
import { DashboardCard, hintClass, hugeNumberClass } from "./DashboardCard";

const t = messages.dashboard.firstResponse;

export function FirstResponseCard({
  firstResponse,
  span,
}: {
  firstResponse: FirstResponseSummary;
  span: string;
}) {
  const { median, answers } = firstResponse;
  return (
    <DashboardCard
      title={t.title}
      roomy
      aside={<span className={`${hintClass} font-mono`}>{span}</span>}
    >
      <div className="mt-auto flex flex-col gap-1.5">
        <span className={hintClass}>{t.median}</span>
        {median === null ? (
          <span className="text-[15px]">{t.none}</span>
        ) : (
          <>
            <span className="flex items-baseline gap-2">
              <span className={hugeNumberClass}>{median}</span>
              <span className="text-[15px]">{t.days(median)}</span>
            </span>
            <span className={hintClass}>{t.answers(answers)}</span>
          </>
        )}
      </div>
    </DashboardCard>
  );
}
