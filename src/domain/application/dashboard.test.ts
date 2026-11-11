import { describe, expect, it } from "vitest";
import { SortDirection } from "@/lib/sort-direction";
import { anApplication } from "@/test/application.fixture";
import {
  bucketOf,
  breakdown,
  ChartSeries,
  ChartStep,
  cappedRows,
  chartBuckets,
  type DashboardApplication,
  type DashboardQuery,
  DashboardRange,
  dashboard,
  dashboardApplication,
  dashboardPeriod,
  daysToFirstResponse,
  defaultDashboardQuery,
  effectiveStep,
  firstResponse,
  firstResponseSummary,
  minimumForShares,
  overTime,
  seriesEvents,
  shareOf,
  stepFits,
  summary,
  waitingNow,
} from "./dashboard";
import type { ApplicationStatus, StatusEvent } from "./model";
import { daysWithoutResponse } from "./rules";

const utc = "UTC";
// A Tuesday.
const now = new Date("2026-11-10T12:00:00.000Z");

const at = (iso: string) => new Date(`${iso}T09:00:00.000Z`);
const event = (status: ApplicationStatus, iso: string): StatusEvent => ({
  status,
  occurredAt: at(iso),
});

let nextId = 0;

/** Sent on `applied`, with a history that starts there. */
function sentOn(
  applied: string,
  overrides: Partial<DashboardApplication> = {},
): DashboardApplication {
  nextId += 1;
  return {
    id: `a${nextId}`,
    companyName: `Company ${nextId}`,
    positionTitle: "Engineer",
    status: "applied",
    appliedAt: at(applied),
    lastContactAt: null,
    archivedAt: null,
    source: null,
    city: null,
    country: null,
    history: [event("applied", applied)],
    ...overrides,
  };
}

function draft(overrides: Partial<DashboardApplication> = {}): DashboardApplication {
  return sentOn("2026-01-01", {
    status: "draft",
    appliedAt: null,
    history: [event("draft", "2026-01-01")],
    ...overrides,
  });
}

function query(overrides: Partial<DashboardQuery> = {}): DashboardQuery {
  return { ...defaultDashboardQuery, ...overrides };
}

describe("dashboardApplication", () => {
  it("keeps only what the dashboard reads", () => {
    const application = anApplication({ notes: "private", city: "Berlin" });
    const history = [event("applied", "2026-03-01")];

    const read = dashboardApplication({ application, history });

    expect(read).toEqual({
      id: application.id,
      companyName: "Acme",
      positionTitle: "Engineer",
      status: "applied",
      appliedAt: application.appliedAt,
      lastContactAt: null,
      archivedAt: null,
      source: null,
      city: "Berlin",
      country: null,
      history,
    });
    expect(read).not.toHaveProperty("notes");
  });
});

describe("firstResponse", () => {
  it("is the first move by the employer, past applied", () => {
    const history = [
      event("draft", "2026-09-01"),
      event("applied", "2026-09-02"),
      event("screening", "2026-09-05"),
      event("rejected", "2026-09-09"),
    ];

    expect(firstResponse(history)).toEqual(event("screening", "2026-09-05"));
  });

  it.each(["screening", "assignment", "interview", "offer", "rejected"] as const)(
    "counts a move to %s as an answer",
    (status) => {
      expect(firstResponse([event("applied", "2026-09-01"), event(status, "2026-09-03")])).toEqual(
        event(status, "2026-09-03"),
      );
    },
  );

  it("does not take withdrawing for an answer", () => {
    expect(
      firstResponse([event("applied", "2026-09-01"), event("withdrawn", "2026-09-03")]),
    ).toBeNull();
  });

  it("finds an answer that comes after a withdrawal", () => {
    expect(
      firstResponse([
        event("applied", "2026-09-01"),
        event("withdrawn", "2026-09-03"),
        event("offer", "2026-09-20"),
      ]),
    ).toEqual(event("offer", "2026-09-20"));
  });

  it("is null without an answer", () => {
    expect(firstResponse([event("applied", "2026-09-01")])).toBeNull();
  });
});

