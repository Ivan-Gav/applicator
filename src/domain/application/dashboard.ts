import {
  addDays,
  addMonths,
  type CalendarDay,
  dayInZone,
  firstOfMonth,
  laterDay,
  earlierDay,
  mondayOf,
} from "@/lib/calendar-day";
import { wholeDaysBetween } from "@/lib/date";
import { roundedMedian } from "@/lib/median";
import { normalizeForSearch } from "@/lib/normalize-for-search";
import { SortDirection } from "@/lib/sort-direction";
import { waitsLong } from "./list";
import {
  type Application,
  type ApplicationStatus,
  type ApplicationWithHistory,
  applicationStatuses,
  type StatusEvent,
} from "./model";

/** What the dashboard reads of one application. */
export type DashboardApplication = Pick<
  Application,
  | "id"
  | "companyName"
  | "positionTitle"
  | "status"
  | "appliedAt"
  | "lastContactAt"
  | "archivedAt"
  | "source"
  | "city"
  | "country"
> & {
  /** Oldest first. */
  history: readonly StatusEvent[];
};

export function dashboardApplication({
  application,
  history,
}: ApplicationWithHistory): DashboardApplication {
  const {
    id,
    companyName,
    positionTitle,
    status,
    appliedAt,
    lastContactAt,
    archivedAt,
    source,
    city,
    country,
  } = application;
  return {
    id,
    companyName,
    positionTitle,
    status,
    appliedAt,
    lastContactAt,
    archivedAt,
    source,
    city,
    country,
    history,
  };
}

// The period the dashboard covers.
export const DashboardRange = {
  All: "all",
  Last30Days: "30",
  Last90Days: "90",
  Custom: "custom",
} as const;
export type DashboardRange = (typeof DashboardRange)[keyof typeof DashboardRange];

// The width of one point on the chart.
export const ChartStep = {
  Day: "day",
  Week: "week",
  Month: "month",
} as const;
export type ChartStep = (typeof ChartStep)[keyof typeof ChartStep];

/** In the order the steps are offered. */
export const chartSteps: readonly ChartStep[] = [ChartStep.Day, ChartStep.Week, ChartStep.Month];

// A line of the chart: what it counts.
export const ChartSeries = {
  Sent: "sent",
  Screening: "scr",
  Assignments: "asg",
  Interviews: "iv",
  Offers: "off",
  Rejections: "rej",
  Withdrawn: "wd",
} as const;
export type ChartSeries = (typeof ChartSeries)[keyof typeof ChartSeries];

/** In the order the lines are offered. */
export const chartSeries: readonly ChartSeries[] = [
  ChartSeries.Sent,
  ChartSeries.Screening,
  ChartSeries.Assignments,
  ChartSeries.Interviews,
  ChartSeries.Offers,
  ChartSeries.Rejections,
  ChartSeries.Withdrawn,
];

// Every series but Sent counts each entry into one status.
const seriesStatus = {
  [ChartSeries.Screening]: "screening",
  [ChartSeries.Assignments]: "assignment",
  [ChartSeries.Interviews]: "interview",
  [ChartSeries.Offers]: "offer",
  [ChartSeries.Rejections]: "rejected",
  [ChartSeries.Withdrawn]: "withdrawn",
} as const satisfies Record<Exclude<ChartSeries, typeof ChartSeries.Sent>, ApplicationStatus>;

/** What the dashboard is asked to show. */
export type DashboardQuery = {
  range: DashboardRange;
  /** The custom period's days; for other ranges, ignored. */
  from: CalendarDay | null;
  to: CalendarDay | null;
  /** The step asked for; {@link effectiveStep} says which one is shown. */
  step: ChartStep;
  lines: readonly ChartSeries[];
  includeArchived: boolean;
};

export const defaultDashboardQuery: DashboardQuery = {
  range: DashboardRange.All,
  from: null,
  to: null,
  step: ChartStep.Week,
  lines: [ChartSeries.Sent, ChartSeries.Interviews, ChartSeries.Rejections],
  includeArchived: false,
};

/** Statuses an employer moves an application to: any of them is an answer. Withdrawn is not. */
export const responseStatuses: readonly ApplicationStatus[] = [
  "screening",
  "assignment",
  "interview",
  "offer",
  "rejected",
];

