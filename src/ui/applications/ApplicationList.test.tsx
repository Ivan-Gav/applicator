import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Application } from "@/domain/application/model";
import { formatDay } from "@/lib/date";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { ApplicationList } from "./ApplicationList";

const t = messages.applications;
// Midnight in Berlin on 1 September; still 31 August in UTC.
const appliedAt = new Date("2026-08-31T22:00:00.000Z");
const timeZone = "Europe/Berlin";
const now = new Date("2026-09-15T10:00:00.000Z");

const actions = {
  changeStatus: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  delete: vi.fn(),
};

type ListOptions = { archived?: boolean; nothingMatches?: boolean; showMoreHref?: string | null };

function renderList(
  applications: Application[],
  { archived = false, nothingMatches = false, showMoreHref = null }: ListOptions = {},
) {
  render(
    <ApplicationList
      applications={applications}
      archived={archived}
      nothingMatches={nothingMatches}
      showMoreHref={showMoreHref}
      addHref="/new"
      activeHref="/list"
      archivedHref="/list?view=archived"
      applicationHref={(id) => `/list/${id}`}
      timeZone={timeZone}
      now={now}
      actions={actions}
    />,
  );
}

function rowsOf(table: HTMLElement) {
  const [, ...rows] = within(table).getAllByRole("row");
  return rows;
}

describe("ApplicationList", () => {
  it("tells a user without applications how to add one", () => {
    renderList([]);

    expect(screen.getByRole("heading", { name: t.empty.title })).toBeVisible();
    expect(screen.getByText(t.empty.description)).toBeVisible();
    expect(screen.getByRole("link", { name: t.add })).toHaveAttribute("href", "/new");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows date, company and position, city and work mode, status and waiting, and nothing else", () => {
    renderList([
      anApplication({
        id: "00000000-0000-4000-8000-0000000000a2",
        companyName: "Globex",
        positionTitle: "Platform Engineer",
        city: "Berlin",
        workMode: "hybrid",
        status: "interview",
        appliedAt,
        lastContactAt: new Date("2026-09-01T10:00:00.000Z"),
        notes: "Not for the row",
        salary: {
          advertised: { min: 60_000, max: 70_000 },
          estimated: { min: null, max: null },
          asked: { min: null, max: null },
          currency: "EUR",
          period: "year",
        },
      }),
      anApplication({ companyName: "Acme", positionTitle: "Backend Engineer", appliedAt: null }),
    ]);

    const table = screen.getByRole("table", { name: t.title });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      t.columns.appliedAt,
      t.columns.company,
      t.columns.city,
      t.columns.status,
      t.columns.waiting,
      t.columns.actions,
    ]);

    const [newest, oldest] = rowsOf(table);
    if (!newest || !oldest) {
      throw new Error("expected two application rows");
    }
    const cells = within(newest).getAllByRole("cell");
    expect(cells.slice(0, 3).map((cell) => cell.textContent)).toEqual([
      formatDay(appliedAt, timeZone),
      "GlobexPlatform Engineer",
      `Berlin${t.workMode.hybrid}`,
    ]);
    expect(within(newest).getByText(formatDay(appliedAt, timeZone))).toHaveAttribute(
      "datetime",
      "2026-09-01",
    );
    expect(
      within(newest).getByRole("button", {
        name: t.statusChange.trigger(
          t.status.interview,
          t.name({ companyName: "Globex", positionTitle: "Platform Engineer" }),
        ),
      }),
    ).toBeVisible();
    expect(cells[4]).toHaveTextContent(t.waiting.daysSpoken(14));
    expect(newest).not.toHaveTextContent("Not for the row");
    expect(newest).not.toHaveTextContent("60,000");
    expect(within(oldest).getAllByRole("cell")[0]).toHaveTextContent(t.notApplied);
  });

  it("counts waiting days in one format, and none for a closed application", () => {
    renderList([
      anApplication({
        id: "00000000-0000-4000-8000-0000000000a3",
        companyName: "Initech",
        appliedAt: new Date("2026-07-01T10:00:00.000Z"),
      }),
      anApplication({ companyName: "Hooli", status: "rejected" }),
    ]);

    const [waiting, closed] = rowsOf(screen.getByRole("table", { name: t.title }));
    expect(within(waiting!).getAllByRole("cell")[4]).toHaveTextContent(t.waiting.days(76));
    expect(within(closed!).getAllByRole("cell")[4]).toHaveTextContent(t.waiting.none);
    expect(within(closed!).getAllByRole("cell")[4]).toHaveTextContent(t.waiting.noneSpoken);
  });

  it("opens an application from its row, through one link named after it", () => {
    renderList([anApplication({ id: "00000000-0000-4000-8000-0000000000a7" })]);
    const name = t.name({ companyName: "Acme", positionTitle: "Engineer" });

    expect(screen.getByRole("link", { name })).toHaveAttribute(
      "href",
      "/list/00000000-0000-4000-8000-0000000000a7",
    );
    expect(
      screen.queryByRole("link", { name: t.actions.label("Edit", name) }),
    ).not.toBeInTheDocument();
  });

  it("offers each row's actions named after its application", () => {
    renderList([anApplication({ companyName: "Globex", positionTitle: "SRE" })]);
    const name = t.name({ companyName: "Globex", positionTitle: "SRE" });

    for (const action of [t.actions.archive, t.actions.delete]) {
      expect(screen.getByRole("button", { name: t.actions.label(action, name) })).toBeVisible();
    }
    expect(
      screen.getByRole("button", { name: t.statusChange.trigger(t.status.applied, name) }),
    ).toBeVisible();
  });

  it("marks the active view as current and links to the archived one", () => {
    renderList([anApplication()]);
    const views = screen.getByRole("navigation", { name: t.views.label });

    expect(within(views).getByRole("link", { name: t.views.active })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(views).getByRole("link", { name: t.views.archived })).toHaveAttribute(
      "href",
      "/list?view=archived",
    );
  });

  it("shows archived applications under their own name, each offering to restore it", () => {
    renderList([anApplication({ archivedAt: appliedAt })], { archived: true });
    const name = t.name({ companyName: "Acme", positionTitle: "Engineer" });

    expect(screen.getByRole("table", { name: t.views.archived })).toBeVisible();
    expect(
      screen.getByRole("button", { name: t.actions.label(t.actions.unarchive, name) }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: t.views.label })).getByRole("link", {
        name: t.views.archived,
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("says so when nothing is archived", () => {
    renderList([], { archived: true });

    expect(screen.getByRole("heading", { name: t.emptyArchived.title })).toBeVisible();
    expect(screen.queryByRole("heading", { name: t.empty.title })).not.toBeInTheDocument();
  });

  it("says nothing matches when the filters let no row through", () => {
    renderList([], { nothingMatches: true });

    expect(screen.getByRole("heading", { name: t.nothingMatches.title })).toBeVisible();
    expect(screen.getByText(t.nothingMatches.description)).toBeVisible();
    expect(screen.queryByRole("heading", { name: t.empty.title })).not.toBeInTheDocument();
  });

  it("offers more rows only while some are left", () => {
    renderList([anApplication()], { showMoreHref: "/list?shown=100" });

    expect(screen.getByRole("link", { name: t.showMore })).toHaveAttribute(
      "href",
      "/list?shown=100",
    );
  });

  it("offers no more rows once all are shown", () => {
    renderList([anApplication()]);

    expect(screen.queryByRole("link", { name: t.showMore })).not.toBeInTheDocument();
  });
});
