"use client";

import { useState } from "react";
import {
  type ChartLine,
  ChartSeries,
  ChartStep,
  chartSteps,
  type OverTime,
} from "@/domain/application/dashboard";
import type { CalendarDay } from "@/lib/calendar-day";
import { cn } from "@/lib/utils";
import { messages } from "@/ui/messages";
import {
  segmentedItemClass,
  segmentedItemOffClass,
  segmentedItemOnClass,
  segmentedTrackClass,
} from "@/ui/segmented";
import { dayLabel, dayTitle, monthLabel, monthTitle } from "./calendar-labels";
import { xLabelEvery, yScale, yTicks } from "./chart-scale";
import { DashboardCard, hintClass } from "./DashboardCard";

const t = messages.dashboard.overTime;

// How each line is drawn. The colours are the dashboard palette's.
const seriesStyle: Record<ChartSeries, { color: string; dash?: string }> = {
  [ChartSeries.Sent]: { color: "var(--series-sent)" },
  [ChartSeries.Screening]: { color: "var(--series-screening)", dash: "6 4" },
  [ChartSeries.Assignments]: { color: "var(--series-assignments)", dash: "10 3 2 3" },
  [ChartSeries.Interviews]: { color: "var(--series-interviews)" },
  [ChartSeries.Offers]: { color: "var(--series-offers)" },
  [ChartSeries.Rejections]: { color: "var(--series-rejections)" },
  [ChartSeries.Withdrawn]: { color: "var(--series-withdrawn)", dash: "2 4" },
};

// The drawing's own units; the SVG scales to the card's width.
const width = 1100;
const height = 280;
const left = 40;
const right = 12;
const top = 14;
const bottom = 30;
const plotWidth = width - left - right;
const plotHeight = height - top - bottom;

// Past this many points, thinner lines and no dots.
const densePoints = 60;

export type OverTimeCardProps = {
  overTime: OverTime;
  stepsOffered: Record<ChartStep, boolean>;
  /** Shown, in {@link chartSeries} order. */
  lines: readonly ChartSeries[];
  onStepChange: (step: ChartStep) => void;
  onLinesChange: (lines: ChartSeries[]) => void;
};

export function OverTimeCard({
  overTime,
  stepsOffered,
  lines,
  onStepChange,
  onLinesChange,
}: OverTimeCardProps) {
  const { step, buckets } = overTime;
  const shown = overTime.lines.filter(({ series }) => lines.includes(series));

  function toggle(series: ChartSeries) {
    onLinesChange(
      overTime.lines
        .map((line) => line.series)
        .filter((candidate) => (candidate === series) !== lines.includes(candidate)),
    );
  }

  return (
    <DashboardCard
      title={t.title}
      aside={
        <div role="group" aria-label={t.steps.label} className={segmentedTrackClass}>
          {chartSteps.map((candidate) => {
            const offered = stepsOffered[candidate];
            const on = candidate === step;
            return (
              <button
                key={candidate}
                type="button"
                aria-pressed={on}
                aria-disabled={!offered}
                title={offered ? undefined : t.stepTooLong[candidate]}
                onClick={() => offered && !on && onStepChange(candidate)}
                className={cn(
                  segmentedItemClass,
                  "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on ? segmentedItemOnClass : segmentedItemOffClass,
                  !offered && "cursor-not-allowed opacity-45 hover:text-muted-foreground",
                )}
              >
                {t.steps[candidate]}
              </button>
            );
          })}
        </div>
      }
    >
      <div
        role="group"
        aria-label={t.lines}
        className="flex flex-wrap items-center gap-x-5.5 gap-y-2"
      >
        {overTime.lines.map(({ series, total }) => (
          <label
            key={series}
            className="inline-flex cursor-pointer items-center gap-1.75 text-[13px]"
          >
            <input
              type="checkbox"
              checked={lines.includes(series)}
              onChange={() => toggle(series)}
              className="size-3.75 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <LineSample series={series} />
            {t.series[series]}
            <span className="font-mono text-xs text-muted-foreground">{total}</span>
          </label>
        ))}
      </div>
      <LineChart step={step} buckets={buckets} lines={shown} />
    </DashboardCard>
  );
}

