import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ChartSeries,
  ChartStep,
  citiesListed,
  type DashboardApplication,
  type DashboardQuery,
  DashboardRange,
  defaultDashboardQuery,
} from "@/domain/application/dashboard";
import type { ApplicationStatus } from "@/domain/application/model";
import { messages } from "@/ui/messages";
import { DashboardView } from "./DashboardView";

const t = messages.dashboard;
const now = new Date("2026-11-10T12:00:00.000Z");
const at = (day: string) => new Date(`${day}T09:00:00.000Z`);

let nextId = 0;

function sentOn(
  day: string,
  status: ApplicationStatus = "applied",
  overrides: Partial<DashboardApplication> = {},
): DashboardApplication {
  nextId += 1;
  return {
    id: `a${nextId}`,
    companyName: `Company ${nextId}`,
    positionTitle: "Engineer",
    status,
    appliedAt: at(day),
    lastContactAt: null,
    archivedAt: null,
    source: null,
    city: null,
    country: null,
    history: [{ status: "applied", occurredAt: at(day) }],
    ...overrides,
  };
}

function renderView(
  applications: readonly DashboardApplication[],
  query: Partial<DashboardQuery> = {},
) {
  const onQueryChange = vi.fn();
  render(
    <DashboardView
      applications={applications}
      query={{ ...defaultDashboardQuery, ...query }}
      onQueryChange={onQueryChange}
      applicationHref={(id) => `/applications/${id}`}
      waitingListHref="/applications?status=applied"
      now={now}
      timeZone="UTC"
    />,
  );
  return { onQueryChange, user: userEvent.setup() };
}

function card(title: string) {
  return screen.getByRole("region", { name: title });
}

