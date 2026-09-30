import { describe, expect, it } from "vitest";
import { type Application, type ApplicationStatus, SalaryRangeKind } from "./model";
import {
  IllegalTransitionError,
  canTransition,
  daysWithoutResponse,
  salaryRangeShape,
  transition,
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

function anApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
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
    status: "applied",
    appliedAt: new Date("2026-03-01T09:00:00Z"),
    lastContactAt: null,
    salary: {
      advertised: { min: null, max: null },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: null,
    },
    contact: { name: null, role: null, email: null, phone: null, url: null },
    notes: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("canTransition", () => {
  it.each(legalMoves)("allows %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(illegalMoves)("forbids %s -> %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it.each(["rejected", "withdrawn"] as const)("treats %s as terminal", (terminal) => {
    for (const to of allStatuses) {
      expect(canTransition(terminal, to)).toBe(false);
    }
  });
});

describe("transition", () => {
  const at = new Date("2026-03-10T12:00:00Z");

  it.each(legalMoves)("moves %s -> %s and records the contact time", (from, to) => {
    const result = transition(anApplication({ status: from }), to, at);

    expect(result.status).toBe(to);
    expect(result.lastContactAt).toEqual(at);
  });

  it("stamps appliedAt when the application is sent", () => {
    const draft = anApplication({ status: "draft", appliedAt: null });

    expect(transition(draft, "applied", at).appliedAt).toEqual(at);
  });

  it("keeps the original appliedAt on later moves", () => {
    const appliedAt = new Date("2026-03-01T09:00:00Z");
    const applied = anApplication({ status: "applied", appliedAt });

    expect(transition(applied, "screening", at).appliedAt).toEqual(appliedAt);
  });

  it("does not mutate its argument", () => {
    const original = anApplication({ status: "applied" });
    const snapshot = structuredClone(original);

    transition(original, "screening", at);

    expect(original).toEqual(snapshot);
  });

  it("returns a new object", () => {
    const original = anApplication({ status: "interview" });

    expect(transition(original, "interview", at)).not.toBe(original);
  });

  it.each(illegalMoves)("throws IllegalTransitionError for %s -> %s", (from, to) => {
    const attempt = () => transition(anApplication({ status: from }), to, at);

    expect(attempt).toThrow(IllegalTransitionError);
    expect(attempt).toThrow(`Cannot transition application from "${from}" to "${to}"`);
  });

  it("exposes the attempted move on the error", () => {
    let caught: unknown;
    try {
      transition(anApplication({ status: "offer" }), "interview", at);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IllegalTransitionError);
    const error = caught as IllegalTransitionError;
    expect(error.name).toBe("IllegalTransitionError");
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
