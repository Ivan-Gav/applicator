"use client";

import { useState } from "react";
import { type Breakdown, type BreakdownRow, cappedRows } from "@/domain/application/dashboard";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import { DashboardCard, Figure } from "./DashboardCard";
import palette from "./palette.module.css";

const t = messages.dashboard.breakdown;

export type BreakdownCardProps = {
  title: string;
  /** The word under the number of distinct values: "sources". */
  word: (count: number) => string;
  breakdown: Breakdown;
  /** Applications sent in the period, which shares are of. */
  sent: number;
  showsShares: boolean;
  /** Lists this many values, then the rest summed, until shown all. Without it, every value. */
  cap?: number;
  /** Rows in two columns, for a card as wide as the page. */
  twoColumns?: boolean;
};

export function BreakdownCard({
  title,
  word,
  breakdown,
  sent,
  showsShares,
  cap,
  twoColumns = false,
}: BreakdownCardProps) {
  const [expanded, setExpanded] = useState(false);
  const capped =
    cap === undefined ? { shown: breakdown.rows, other: null } : cappedRows(breakdown, cap, sent);
  const shown = expanded ? { shown: breakdown.rows, other: null } : capped;
  const bar = (count: number) => Math.max(2, (count / Math.max(1, breakdown.largest)) * 100);

  return (
    <DashboardCard title={title} className="gap-3">
      <div className="pt-1 pb-1.5">
        <Figure value={breakdown.distinct} word={word(breakdown.distinct)} />
      </div>
      {(breakdown.rows.length > 0 || breakdown.notSpecified) && (
        <ul className={twoColumns ? "columns-[340px_2] gap-x-12" : "flex flex-col"}>
          {shown.shown.map((row) => (
            <Row key={row.label} row={row} width={bar(row.count)} showsShare={showsShares} />
          ))}
          {shown.other && (
            <Row
              row={{
                label: t.otherCities(shown.other.values),
                count: shown.other.count,
                share: shown.other.share,
              }}
              width={bar(shown.other.count)}
              showsShare={showsShares}
              rest
            />
          )}
          {breakdown.notSpecified && (
            <Row
              row={{ ...breakdown.notSpecified, label: t.notSpecified }}
              width={bar(breakdown.notSpecified.count)}
              showsShare={showsShares}
              rest
            />
          )}
        </ul>
      )}
      {capped.other && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="self-start rounded-xs py-0.5 text-[13px] font-semibold underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {expanded ? t.showFewer : t.showAll(breakdown.distinct)}
        </button>
      )}
    </DashboardCard>
  );
}

function Row({
  row,
  width,
  showsShare,
  rest = false,
}: {
  row: BreakdownRow;
  width: number;
  showsShare: boolean;
  /** "Other" or "Not specified": muted and hatched. */
  rest?: boolean;
}) {
  return (
    <li
      title={t.rowTitle(row.label, row.count)}
      className="mb-1 grid min-h-7 break-inside-avoid grid-cols-[minmax(0,128px)_minmax(0,1fr)_30px_40px] items-center gap-x-2.5"
    >
      <span className={cn("truncate text-sm", rest && "text-muted-foreground")}>{row.label}</span>
      <span className="flex">
        <span
          className={cn("h-2.5 rounded-r-[3px]", rest ? palette.hatched : "bg-(--series-sent)")}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="text-right font-mono text-[13px]">{row.count}</span>
      <span className="text-right font-mono text-xs text-muted-foreground">
        {showsShare && row.share !== null ? messages.dashboard.summary.share(row.share) : null}
      </span>
    </li>
  );
}
