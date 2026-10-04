import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { StatusHistory } from "./StatusHistory";

const t = messages.applications;
const timeZone = "Europe/Berlin";
const applied = new Date("2026-08-31T22:00:00.000Z");
const firstRound = new Date("2026-09-09T22:00:00.000Z");
const secondRound = new Date("2026-09-16T22:00:00.000Z");

describe("StatusHistory", () => {
  it("lists every status in the order given, each with its day in the viewer's zone", () => {
    render(
      <StatusHistory
        timeZone={timeZone}
        events={[
          { status: "applied", occurredAt: applied },
          { status: "interview", occurredAt: firstRound },
          { status: "interview", occurredAt: secondRound },
        ]}
      />,
    );

    const history = screen.getByRole("region", { name: t.page.history });
    expect(
      within(history)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      `${t.status.applied}${formatDay(applied, timeZone)}`,
      `${t.status.interview}${formatDay(firstRound, timeZone)}`,
      `${t.status.interview}${formatDay(secondRound, timeZone)}`,
    ]);
    expect(within(history).getByText(formatDay(applied, timeZone))).toHaveAttribute(
      "datetime",
      "2026-09-01",
    );
  });
});