describe("daysToFirstResponse", () => {
  it("counts whole days from sending to the answer", () => {
    const application = sentOn("2026-09-01", {
      history: [event("applied", "2026-09-01"), event("interview", "2026-09-08")],
    });

    expect(daysToFirstResponse(application)).toBe(7);
  });

  it("rounds a part of a day down", () => {
    expect(
      daysToFirstResponse({
        appliedAt: new Date("2026-09-01T09:00:00Z"),
        history: [{ status: "rejected", occurredAt: new Date("2026-09-03T08:59:00Z") }],
      }),
    ).toBe(1);
  });

  it("is never negative, though the answer was dated before the application", () => {
    expect(
      daysToFirstResponse(sentOn("2026-09-10", { history: [event("screening", "2026-09-08")] })),
    ).toBe(0);
  });

  it("is null for an application with no response", () => {
    expect(daysToFirstResponse(sentOn("2026-09-01"))).toBeNull();
  });

  it("is null for an application never sent", () => {
    expect(
      daysToFirstResponse(
        draft({ history: [event("draft", "2026-09-01"), event("rejected", "2026-09-02")] }),
      ),
    ).toBeNull();
  });
});

describe("firstResponseSummary", () => {
  const answeredAfter = (days: number) =>
    sentOn("2026-09-01", {
      history: [
        event("applied", "2026-09-01"),
        { status: "screening", occurredAt: new Date(at("2026-09-01").getTime() + days * 864e5) },
      ],
    });

  it("is the middle value of an odd count", () => {
    expect(firstResponseSummary([answeredAfter(9), answeredAfter(2), answeredAfter(4)])).toEqual({
      median: 4,
      answers: 3,
    });
  });

  it("is the rounded mean of the middle two of an even count", () => {
    expect(
      firstResponseSummary([
        answeredAfter(2),
        answeredAfter(3),
        answeredAfter(8),
        answeredAfter(30),
      ]).median,
    ).toBe(6);
    // 3 and 4: the mean 3.5 rounds up.
    expect(firstResponseSummary([answeredAfter(3), answeredAfter(4)]).median).toBe(4);
  });

  it("leaves applications without an answer out of the count", () => {
    expect(firstResponseSummary([answeredAfter(5), sentOn("2026-09-02")])).toEqual({
      median: 5,
      answers: 1,
    });
  });

  it("has no median when nothing was answered", () => {
    expect(firstResponseSummary([sentOn("2026-09-02")])).toEqual({ median: null, answers: 0 });
    expect(firstResponseSummary([])).toEqual({ median: null, answers: 0 });
  });
});

describe("waiting days", () => {
  it("are the list's own count: days since the last contact", () => {
    const application = sentOn("2026-09-01", {
      status: "screening",
      lastContactAt: at("2026-10-01"),
    });

    const waiting = waitingNow([application], now, SortDirection.Ascending);

    expect(waiting.open).toEqual([application]);
    expect(daysWithoutResponse(application, now)).toBe(40);
    expect(waiting.waitingLong).toBe(1);
  });
});

describe("waitingNow", () => {
  it("lists active applications in an open status, oldest sent first", () => {
    const newer = sentOn("2026-11-01", { status: "interview" });
    const older = sentOn("2026-10-01", { status: "assignment" });
    const screening = sentOn("2026-10-15", { status: "screening" });
    const closed = [
      sentOn("2026-09-01", { status: "rejected" }),
      sentOn("2026-09-01", { status: "withdrawn" }),
      sentOn("2026-09-01", { status: "offer" }),
      draft(),
    ];
    const archived = sentOn("2026-09-01", { archivedAt: at("2026-10-01") });

    const { open } = waitingNow(
      [newer, older, screening, archived, ...closed],
      now,
      SortDirection.Ascending,
    );

    expect(open).toEqual([older, screening, newer]);
  });

  it("reverses the order, and puts one never sent last either way", () => {
    const unsent = sentOn("2026-09-01", { status: "screening", appliedAt: null });
    const older = sentOn("2026-09-01");
    const newer = sentOn("2026-10-01");

    expect(waitingNow([unsent, older, newer], now, SortDirection.Descending).open).toEqual([
      newer,
      older,
      unsent,
    ]);
    expect(waitingNow([unsent, newer, older], now, SortDirection.Ascending).open).toEqual([
      older,
      newer,
      unsent,
    ]);
  });

  it("counts those waiting forty days or more", () => {
    const applications = [
      sentOn("2026-10-01"),
      sentOn("2026-10-02"),
      sentOn("2026-09-01", { lastContactAt: at("2026-11-01") }),
    ];

    expect(waitingNow(applications, now, SortDirection.Ascending).waitingLong).toBe(1);
  });

  it("ignores the period: nothing in it is asked", () => {
    expect(waitingNow([sentOn("2020-01-01")], now, SortDirection.Ascending).open).toHaveLength(1);
  });
});