describe("DashboardView", () => {
  it("shows the headline numbers of the period", () => {
    renderView([
      sentOn("2026-10-01", "screening", {
        history: [
          { status: "applied", occurredAt: at("2026-10-01") },
          { status: "screening", occurredAt: at("2026-10-04") },
        ],
      }),
      sentOn("2026-10-20"),
      sentOn("2026-10-21", "draft", { appliedAt: null }),
    ]);

    const summary = card(t.summary.title);
    expect(within(summary).getByText("3")).toBeVisible();
    expect(within(summary).getByText(t.summary.sentAndDrafts(2, 1))).toBeVisible();
    expect(within(summary).getByText("1 Oct 2026 – 10 Nov 2026")).toBeVisible();
    const statuses = within(summary).getByRole("list", { name: t.summary.statuses });
    expect(within(statuses).getAllByRole("listitem")).toHaveLength(8);

    const first = card(t.firstResponse.title);
    expect(within(first).getByText("3")).toBeVisible();
    expect(within(first).getByText(t.firstResponse.answers(1))).toBeVisible();
  });

  it("says when nothing was answered and nothing waits", () => {
    renderView([]);

    expect(within(card(t.firstResponse.title)).getByText(t.firstResponse.none)).toBeVisible();
    expect(within(card(t.waiting.title)).getByText(t.waiting.none)).toBeVisible();
  });

  it("shows no percentages while fewer than twenty were sent", () => {
    renderView([sentOn("2026-10-01", "applied", { source: "LinkedIn" })]);

    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });

  it("shows percentages once twenty were sent", () => {
    renderView(
      Array.from({ length: 20 }, () => sentOn("2026-10-01", "applied", { source: "LinkedIn" })),
    );

    expect(within(card(t.breakdown.bySource)).getByText("100%")).toBeVisible();
  });

  it("names a step that does not fit the period and keeps it from being chosen", async () => {
    const { onQueryChange, user } = renderView([sentOn("2026-10-01")], {
      range: DashboardRange.Custom,
      from: "2026-10-05",
      to: "2026-10-20",
      step: ChartStep.Month,
    });
    const steps = screen.getByRole("group", { name: t.overTime.steps.label });
    const month = within(steps).getByRole("button", { name: t.overTime.steps.month });

    expect(month).toHaveAttribute("aria-disabled", "true");
    expect(month).toHaveAttribute("title", t.overTime.stepTooLong.month);
    expect(within(steps).getByRole("button", { name: t.overTime.steps.week })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(month);
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it("switches a line on or off, keeping the others", async () => {
    const { onQueryChange, user } = renderView([sentOn("2026-10-01")]);

    await user.click(screen.getByRole("checkbox", { name: /^Offers/ }));

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [
          ChartSeries.Sent,
          ChartSeries.Interviews,
          ChartSeries.Offers,
          ChartSeries.Rejections,
        ],
      }),
    );
  });

  it("describes the chart by its lines, and asks for one when none is chosen", () => {
    renderView([sentOn("2026-10-01")], { lines: [ChartSeries.Sent] });

    expect(screen.getByRole("img", { name: "Events per week: Sent 1" })).toBeVisible();

    renderView([sentOn("2026-10-01")], { lines: [] });
    expect(screen.getByText(t.overTime.noLines)).toBeVisible();
  });

  it("makes a typed day the start of a custom period", () => {
    const { onQueryChange } = renderView([sentOn("2026-08-10")]);
    const from = screen.getByLabelText(t.period.from);

    expect(from).toHaveValue("2026-08-10");
    // A date input takes its value whole; user-event cannot type into one.
    fireEvent.change(from, { target: { value: "2026-09-01" } });

    expect(onQueryChange).toHaveBeenCalledWith(
      expect.objectContaining({
        range: DashboardRange.Custom,
        from: "2026-09-01",
        to: "2026-11-10",
      }),
    );
  });

  it("links each waiting application, and the rest to the list", () => {
    const applications = Array.from({ length: 7 }, (_, index) =>
      sentOn(`2026-10-0${index + 1}`, "applied", { companyName: `Waiting ${index + 1}` }),
    );
    renderView(applications);
    const waiting = card(t.waiting.title);

    expect(
      within(waiting).getByRole("link", {
        name: t.waiting.rowLabel({ companyName: "Waiting 1", positionTitle: "Engineer" }),
      }),
    ).toHaveAttribute("href", `/applications/${applications[0]?.id}`);
    expect(within(waiting).getByRole("link", { name: t.waiting.all(7) })).toHaveAttribute(
      "href",
      "/applications?status=applied",
    );
  });

  it("reverses the waiting order", async () => {
    const { user } = renderView([
      sentOn("2026-10-01", "applied", { companyName: "Older" }),
      sentOn("2026-10-09", "applied", { companyName: "Newer" }),
    ]);
    const waiting = card(t.waiting.title);
    const firstRow = () => within(waiting).getAllByRole("link")[0];

    expect(firstRow()).toHaveTextContent("Older");
    await user.click(within(waiting).getByRole("button", { name: t.waiting.sortLabel.asc }));

    expect(firstRow()).toHaveTextContent("Newer");
    expect(within(waiting).getByRole("button", { name: t.waiting.sortLabel.desc })).toBeVisible();
  });

  it("groups the cities past the first ten until asked to show all", async () => {
    const cities = Array.from({ length: citiesListed + 3 }, (_, index) => `City ${index + 10}`);
    const { user } = renderView([
      ...cities.map((city) => sentOn("2026-10-01", "applied", { city })),
      sentOn("2026-10-01"),
    ]);
    const byCity = card(t.breakdown.byCity);

    expect(within(byCity).getByText(t.breakdown.otherCities(3))).toBeVisible();
    expect(within(byCity).getByText(t.breakdown.notSpecified)).toBeVisible();

    await user.click(within(byCity).getByRole("button", { name: t.breakdown.showAll(13) }));

    expect(within(byCity).queryByText(t.breakdown.otherCities(3))).not.toBeInTheDocument();
    expect(within(byCity).getByText("City 22")).toBeVisible();
    expect(within(byCity).getByRole("button", { name: t.breakdown.showFewer })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("counts archived applications once asked to", async () => {
    const { onQueryChange, user } = renderView([sentOn("2026-10-01")]);

    await user.click(screen.getByRole("checkbox", { name: t.period.includeArchived }));

    expect(onQueryChange).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: true }));
  });
});