function LineSample({ series }: { series: ChartSeries }) {
  return (
    <svg aria-hidden focusable="false" width="18" height="6" className="shrink-0">
      <line
        x1="1"
        y1="3"
        x2="17"
        y2="3"
        stroke={seriesStyle[series].color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={seriesStyle[series].dash}
      />
    </svg>
  );
}

function bucketLabel(bucket: CalendarDay, step: ChartStep): string {
  return step === ChartStep.Month ? monthLabel(bucket) : dayLabel(bucket);
}

function bucketTitle(bucket: CalendarDay, step: ChartStep): string {
  return step === ChartStep.Month ? monthTitle(bucket) : dayTitle(bucket);
}

const percent = (value: number, of: number) => `${((value / of) * 100).toFixed(2)}%`;

function LineChart({
  step,
  buckets,
  lines,
}: {
  step: ChartStep;
  buckets: readonly CalendarDay[];
  lines: readonly ChartLine[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const count = buckets.length;
  const scale = yScale(Math.max(0, ...lines.flatMap(({ values }) => values)));
  const dense = count > densePoints;
  const labelEvery = xLabelEvery(count);
  const xAt = (index: number) =>
    left + (count === 1 ? plotWidth / 2 : (plotWidth * (index + 0.5)) / count);
  const yAt = (value: number) => top + plotHeight - (value / scale.top) * plotHeight;
  const hoveredBucket = hovered === null ? undefined : buckets[hovered];

  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] items-stretch gap-1">
      <div className="relative">
        <span className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold whitespace-nowrap">
          {t.yAxis}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            role="img"
            aria-label={t.description(
              step,
              lines.map(({ series, total }) => ({ label: t.series[series], total })),
            )}
            className="block overflow-visible"
            onMouseLeave={() => setHovered(null)}
          >
            {yTicks(scale).map((tick) => (
              <line
                key={tick}
                x1={left}
                x2={width - right}
                y1={yAt(tick)}
                y2={yAt(tick)}
                stroke="var(--border)"
                strokeWidth="1"
              />
            ))}
            {buckets.map((bucket, index) => (
              <rect
                key={bucket}
                x={left + (plotWidth * index) / count}
                y={top}
                width={plotWidth / count}
                height={plotHeight}
                className={index === hovered ? "fill-accent" : "fill-transparent"}
                onMouseEnter={() => setHovered(index)}
              />
            ))}
            {lines.map(({ series, values }) => (
              <g key={series} pointerEvents="none">
                <path
                  d={values
                    .map((value, index) => `${index === 0 ? "M" : "L"}${xAt(index)} ${yAt(value)}`)
                    .join(" ")}
                  fill="none"
                  stroke={seriesStyle[series].color}
                  strokeWidth={dense ? 1.5 : 2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={seriesStyle[series].dash}
                />
                {!dense &&
                  values.map((value, index) => (
                    <circle
                      key={buckets[index]}
                      cx={xAt(index)}
                      cy={yAt(value)}
                      r="4"
                      fill={seriesStyle[series].color}
                      stroke="var(--card)"
                      strokeWidth="2"
                    />
                  ))}
              </g>
            ))}
          </svg>
          {yTicks(scale).map((tick) => (
            <span
              key={tick}
              aria-hidden
              className="absolute -translate-y-1/2 font-mono text-[11px] leading-none text-muted-foreground"
              style={{ right: percent(width - left + 8, width), top: percent(yAt(tick), height) }}
            >
              {tick}
            </span>
          ))}
          {buckets.map(
            (bucket, index) =>
              index % labelEvery === 0 && (
                <span
                  key={bucket}
                  aria-hidden
                  className="absolute -translate-x-1/2 font-mono text-[11px] leading-none whitespace-nowrap text-muted-foreground"
                  style={{
                    left: percent(xAt(index), width),
                    top: percent(top + plotHeight + 10, height),
                  }}
                >
                  {bucketLabel(bucket, step)}
                </span>
              ),
          )}
          {hovered !== null && hoveredBucket !== undefined && lines.length > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md"
              style={{ left: percent(xAt(hovered), width), top: percent(top, height) }}
            >
              <div className="mb-1 font-semibold">{bucketTitle(hoveredBucket, step)}</div>
              {lines.map(({ series, values }) => (
                <div key={series} className="flex items-center gap-1.5">
                  <LineSample series={series} />
                  {t.series[series]}
                  <span className="ml-auto pl-3 font-mono">{values[hovered]}</span>
                </div>
              ))}
            </div>
          )}
          {lines.length === 0 && (
            <p className={cn(hintClass, "absolute inset-x-0 top-[40%] text-center")}>{t.noLines}</p>
          )}
        </div>
        <span className="text-center text-xs font-semibold">{t.xAxis[step]}</span>
      </div>
      <table className="sr-only">
        <caption>{t.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.xAxis[step]}</th>
            {lines.map(({ series }) => (
              <th key={series} scope="col">
                {t.series[series]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket, index) => (
            <tr key={bucket}>
              <th scope="row">{bucketTitle(bucket, step)}</th>
              {lines.map(({ series, values }) => (
                <td key={series}>{values[index]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
