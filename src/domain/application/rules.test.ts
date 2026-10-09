import { describe, expect, it } from "vitest";
import { anApplication } from "@/test/application.fixture";
import { applicationStatuses, SalaryRangeKind } from "./model";
import {
  daysWithoutResponse,
  isClosedStatus,
  isLikelyTransition,
  likelyNextStatuses,
  otherNextStatuses,
  salaryRangeShape,
  statusTransition,
} from "./rules";

describe("likelyNextStatuses", () => {
  it.each(applicationStatuses)("lists from %s exactly what isLikelyTransition expects", (from) => {
    expect(likelyNextStatuses(from)).toEqual(
      applicationStatuses.filter((to) => isLikelyTransition(from, to)),
    );
  });

  it("lists the likely moves in process order", () => {
    expect(likelyNextStatuses("applied")).toEqual([
      "screening",
      "assignment",
      "interview",
      "rejected",
      "withdrawn",
    ]);
    expect(likelyNextStatuses("interview")).toEqual([
      "assignment",
      "interview",
      "offer",
      "rejected",
      "withdrawn",
    ]);
  });

  it("expects another round of interviews, but no other status twice", () => {
    for (const status of applicationStatuses) {
      expect(isLikelyTransition(status, status)).toBe(status === "interview");
    }
  });
});

describe("otherNextStatuses", () => {
  it.each(applicationStatuses)(
    "offers from %s, with the likely ones, every other status exactly once",
    (from) => {
      const offered = [...likelyNextStatuses(from), ...otherNextStatuses(from)];

      expect(new Set(offered).size).toBe(offered.length);
      expect(offered.filter((to) => to !== from).toSorted()).toEqual(
        applicationStatuses.filter((to) => to !== from).toSorted(),
      );
    },
  );

  it("still offers every other status from a closed one, as an offer can follow a rejection", () => {
    expect(otherNextStatuses("rejected")).toEqual(
      applicationStatuses.filter((status) => status !== "rejected"),
    );
  });
});

describe("isClosedStatus", () => {
  it.each(applicationStatuses)("calls %s closed only if it is rejected or withdrawn", (status) => {
    expect(isClosedStatus(status)).toBe(status === "rejected" || status === "withdrawn");
  });
});

describe("statusTransition", () => {
  const at = new Date("2026-03-10T12:00:00Z");

  it("moves to any status, entered and contacted at the given time", () => {
    const result = statusTransition(anApplication({ status: "rejected" }), "offer", at);

    expect(result.status).toBe("offer");
    expect(result.statusChangedAt).toEqual(at);
    expect(result.lastContactAt).toEqual(at);
  });

  it("accepts a time in the past, as when a reply is recorded days later", () => {
    const friday = new Date("2026-03-06T00:00:00Z");

    const result = statusTransition(anApplication({ status: "applied" }), "screening", friday);

    expect(result.statusChangedAt).toEqual(friday);
    expect(result.lastContactAt).toEqual(friday);
  });

  it("leaves every other field as it was", () => {
    const original = anApplication({ status: "screening", notes: "Kept", archivedAt: at });

    expect(statusTransition(original, "interview", at)).toEqual({
      ...original,
      status: "interview",
      statusChangedAt: at,
      lastContactAt: at,
    });
  });

  it("stamps appliedAt when the application is sent", () => {
    const draft = anApplication({ status: "draft", appliedAt: null });

    expect(statusTransition(draft, "applied", at).appliedAt).toEqual(at);
  });

  it("keeps the date it was sent when it moves back to applied, as after a mis-click", () => {
    const appliedAt = new Date("2026-03-01T09:00:00Z");
    const rejected = anApplication({ status: "rejected", appliedAt });

    expect(statusTransition(rejected, "applied", at).appliedAt).toEqual(appliedAt);
  });

  it("keeps the original appliedAt on later moves", () => {
    const appliedAt = new Date("2026-03-01T09:00:00Z");
    const applied = anApplication({ status: "applied", appliedAt });

    expect(statusTransition(applied, "screening", at).appliedAt).toEqual(appliedAt);
  });

  it("does not mutate its argument", () => {
    const original = anApplication({ status: "applied" });
    const snapshot = structuredClone(original);

    statusTransition(original, "screening", at);

    expect(original).toEqual(snapshot);
  });

  it("returns a new object", () => {
    const original = anApplication({ status: "interview" });

    expect(statusTransition(original, "interview", at)).not.toBe(original);
  });
});

describe("daysWithoutResponse", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  it("counts from lastContactAt when it is set", () => {
    const application = anApplication({
      appliedAt: new Date("2026-03-01T12:00:00Z"),
      lastContactAt: new Date("2026-03-10T12:00:00Z"),
    });

    expect(daysWithoutResponse(application, now)).toBe(5);
  });

  it("falls back to appliedAt when there was no contact yet", () => {
    const application = anApplication({
      appliedAt: new Date("2026-03-01T12:00:00Z"),
      lastContactAt: null,
    });

    expect(daysWithoutResponse(application, now)).toBe(14);
  });

  it("rounds partial days down", () => {
    const application = anApplication({
      lastContactAt: new Date("2026-03-13T13:00:00Z"),
    });

    expect(daysWithoutResponse(application, now)).toBe(1);
  });

  it("never goes negative when the reference date is in the future", () => {
    const application = anApplication({
      lastContactAt: new Date("2026-03-20T12:00:00Z"),
    });

    expect(daysWithoutResponse(application, now)).toBe(0);
  });

  it("returns null for an application that was never sent", () => {
    const draft = anApplication({ status: "draft", appliedAt: null, lastContactAt: null });

    expect(daysWithoutResponse(draft, now)).toBeNull();
  });

  it.each(["rejected", "withdrawn"] as const)("returns null once the status is %s", (status) => {
    const application = anApplication({
      status,
      appliedAt: new Date("2026-03-01T12:00:00Z"),
      lastContactAt: new Date("2026-03-10T12:00:00Z"),
    });

    expect(daysWithoutResponse(application, now)).toBeNull();
  });
});

describe("salaryRangeShape", () => {
  it.each([
    [{ min: null, max: null }, { kind: SalaryRangeKind.Unknown }],
    [
      { min: 70_000, max: 70_000 },
      { kind: SalaryRangeKind.Exact, amount: 70_000 },
    ],
    [
      { min: 60_000, max: 70_000 },
      { kind: SalaryRangeKind.Between, min: 60_000, max: 70_000 },
    ],
    [
      { min: 60_000, max: null },
      { kind: SalaryRangeKind.From, min: 60_000 },
    ],
    [
      { min: null, max: 80_000 },
      { kind: SalaryRangeKind.UpTo, max: 80_000 },
    ],
    [
      { min: 0, max: 0 },
      { kind: SalaryRangeKind.Exact, amount: 0 },
    ],
  ])("reads %j as %j", (range, shape) => {
    expect(salaryRangeShape(range)).toEqual(shape);
  });
});
