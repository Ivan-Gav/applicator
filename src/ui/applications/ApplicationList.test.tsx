import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Application } from "@/domain/application/model";
import { formatDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { ApplicationList } from "./ApplicationList";

const t = messages.applications;
// Midnight in Berlin on 1 September; still 31 August in UTC.
const appliedAt = new Date("2026-08-31T22:00:00.000Z");
const timeZone = "Europe/Berlin";

function application(overrides: Partial<Application>): Application {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    companyName: "Acme",
    positionTitle: "Engineer",
    seniority: null,
    city: null,
    country: null,
    workMode: null,
    channel: "direct",
    source: null,
    sourceUrl: null,
    applicationUrl: null,
    status: "draft",
    appliedAt: null,
    lastContactAt: null,
    salary: {
      posted: { min: null, max: null },
      asked: { min: null, max: null },
      target: { min: null, max: null },
      currency: null,
      period: null,
    },
    contact: { name: null, role: null, email: null, phone: null, url: null },
    notes: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("ApplicationList", () => {
  it("tells a user without applications how to add one", () => {
    render(<ApplicationList applications={[]} addHref="/new" timeZone={timeZone} />);

    expect(screen.getByRole("heading", { name: t.empty.title })).toBeVisible();
    expect(screen.getByText(t.empty.description)).toBeVisible();
    expect(screen.getByRole("link", { name: t.add })).toHaveAttribute("href", "/new");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows company, position, status and the applied day in the viewer's zone", () => {
    render(
      <ApplicationList
        addHref="/new"
        timeZone={timeZone}
        applications={[
          application({
            id: "00000000-0000-4000-8000-0000000000a2",
            companyName: "Globex",
            positionTitle: "Platform Engineer",
            status: "interview",
            appliedAt,
          }),
          application({ companyName: "Acme", positionTitle: "Backend Engineer" }),
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: t.title });
    const [, newest, oldest] = within(table).getAllByRole("row");
    if (!newest || !oldest) {
      throw new Error("expected a header row and two application rows");
    }

    expect(
      within(newest)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Globex", "Platform Engineer", t.status.interview, formatDay(appliedAt, timeZone)]);
    expect(within(newest).getByRole("status", { name: t.status.interview })).toBeVisible();
    expect(within(newest).getByText(formatDay(appliedAt, timeZone))).toHaveAttribute(
      "datetime",
      "2026-09-01",
    );

    expect(
      within(oldest)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Acme", "Backend Engineer", t.status.draft, t.notApplied]);
    expect(screen.getByRole("link", { name: t.add })).toHaveAttribute("href", "/new");
  });
});
