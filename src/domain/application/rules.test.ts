import { describe, expect, it } from "vitest";
import { anApplication } from "@/test/application.fixture";
import { type ApplicationStatus, SalaryRangeKind } from "./model";
import {
  IllegalStatusTransitionError,
  isStatusTransitionAllowed,
  daysWithoutResponse,
  nextStatuses,
  salaryRangeShape,
  statusTransition,
} from "./rules";

const allStatuses: readonly ApplicationStatus[] = [
  "draft",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
];

const legalMoves: ReadonlyArray<[ApplicationStatus, ApplicationStatus]> = [
  ["draft", "applied"],
  ["draft", "withdrawn"],
  ["applied", "screening"],
  ["applied", "rejected"],
  ["applied", "withdrawn"],
  ["screening", "interview"],
  ["screening", "rejected"],
  ["screening", "withdrawn"],
  ["interview", "interview"],
  ["interview", "offer"],
  ["interview", "rejected"],
  ["interview", "withdrawn"],
  ["offer", "rejected"],
  ["offer", "withdrawn"],
];

const illegalMoves: ReadonlyArray<[ApplicationStatus, ApplicationStatus]> = [
  ["draft", "draft"],
  ["draft", "screening"],
  ["draft", "interview"],
  ["draft", "offer"],
  ["draft", "rejected"],
  ["applied", "draft"],
  ["applied", "applied"],
  ["applied", "interview"],
  ["applied", "offer"],
  ["screening", "applied"],
  ["screening", "offer"],
  ["interview", "screening"],
  ["offer", "interview"],
  ["offer", "offer"],
];

describe("isStatusTransitionAllowed", () => {
  it.each(legalMoves)("allows %s -> %s", (from, to) => {
    expect(isStatusTransitionAllowed(from, to)).toBe(true);
  });

  it.each(illegalMoves)("forbids %s -> %s", (from, to) => {
    expect(isStatusTransitionAllowed(from, to)).toBe(false);
  });

  it.each(["rejected", "withdrawn"] as const)("treats %s as terminal", (terminal) => {
    for (const to of allStatuses) {
      expect(isStatusTransitionAllowed(terminal, to)).toBe(false);
    }
  });
});

describe("nextStatuses", () => {
  it.each(allStatuses)("offers from %s exactly what isStatusTransitionAllowed allows", (from) => {
    expect(nextStatuses(from)).toEqual(
      allStatuses.filter((to) => isStatusTransitionAllowed(from, to)),
    );
  });

  it("lists the moves in process order", () => {
    expect(nextStatuses("applied")).toEqual(["screening", "rejected", "withdrawn"]);
    expect(nextStatuses("interview")).toEqual(["interview", "offer", "rejected", "withdrawn"]);
  });

  it.each(["rejected", "withdrawn"] as const)("offers nothing from %s", (terminal) => {
    expect(nextStatuses(terminal)).toEqual([]);
  });
});

describe("statusTransition", () => {
  const at = new Date("2026-03-10T12:00:00Z");

  it.each(legalMoves)("moves %s -> %s, entered and contacted at the given time", (from, to) => {
    const result = statusTransition(anApplication({ status: from }), to, at);

    expect(result.status).toBe(to);
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

  it.each(illegalMoves)("throws IllegalStatusTransitionError for %s -> %s", (from, to) => {
    const attempt = () => statusTransition(anApplication({ status: from }), to, at);

    expect(attempt).toThrow(IllegalStatusTransitionError);
    expect(attempt).toThrow(`Cannot transition application from "${from}" to "${to}"`);
  });

  it("exposes the attempted move on the error", () => {
    let caught: unknown;
    try {
      statusTransition(anApplication({ status: "offer" }), "interview", at);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IllegalStatusTransitionError);
    const error = caught as IllegalStatusTransitionError;
    expect(error.name).toBe("IllegalStatusTransitionError");
    expect(error.from).toBe("offer");
    expect(error.to).toBe("interview");
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
