import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ApplicationStatus } from "@/domain/application/model";
import { StatusBadge } from "./StatusBadge";

const labels: ReadonlyArray<[ApplicationStatus, string]> = [
  ["draft", "Draft"],
  ["applied", "Applied"],
  ["screening", "Screening"],
  ["interview", "Interview"],
  ["offer", "Offer"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
];

describe("StatusBadge", () => {
  it.each(labels)("renders %s as a status named %s", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByRole("status", { name: label })).toBeVisible();
  });

  it("colours each status differently", () => {
    render(
      <>
        <StatusBadge status="offer" />
        <StatusBadge status="rejected" />
      </>,
    );

    const offer = screen.getByRole("status", { name: "Offer" });
    const rejected = screen.getByRole("status", { name: "Rejected" });

    expect(offer.className).not.toBe(rejected.className);
  });

  it("accepts extra classes", () => {
    render(<StatusBadge status="applied" className="ml-2" />);

    expect(screen.getByRole("status", { name: "Applied" })).toHaveClass("ml-2");
  });
});
