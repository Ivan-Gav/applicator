import type { Application } from "@/domain/application/model";

/** A complete application with every optional field unknown. */
export function anApplication(overrides: Partial<Application> = {}): Application {
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
    status: "applied",
    statusChangedAt: new Date("2026-03-01T09:00:00Z"),
    appliedAt: new Date("2026-03-01T09:00:00Z"),
    lastContactAt: null,
    salary: {
      advertised: { min: null, max: null },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: "year",
    },
    contact: { name: null, role: null, email: null, phone: null, url: null },
    notes: null,
    archivedAt: null,
    ...overrides,
  };
}
