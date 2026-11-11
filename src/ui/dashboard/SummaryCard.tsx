import type { StatusTally, Summary } from "@/domain/application/dashboard";
import { messages } from "@/ui/messages";
import { DashboardCard, hintClass, hugeNumberClass } from "./DashboardCard";
import styles from "./StatusBox.module.css";

const t = messages.dashboard.summary;
const statusLabel = messages.applications.status;

export type SummaryCardProps = {
  summary: Summary;
  /** The period, as shown beside the title. */
  span: string;
  showsShares: boolean;
};

export function SummaryCard({ summary, span, showsShares }: SummaryCardProps) {
  return (
    <DashboardCard
      title={t.title}
      roomy
      aside={<span className={`${hintClass} font-mono`}>{span}</span>}
    >
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2.5">
        <span className={hugeNumberClass}>{summary.total}</span>
        <span className="text-[15px]">{t.applications(summary.total)}</span>
        <span className={hintClass}>{t.sentAndDrafts(summary.sent, summary.drafts)}</span>
      </div>
      <ul
        aria-label={t.statuses}
        className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5"
      >
        {summary.statuses.map((tally) => (
          <StatusBox key={tally.status} tally={tally} showsShare={showsShares} />
        ))}
      </ul>
    </DashboardCard>
  );
}

function StatusBox({ tally, showsShare }: { tally: StatusTally; showsShare: boolean }) {
  const { status, count, share } = tally;
  return (
    <li data-status={status} className={styles.box}>
      {status === "draft" && <DashedCorners />}
      <span className="text-xs leading-none">{statusLabel[status]}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-[34px] leading-none font-semibold">{count}</span>
        {showsShare && share !== null && (
          <span className="font-mono text-xs font-normal">{t.share(share)}</span>
        )}
      </span>
    </li>
  );
}

// The clipped corners cut the dashed outline; these carry it across them.
function DashedCorners() {
  const line = {
    stroke: "var(--tag-border)",
    strokeWidth: 1.5,
    strokeDasharray: "3 2",
  };
  return (
    <>
      <svg aria-hidden focusable="false" className={`${styles.corner} ${styles.topLeft}`}>
        <line x1="0" y1="7.5" x2="7.5" y2="0" {...line} />
      </svg>
      <svg aria-hidden focusable="false" className={`${styles.corner} ${styles.bottomRight}`}>
        <line x1="0.5" y1="8" x2="8" y2="0.5" {...line} />
      </svg>
    </>
  );
}