/** Statuses in which the application waits on the employer. */
export const openStatuses: readonly ApplicationStatus[] = [
  "applied",
  "screening",
  "assignment",
  "interview",
];

/** Below this many applications sent in the period, no percentages are shown. */
export const minimumForShares = 20;

/** How many cities the city breakdown lists before grouping the rest. */
export const citiesListed = 10;

/** Both days included. */
export type Period = {
  from: CalendarDay;
  to: CalendarDay;
};

function counts(application: DashboardApplication, includeArchived: boolean): boolean {
  return includeArchived || application.archivedAt === null;
}

/**
 * The days the query covers, in `timeZone`. All time runs from the first day
 * an application was sent to today. A custom period is kept within all time
 * and put in order; a missing end takes all time's.
 */
export function dashboardPeriod(
  applications: readonly DashboardApplication[],
  query: DashboardQuery,
  now: Date,
  timeZone: string,
): Period {
  const dayOf = dayInZone(timeZone);
  const today = dayOf(now);
  const sentDays = applications
    .filter((application) => counts(application, query.includeArchived))
    .flatMap(({ appliedAt }) => (appliedAt ? [dayOf(appliedAt)] : []));
  const firstSent = sentDays.reduce(earlierDay, today);

  switch (query.range) {
    case DashboardRange.All:
      return { from: firstSent, to: today };
    case DashboardRange.Last30Days:
      return { from: addDays(today, -29), to: today };
    case DashboardRange.Last90Days:
      return { from: addDays(today, -89), to: today };
    case DashboardRange.Custom: {
      const within = (day: CalendarDay) => laterDay(firstSent, earlierDay(day, today));
      const from = within(query.from ?? firstSent);
      const to = within(query.to ?? today);
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

function inPeriod(day: CalendarDay, period: Period): boolean {
  return period.from <= day && day <= period.to;
}

/** The first move to a status the employer makes, from the status history. */
export function firstResponse(history: readonly StatusEvent[]): StatusEvent | null {
  return history.find(({ status }) => responseStatuses.includes(status)) ?? null;
}

/** Whole days from sending to the first response; `null` for one not sent or not answered. */
export function daysToFirstResponse(
  application: Pick<DashboardApplication, "appliedAt" | "history">,
): number | null {
  const response = firstResponse(application.history);
  if (application.appliedAt === null || response === null) {
    return null;
  }
  return Math.max(0, wholeDaysBetween(application.appliedAt, response.occurredAt));
}

/** When each event a series counts happened; only a sent application has any. */
export function seriesEvents(application: DashboardApplication, series: ChartSeries): Date[] {
  if (application.appliedAt === null) {
    return [];
  }
  if (series === ChartSeries.Sent) {
    return [application.appliedAt];
  }
  const status = seriesStatus[series];
  return application.history
    .filter((event) => event.status === status)
    .map(({ occurredAt }) => occurredAt);
}

/** The first day of the bucket holding `day`; weeks start on Monday. */
export function bucketOf(day: CalendarDay, step: ChartStep): CalendarDay {
  switch (step) {
    case ChartStep.Day:
      return day;
    case ChartStep.Week:
      return mondayOf(day);
    case ChartStep.Month:
      return firstOfMonth(day);
  }
}

function nextBucket(bucket: CalendarDay, step: ChartStep): CalendarDay {
  switch (step) {
    case ChartStep.Day:
      return addDays(bucket, 1);
    case ChartStep.Week:
      return addDays(bucket, 7);
    case ChartStep.Month:
      return addMonths(bucket, 1);
  }
}

/** The first day of every bucket the period touches, in order. */
export function chartBuckets(period: Period, step: ChartStep): CalendarDay[] {
  const buckets: CalendarDay[] = [];
  for (
    let bucket = bucketOf(period.from, step);
    bucket <= period.to;
    bucket = nextBucket(bucket, step)
  ) {
    buckets.push(bucket);
  }
  return buckets;
}

/** A step is offered unless the whole period fits in one of its buckets. */
export function stepFits(period: Period, step: ChartStep): boolean {
  return bucketOf(period.from, step) !== bucketOf(period.to, step);
}

/** The step asked for, or the first of week, day, month that fits; day for a single day. */
export function effectiveStep(period: Period, asked: ChartStep): ChartStep {
  if (stepFits(period, asked)) {
    return asked;
  }
  return (
    [ChartStep.Week, ChartStep.Day, ChartStep.Month].find((step) => stepFits(period, step)) ??
    ChartStep.Day
  );
}

/** One line of the chart: a count per bucket, and their sum. */
export type ChartLine = {
  series: ChartSeries;
  values: number[];
  total: number;
};

export type OverTime = {
  step: ChartStep;
  /** The first day of each bucket. */
  buckets: CalendarDay[];
  /** Every series, in {@link chartSeries} order; the query picks which are shown. */
  lines: ChartLine[];
};

/** Events counted by their own day in the period, whenever the application was sent. */
export function overTime(
  applications: readonly DashboardApplication[],
  period: Period,
  step: ChartStep,
  timeZone: string,
): OverTime {
  const dayOf = dayInZone(timeZone);
  const buckets = chartBuckets(period, step);
  const index = new Map(buckets.map((bucket, position) => [bucket, position]));
  const lines = chartSeries.map((series) => {
    const values = buckets.map(() => 0);
    for (const application of applications) {
      for (const at of seriesEvents(application, series)) {
        const day = dayOf(at);
        const position = index.get(bucketOf(day, step));
        if (inPeriod(day, period) && position !== undefined) {
          values[position] = (values[position] ?? 0) + 1;
        }
      }
    }
    return { series, values, total: values.reduce((sum, value) => sum + value, 0) };
  });
  return { step, buckets, lines };
}

/** A percentage of the applications sent, or `null` when too few were sent to show one. */
export function shareOf(count: number, sent: number): number | null {
  return sent < minimumForShares ? null : Math.round((count * 100) / sent);
}

export type StatusTally = {
  status: ApplicationStatus;
  count: number;
  /** Of the applications sent in the period; never for drafts. */
  share: number | null;
};

export type Summary = {
  /** Sent in the period, and drafts. */
  total: number;
  sent: number;
  /** Never sent, so in no period; counted whatever the period. */
  drafts: number;
  /** Every status in process order, zeros included, by current status. */
  statuses: StatusTally[];
};

function isUnsentDraft(application: DashboardApplication): boolean {
  return application.status === "draft" && application.appliedAt === null;
}

export function summary(
  sent: readonly DashboardApplication[],
  drafts: readonly DashboardApplication[],
): Summary {
  return {
    total: sent.length + drafts.length,
    sent: sent.length,
    drafts: drafts.length,
    statuses: applicationStatuses.map((status) => {
      const count = sent.filter((application) => application.status === status).length;
      return status === "draft"
        ? { status, count: count + drafts.length, share: null }
        : { status, count, share: shareOf(count, sent.length) };
    }),
  };
}

export type FirstResponseSummary = {
  /** Whole days; `null` when no application sent in the period has an answer. */
  median: number | null;
  answers: number;
};

export function firstResponseSummary(sent: readonly DashboardApplication[]): FirstResponseSummary {
  const days = sent.flatMap((application) => {
    const elapsed = daysToFirstResponse(application);
    return elapsed === null ? [] : [elapsed];
  });
  return { median: roundedMedian(days), answers: days.length };
}

export type BreakdownRow = {
  /** As first met; spellings differing only in case or accents count as one. */
  label: string;
  count: number;
  share: number | null;
};

export type Breakdown = {
  /** Most applications first, then alphabetically. */
  rows: BreakdownRow[];
  /** Applications with no value, listed last; `null` when every one has a value. */
  notSpecified: BreakdownRow | null;
  /** How many distinct values; not specified is not one. */
  distinct: number;
  /** The largest count of any row, not specified included; bars are drawn relative to it. */
  largest: number;
};

export type BreakdownField = "source" | "country" | "city";

/** How the applications sent split by one field. */
export function breakdown(sent: readonly DashboardApplication[], field: BreakdownField): Breakdown {
  const groups = new Map<string, { label: string; count: number }>();
  let blank = 0;
  for (const application of sent) {
    const value = application[field]?.trim() ?? "";
    if (value === "") {
      blank += 1;
      continue;
    }
    const key = normalizeForSearch(value);
    const group = groups.get(key) ?? { label: value, count: 0 };
    groups.set(key, { ...group, count: group.count + 1 });
  }
  const row = (label: string, count: number) => ({
    label,
    count,
    share: shareOf(count, sent.length),
  });
  const rows = [...groups.values()]
    .sort(
      (a, b) =>
        b.count - a.count || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    )
    .map(({ label, count }) => row(label, count));
  return {
    rows,
    notSpecified: blank > 0 ? row("", blank) : null,
    distinct: rows.length,
    largest: Math.max(blank, ...rows.map(({ count }) => count), 0),
  };
}

export type CappedRows = {
  shown: BreakdownRow[];
  /** The values past the cap, summed; `null` when nothing is grouped. */
  other: { values: number; count: number; share: number | null } | null;
};

/**
 * The first `cap` rows and the rest summed. Grouping a single value would
 * hide it to save no space, so the rest is grouped only when it holds two or more.
 */
export function cappedRows(breakdown: Breakdown, cap: number, sent: number): CappedRows {
  if (breakdown.rows.length <= cap + 1) {
    return { shown: breakdown.rows, other: null };
  }
  const rest = breakdown.rows.slice(cap);
  const count = rest.reduce((sum, row) => sum + row.count, 0);
  return {
    shown: breakdown.rows.slice(0, cap),
    other: { values: rest.length, count, share: shareOf(count, sent) },
  };
}

export type Waiting = {
  /** Active applications in an open status, by the day sent; unsent ones last. */
  open: DashboardApplication[];
  /** Of those, how many wait long, as {@link waitsLong} judges. */
  waitingLong: number;
};

/**
 * What waits on an answer now, whatever the period. Archived applications
 * are put away, so none of them waits, as on the applications list.
 */
export function waitingNow(
  applications: readonly DashboardApplication[],
  now: Date,
  direction: SortDirection,
): Waiting {
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  const open = applications
    .filter(
      (application) => application.archivedAt === null && openStatuses.includes(application.status),
    )
    .sort((a, b) => {
      if (a.appliedAt === null || b.appliedAt === null) {
        return a.appliedAt === b.appliedAt ? 0 : a.appliedAt === null ? 1 : -1;
      }
      return sign * (a.appliedAt.getTime() - b.appliedAt.getTime());
    });
  return { open, waitingLong: open.filter((application) => waitsLong(application, now)).length };
}

export type Dashboard = {
  period: Period;
  /** The step shown: the one asked for unless the period fits in one of its buckets. */
  step: ChartStep;
  /** Whether each step is offered for the period. */
  stepsOffered: Record<ChartStep, boolean>;
  /** Whether percentages are shown: enough applications were sent in the period. */
  showsShares: boolean;
  summary: Summary;
  firstResponse: FirstResponseSummary;
  overTime: OverTime;
  bySource: Breakdown;
  byCountry: Breakdown;
  byCity: Breakdown;
};

/**
 * Every card but Waiting now, for `applications` read once. Summary, first
 * response and the breakdowns count applications sent in the period; the
 * chart counts events by their own day; drafts count in the summary only.
 */
export function dashboard(
  applications: readonly DashboardApplication[],
  query: DashboardQuery,
  now: Date,
  timeZone: string,
): Dashboard {
  const dayOf = dayInZone(timeZone);
  const counted = applications.filter((application) => counts(application, query.includeArchived));
  const period = dashboardPeriod(applications, query, now, timeZone);
  const sent = counted.filter(
    ({ appliedAt }) => appliedAt !== null && inPeriod(dayOf(appliedAt), period),
  );
  const step = effectiveStep(period, query.step);

  return {
    period,
    step,
    stepsOffered: {
      [ChartStep.Day]: stepFits(period, ChartStep.Day),
      [ChartStep.Week]: stepFits(period, ChartStep.Week),
      [ChartStep.Month]: stepFits(period, ChartStep.Month),
    },
    showsShares: sent.length >= minimumForShares,
    summary: summary(sent, counted.filter(isUnsentDraft)),
    firstResponse: firstResponseSummary(sent),
    overTime: overTime(counted, period, step, timeZone),
    bySource: breakdown(sent, "source"),
    byCountry: breakdown(sent, "country"),
    byCity: breakdown(sent, "city"),
  };
}
