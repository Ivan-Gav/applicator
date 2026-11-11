"use client";

import { type ChangeEvent, useMemo, useState } from "react";
import {
  citiesListed,
  type DashboardApplication,
  type DashboardQuery,
  DashboardRange,
  dashboard,
  type Period,
  waitingNow,
} from "@/domain/application/dashboard";
import { dayInZone, isCalendarDay } from "@/lib/calendar-day";
import { SortDirection } from "@/lib/sort-direction";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/ui/hooks/use-hydrated";
import { filterChipClass, filterChipOffClass, filterChipOnClass } from "@/ui/FilterChip";
import { messages } from "@/ui/messages";
import { BreakdownCard } from "./BreakdownCard";
import { dayTitle } from "./calendar-labels";
import { FirstResponseCard } from "./FirstResponseCard";
import { OverTimeCard } from "./OverTimeCard";
import palette from "./palette.module.css";
import { SummaryCard } from "./SummaryCard";
import { WaitingCard } from "./WaitingCard";

const t = messages.dashboard;

export type DashboardViewProps = {
  /** Every application of the user, archived ones included, read once. */
  applications: readonly DashboardApplication[];
  query: DashboardQuery;
  onQueryChange: (query: DashboardQuery) => void;
  applicationHref: (id: string) => string;
  /** The applications list, showing what waits. */
  waitingListHref: string;
  // What "today" and "waiting" are counted up to.
  now: Date;
  // The viewer's zone; days and periods are its days.
  timeZone: string;
};

const ranges = [DashboardRange.All, DashboardRange.Last30Days, DashboardRange.Last90Days] as const;

// Cards in one row share a basis, so they are equal and fill the row; a card alone takes it all.
const rowClass = "flex flex-wrap items-stretch gap-5 [&>*]:min-w-0";

/** The dashboard, recomputed in the browser whenever the query changes. */
export function DashboardView({
  applications,
  query,
  onQueryChange,
  applicationHref,
  waitingListHref,
  now,
  timeZone,
}: DashboardViewProps) {
  const hydrated = useHydrated();
  const [waitingDirection, setWaitingDirection] = useState<SortDirection>(SortDirection.Ascending);
  const view = useMemo(
    () => dashboard(applications, query, now, timeZone),
    [applications, query, now, timeZone],
  );
  const waiting = useMemo(
    () => waitingNow(applications, now, waitingDirection),
    [applications, now, waitingDirection],
  );
  const span = t.period.span(dayTitle(view.period.from), dayTitle(view.period.to));
  const change = (changed: Partial<DashboardQuery>) => onQueryChange({ ...query, ...changed });

  return (
    // Every control waits for hydration: a click before it would be lost.
    <fieldset disabled={!hydrated} className={cn(palette.palette, "flex min-w-0 flex-col gap-5")}>
      <PeriodBar
        query={query}
        period={view.period}
        today={dayInZone(timeZone)(now)}
        onChange={change}
      />
      <div className={cn(rowClass, "[&>*]:basis-105 [&>*]:grow")}>
        <SummaryCard summary={view.summary} span={span} showsShares={view.showsShares} />
        <FirstResponseCard firstResponse={view.firstResponse} span={span} />
      </div>
      <OverTimeCard
        overTime={view.overTime}
        stepsOffered={view.stepsOffered}
        lines={query.lines}
        onStepChange={(step) => change({ step })}
        onLinesChange={(lines) => change({ lines })}
      />
      <div className={cn(rowClass, "[&>*]:basis-75 [&>*]:grow")}>
        <WaitingCard
          waiting={waiting}
          direction={waitingDirection}
          onReverse={() =>
            setWaitingDirection(
              waitingDirection === SortDirection.Ascending
                ? SortDirection.Descending
                : SortDirection.Ascending,
            )
          }
          applicationHref={applicationHref}
          allHref={waitingListHref}
          now={now}
          timeZone={timeZone}
        />
        <BreakdownCard
          title={t.breakdown.bySource}
          word={t.breakdown.sources}
          breakdown={view.bySource}
          sent={view.summary.sent}
          showsShares={view.showsShares}
        />
        <BreakdownCard
          title={t.breakdown.byCountry}
          word={t.breakdown.countries}
          breakdown={view.byCountry}
          sent={view.summary.sent}
          showsShares={view.showsShares}
        />
      </div>
      <BreakdownCard
        title={t.breakdown.byCity}
        word={t.breakdown.cities}
        breakdown={view.byCity}
        sent={view.summary.sent}
        showsShares={view.showsShares}
        cap={citiesListed}
        twoColumns
      />
    </fieldset>
  );
}

const dateInputClass =
  "h-7.5 rounded-[3px] border border-input bg-card px-2 font-mono text-[13px] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function PeriodBar({
  query,
  period,
  today,
  onChange,
}: {
  query: DashboardQuery;
  period: Period;
  today: string;
  onChange: (changed: Partial<DashboardQuery>) => void;
}) {
  // Editing either end makes the period custom, keeping the other end as shown.
  const edit = (end: "from" | "to") => (event: ChangeEvent<HTMLInputElement>) => {
    const day = event.target.value;
    if (isCalendarDay(day)) {
      onChange({ range: DashboardRange.Custom, ...period, [end]: day });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t.period.label} className="flex flex-wrap items-center gap-2">
        {ranges.map((range) => {
          const on = query.range === range;
          return (
            <button
              key={range}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ range, from: null, to: null })}
              className={cn(filterChipClass, on ? filterChipOnClass : filterChipOffClass)}
            >
              {t.period.ranges[range]}
            </button>
          );
        })}
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <label className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {t.period.from}
          <input
            type="date"
            value={period.from}
            max={today}
            onChange={edit("from")}
            className={dateInputClass}
          />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {t.period.to}
          <input
            type="date"
            value={period.to}
            max={today}
            onChange={edit("to")}
            className={dateInputClass}
          />
        </label>
      </div>
      <label className="ml-auto inline-flex cursor-pointer items-center gap-1.75 text-[13px]">
        <input
          type="checkbox"
          checked={query.includeArchived}
          onChange={(event) => onChange({ includeArchived: event.target.checked })}
          className="size-3.75 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        {t.period.includeArchived}
      </label>
    </div>
  );
}