describe("seriesEvents", () => {
  it("dates Sent by the day applied", () => {
    expect(seriesEvents(sentOn("2026-09-01"), ChartSeries.Sent)).toEqual([at("2026-09-01")]);
  });

  it("dates every other series by each move to its status", () => {
    const application = sentOn("2026-09-01", {
      history: [
        event("applied", "2026-09-01"),
        event("screening", "2026-09-03"),
        event("assignment", "2026-09-05"),
        event("offer", "2026-09-20"),
        event("rejected", "2026-09-21"),
        event("withdrawn", "2026-09-22"),
      ],
    });

    expect(seriesEvents(application, ChartSeries.Screening)).toEqual([at("2026-09-03")]);
    expect(seriesEvents(application, ChartSeries.Assignments)).toEqual([at("2026-09-05")]);
    expect(seriesEvents(application, ChartSeries.Offers)).toEqual([at("2026-09-20")]);
    expect(seriesEvents(application, ChartSeries.Rejections)).toEqual([at("2026-09-21")]);
    expect(seriesEvents(application, ChartSeries.Withdrawn)).toEqual([at("2026-09-22")]);
  });

  it("counts an application interviewed twice twice", () => {
    const application = sentOn("2026-09-01", {
      history: [
        event("applied", "2026-09-01"),
        event("interview", "2026-09-10"),
        event("interview", "2026-09-17"),
      ],
    });

    expect(seriesEvents(application, ChartSeries.Interviews)).toEqual([
      at("2026-09-10"),
      at("2026-09-17"),
    ]);
  });

  it("counts every entry into a status, a corrected one included", () => {
    const application = sentOn("2026-09-01", {
      history: [
        event("applied", "2026-09-01"),
        event("rejected", "2026-09-02"),
        event("applied", "2026-09-02"),
        event("rejected", "2026-09-30"),
      ],
    });

    expect(seriesEvents(application, ChartSeries.Rejections)).toHaveLength(2);
  });

  it("gives an application never sent no events", () => {
    const unsent = draft({
      history: [event("draft", "2026-09-01"), event("withdrawn", "2026-09-02")],
    });

    expect(seriesEvents(unsent, ChartSeries.Withdrawn)).toEqual([]);
    expect(seriesEvents(unsent, ChartSeries.Sent)).toEqual([]);
  });
});

describe("bucketOf", () => {
  it("starts a week on Monday", () => {
    // Sunday 8 November 2026, and Monday 9 November.
    expect(bucketOf("2026-11-08", ChartStep.Week)).toBe("2026-11-02");
    expect(bucketOf("2026-11-09", ChartStep.Week)).toBe("2026-11-09");
  });

  it("keeps a week spanning a month boundary whole, under the month it starts in", () => {
    // Monday 28 September to Sunday 4 October 2026.
    expect(bucketOf("2026-10-01", ChartStep.Week)).toBe("2026-09-28");
    expect(bucketOf("2026-10-04", ChartStep.Week)).toBe("2026-09-28");
  });

  it("starts a month on its first and leaves a day as it is", () => {
    expect(bucketOf("2026-02-28", ChartStep.Month)).toBe("2026-02-01");
    expect(bucketOf("2026-02-28", ChartStep.Day)).toBe("2026-02-28");
  });
});

