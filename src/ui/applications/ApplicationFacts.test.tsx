import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Application } from "@/domain/application/model";
import { formatDay } from "@/lib/date";
import { anApplication } from "@/test/application.fixture";
import { messages } from "@/ui/messages";
import { ApplicationFacts } from "./ApplicationFacts";

const t = messages.applications;
const timeZone = "Europe/Berlin";
const now = new Date("2026-09-15T10:00:00.000Z");
// Midnight in Berlin on 1 September; still 31 August in UTC.
const appliedAt = new Date("2026-08-31T22:00:00.000Z");

function factsOf(application: Application) {
  render(<ApplicationFacts application={application} timeZone={timeZone} now={now} />);
  const terms = screen.getAllByRole("term").map((term) => term.textContent);
  const values = screen.getAllByRole("definition").map((value) => value.textContent);
  return Object.fromEntries(terms.map((term, index) => [term, values[index]]));
}

describe("ApplicationFacts", () => {
  it("shows the applied day in the viewer's zone, the last contact and the days waited", () => {
    const facts = factsOf(
      anApplication({ appliedAt, lastContactAt: new Date("2026-09-05T10:00:00.000Z") }),
    );

    expect(facts).toEqual({
      [t.page.appliedAt]: formatDay(appliedAt, timeZone),
      [t.page.lastContactAt]: formatDay(new Date("2026-09-05T10:00:00.000Z"), timeZone),
      [t.page.waiting]: t.waiting.daysSpoken(10),
    });
    expect(screen.getByText(formatDay(appliedAt, timeZone))).toHaveAttribute(
      "datetime",
      "2026-09-01",
    );
  });

  it("says what is not known yet, and that a closed application is not waiting", () => {
    const facts = factsOf(anApplication({ status: "rejected", appliedAt: null }));

    expect(facts).toEqual({
      [t.page.appliedAt]: t.notApplied,
      [t.page.lastContactAt]: t.page.noContact,
      [t.page.waiting]: `${t.waiting.none}${t.waiting.noneSpoken}`,
    });
  });

  it("adds the day an archived application was archived", () => {
    const archivedAt = new Date("2026-09-10T10:00:00.000Z");

    expect(factsOf(anApplication({ archivedAt }))[t.page.archivedAt]).toBe(
      formatDay(archivedAt, timeZone),
    );
  });
});