describe("chartBuckets", () => {
  const period = { from: "2026-09-26", to: "2026-10-06" };

  it("covers every day of the period", () => {
    expect(chartBuckets({ from: "2026-02-27", to: "2026-03-02" }, ChartStep.Day)).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("starts with the week the period starts in, which may begin before it", () => {
    expect(chartBuckets(period, ChartStep.Week)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ]);
  });

  it("lists each month the period touches", () => {
    expect(chartBuckets(period, ChartStep.Month)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(chartBuckets({ from: "2025-12-15", to: "2026-01-02" }, ChartStep.Month)).toEqual([
      "2025-12-01",
      "2026-01-01",
    ]);
  });
});

describe("stepFits and effectiveStep", () => {
  it("refuses a step only when the whole period fits in one of its buckets", () => {
    const withinOneMonth = { from: "2026-10-01", to: "2026-10-31" };

    expect(stepFits(withinOneMonth, ChartStep.Month)).toBe(false);
    expect(stepFits(withinOneMonth, ChartStep.Week)).toBe(true);
    // Two days of one month, but in two weeks.
    expect(stepFits({ from: "2026-11-08", to: "2026-11-09" }, ChartStep.Week)).toBe(true);
    expect(stepFits({ from: "2026-11-09", to: "2026-11-15" }, ChartStep.Week)).toBe(false);
  });

  it("allows a short step over a long period", () => {
    expect(stepFits({ from: "2020-01-01", to: "2026-11-10" }, ChartStep.Day)).toBe(true);
  });

  it("keeps the step asked for while it fits", () => {
    expect(effectiveStep({ from: "2026-08-01", to: "2026-11-10" }, ChartStep.Month)).toBe(
      ChartStep.Month,
    );
  });

  it("falls back to week, then day, then month", () => {
    expect(effectiveStep({ from: "2026-10-01", to: "2026-10-31" }, ChartStep.Month)).toBe(
      ChartStep.Week,
    );
    expect(effectiveStep({ from: "2026-11-09", to: "2026-11-12" }, ChartStep.Month)).toBe(
      ChartStep.Day,
    );
  });

  it("shows days for a single day, where no step fits", () => {
    expect(effectiveStep({ from: "2026-11-10", to: "2026-11-10" }, ChartStep.Week)).toBe(
      ChartStep.Day,
    );
  });
});

describe("dashboardPeriod", () => {
  const applications = [sentOn("2026-08-10"), sentOn("2026-09-01"), draft()];

  it("runs all time from the first day sent to today", () => {
    expect(dashboardPeriod(applications, query(), now, utc)).toEqual({
      from: "2026-08-10",
      to: "2026-11-10",
    });
  });

  it("is today alone when nothing was sent", () => {
    expect(dashboardPeriod([draft()], query(), now, utc)).toEqual({
      from: "2026-11-10",
      to: "2026-11-10",
    });
  });

  it("counts the last 30 and 90 days with today", () => {
    expect(
      dashboardPeriod(applications, query({ range: DashboardRange.Last30Days }), now, utc),
    ).toEqual({ from: "2026-10-12", to: "2026-11-10" });
    expect(
      dashboardPeriod(applications, query({ range: DashboardRange.Last90Days }), now, utc),
    ).toEqual({ from: "2026-08-13", to: "2026-11-10" });
  });

  it("takes today in the viewer's zone", () => {
    const lateEvening = new Date("2026-11-10T23:30:00.000Z");

    expect(dashboardPeriod([], query(), lateEvening, "Europe/Berlin").to).toBe("2026-11-11");
    expect(dashboardPeriod([], query(), lateEvening, "America/New_York").to).toBe("2026-11-10");
  });

  it("starts all time at an archived application only when archived ones count", () => {
    const archived = sentOn("2026-01-05", { archivedAt: at("2026-02-01") });

    expect(dashboardPeriod([archived, ...applications], query(), now, utc).from).toBe("2026-08-10");
    expect(
      dashboardPeriod([archived, ...applications], query({ includeArchived: true }), now, utc).from,
    ).toBe("2026-01-05");
  });

  it("keeps a custom period within all time, in order, filling a missing end", () => {
    const custom = (from: string | null, to: string | null) =>
      dashboardPeriod(applications, query({ range: DashboardRange.Custom, from, to }), now, utc);

    expect(custom("2026-09-01", "2026-09-30")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(custom("2026-09-30", "2026-09-01")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(custom("2001-01-01", "2030-01-01")).toEqual({ from: "2026-08-10", to: "2026-11-10" });
    expect(custom(null, "2026-09-30")).toEqual({ from: "2026-08-10", to: "2026-09-30" });
  });
});

describe("overTime", () => {
  it("counts each event in the bucket of its own day", () => {
    const applications = [
      sentOn("2026-09-28", {
        history: [
          event("applied", "2026-09-28"),
          event("interview", "2026-10-01"),
          event("interview", "2026-10-06"),
        ],
      }),
      sentOn("2026-10-04"),
    ];

    const chart = overTime(
      applications,
      { from: "2026-09-28", to: "2026-10-11" },
      ChartStep.Week,
      utc,
    );
    const line = (series: ChartSeries) =>
      chart.lines.find((candidate) => candidate.series === series);

    expect(chart.buckets).toEqual(["2026-09-28", "2026-10-05"]);
    // The week of 28 September holds 4 October: one week across the month boundary.
    expect(line(ChartSeries.Sent)).toEqual({ series: ChartSeries.Sent, values: [2, 0], total: 2 });
    expect(line(ChartSeries.Interviews)).toEqual({
      series: ChartSeries.Interviews,
      values: [1, 1],
      total: 2,
    });
  });

  it("counts an event in the period of an application sent before it", () => {
    const application = sentOn("2026-07-01", {
      history: [event("applied", "2026-07-01"), event("rejected", "2026-10-02")],
    });

    const chart = overTime(
      [application],
      { from: "2026-10-01", to: "2026-10-31" },
      ChartStep.Week,
      utc,
    );

    expect(chart.lines.find(({ series }) => series === ChartSeries.Sent)?.total).toBe(0);
    expect(chart.lines.find(({ series }) => series === ChartSeries.Rejections)?.total).toBe(1);
  });

  it("leaves out days of a first week that fall before the period", () => {
    // The period starts on Thursday 1 October; its first week starts on 28 September.
    const chart = overTime(
      [sentOn("2026-09-29"), sentOn("2026-10-02")],
      { from: "2026-10-01", to: "2026-10-11" },
      ChartStep.Week,
      utc,
    );

    expect(chart.lines.find(({ series }) => series === ChartSeries.Sent)?.values).toEqual([1, 0]);
  });

  it("buckets an event by the day it fell on in the viewer's zone", () => {
    // 23:30 on 30 September in UTC is already 1 October in Berlin.
    const application = sentOn("2026-09-01", {
      appliedAt: new Date("2026-09-30T23:30:00.000Z"),
    });
    const period = { from: "2026-09-01", to: "2026-10-31" };

    const sentIn = (timeZone: string) =>
      overTime([application], period, ChartStep.Month, timeZone).lines[0]?.values;

    expect(sentIn("UTC")).toEqual([1, 0]);
    expect(sentIn("Europe/Berlin")).toEqual([0, 1]);
  });

  it("gives every series zeros for a period with no events", () => {
    const chart = overTime(
      [sentOn("2026-01-01")],
      { from: "2026-10-01", to: "2026-10-03" },
      ChartStep.Day,
      utc,
    );

    expect(chart.lines.map(({ total }) => total)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(chart.lines.every(({ values }) => values.join() === "0,0,0")).toBe(true);
  });
});

describe("shareOf", () => {
  it("is a rounded percentage of those sent", () => {
    expect(shareOf(1, 30)).toBe(3);
    expect(shareOf(10, minimumForShares)).toBe(50);
  });

  it("is withheld below twenty sent, where it would mislead", () => {
    expect(shareOf(5, minimumForShares - 1)).toBeNull();
  });
});

describe("summary", () => {
  it("counts the sent by current status, every status listed, drafts aside", () => {
    const sent = [
      sentOn("2026-09-01", { status: "rejected" }),
      sentOn("2026-09-02", { status: "rejected" }),
      sentOn("2026-09-03"),
    ];

    const result = summary(sent, [draft(), draft()]);

    expect(result).toMatchObject({ total: 5, sent: 3, drafts: 2 });
    expect(result.statuses).toEqual([
      { status: "draft", count: 2, share: null },
      { status: "applied", count: 1, share: null },
      { status: "screening", count: 0, share: null },
      { status: "assignment", count: 0, share: null },
      { status: "interview", count: 0, share: null },
      { status: "offer", count: 0, share: null },
      { status: "rejected", count: 2, share: null },
      { status: "withdrawn", count: 0, share: null },
    ]);
  });

  it("gives every status but draft a share once twenty were sent", () => {
    const sent = Array.from({ length: 20 }, (_, index) =>
      sentOn("2026-09-01", { status: index < 5 ? "interview" : "applied" }),
    );

    const shares = Object.fromEntries(
      summary(sent, [draft()]).statuses.map(({ status, share }) => [status, share]),
    );

    expect(shares).toMatchObject({ draft: null, applied: 75, interview: 25, offer: 0 });
  });
});

describe("breakdown", () => {
  it("sorts values by count, then by name, with the empty ones apart", () => {
    const sent = [
      sentOn("2026-09-01", { source: "StepStone" }),
      sentOn("2026-09-01", { source: "LinkedIn" }),
      sentOn("2026-09-01", { source: "LinkedIn" }),
      sentOn("2026-09-01", { source: "Indeed" }),
      sentOn("2026-09-01", { source: null }),
      sentOn("2026-09-01", { source: "  " }),
    ];

    const result = breakdown(sent, "source");

    expect(result.rows.map(({ label, count }) => [label, count])).toEqual([
      ["LinkedIn", 2],
      ["Indeed", 1],
      ["StepStone", 1],
    ]);
    expect(result.notSpecified).toEqual({ label: "", count: 2, share: null });
    expect(result.distinct).toBe(3);
    expect(result.largest).toBe(2);
  });

  it("counts spellings differing only in case or accents as one value", () => {
    const sent = [
      sentOn("2026-09-01", { city: "München" }),
      sentOn("2026-09-01", { city: "munchen" }),
      sentOn("2026-09-01", { city: "Munich" }),
    ];

    expect(breakdown(sent, "city").rows).toEqual([
      { label: "München", count: 2, share: null },
      { label: "Munich", count: 1, share: null },
    ]);
  });

  it("has nothing unspecified when every application has a value", () => {
    expect(
      breakdown([sentOn("2026-09-01", { country: "Germany" })], "country").notSpecified,
    ).toBeNull();
  });

  it("is empty for a period with no applications", () => {
    expect(breakdown([], "city")).toEqual({
      rows: [],
      notSpecified: null,
      distinct: 0,
      largest: 0,
    });
  });
});

describe("cappedRows", () => {
  const withCities = (count: number) =>
    breakdown(
      Array.from({ length: count }, (_, index) =>
        sentOn("2026-09-01", { city: `City ${String(index).padStart(2, "0")}` }),
      ),
      "city",
    );

  it("lists the first ones and sums the rest", () => {
    const capped = cappedRows(withCities(14), 10, 14);

    expect(capped.shown).toHaveLength(10);
    expect(capped.other).toEqual({ values: 4, count: 4, share: null });
  });

  it("does not group a single value left over", () => {
    expect(cappedRows(withCities(11), 10, 11)).toEqual({ shown: withCities(11).rows, other: null });
  });
});

describe("dashboard", () => {
  const archivedOne = sentOn("2026-10-20", {
    status: "rejected",
    archivedAt: at("2026-11-01"),
    history: [event("applied", "2026-10-20"), event("rejected", "2026-10-25")],
  });
  const applications = [
    sentOn("2026-08-10", {
      status: "interview",
      source: "LinkedIn",
      history: [event("applied", "2026-08-10"), event("interview", "2026-08-20")],
    }),
    sentOn("2026-10-15", {
      status: "screening",
      source: "LinkedIn",
      history: [event("applied", "2026-10-15"), event("screening", "2026-10-17")],
    }),
    sentOn("2026-11-01"),
    archivedOne,
    draft(),
  ];

  it("counts applications sent in the period in summary, first response and breakdowns", () => {
    const view = dashboard(applications, query({ range: DashboardRange.Last30Days }), now, utc);

    expect(view.period).toEqual({ from: "2026-10-12", to: "2026-11-10" });
    expect(view.summary).toMatchObject({ total: 3, sent: 2, drafts: 1 });
    expect(view.firstResponse).toEqual({ median: 2, answers: 1 });
    expect(view.bySource.rows).toEqual([{ label: "LinkedIn", count: 1, share: null }]);
    expect(view.bySource.notSpecified?.count).toBe(1);
    expect(view.showsShares).toBe(false);
  });

  it("counts archived applications only when asked to", () => {
    const without = dashboard(applications, query(), now, utc);
    const withArchived = dashboard(applications, query({ includeArchived: true }), now, utc);

    expect(without.summary.sent).toBe(3);
    expect(withArchived.summary.sent).toBe(4);
    expect(withArchived.firstResponse).toEqual({ median: 5, answers: 3 });
    expect(
      withArchived.overTime.lines.find(({ series }) => series === ChartSeries.Rejections)?.total,
    ).toBe(1);
  });

  it("shows the step asked for, or the one that fits, and says which fit", () => {
    const oneMonth = query({ range: DashboardRange.Custom, from: "2026-10-01", to: "2026-10-31" });

    const view = dashboard(applications, { ...oneMonth, step: ChartStep.Month }, now, utc);

    expect(view.step).toBe(ChartStep.Week);
    expect(view.stepsOffered).toEqual({
      [ChartStep.Day]: true,
      [ChartStep.Week]: true,
      [ChartStep.Month]: false,
    });
  });
});
