import { describe, expect, it } from "vitest";
import type { Application } from "@/domain/application/model";
import type { CreateApplication } from "@/domain/application/schema";
import {
  type ApplicationInsertRow,
  type ApplicationRow,
  toDomain,
  toRow,
} from "./application.mapper";

const userId = "00000000-0000-4000-8000-00000000000a";

// Every value distinct, so a swapped column cannot pass unnoticed.
const fullRow: ApplicationRow = {
  id: "00000000-0000-4000-8000-0000000000a1",
  user_id: userId,
  company_name: "Acme",
  position_title: "Backend Engineer",
  seniority: "senior",
  city: "Berlin",
  country: "Germany",
  work_mode: "hybrid",
  channel: "referral",
  source: "LinkedIn",
  source_url: "https://example.com/jobs/1",
  application_url: "https://example.com/apply/1",
  status: "interview",
  applied_at: "2026-09-01T00:00:00+00:00",
  last_contact_at: "2026-09-10T14:30:00.123+00:00",
  salary_advertised_min: 60_000,
  salary_advertised_max: 70_000,
  salary_estimated_min: 75_000,
  salary_estimated_max: 80_000,
  salary_asked_min: 72_000,
  salary_asked_max: 74_000,
  salary_currency: "CHF",
  salary_period: "year",
  contact_name: "Jane Doe",
  contact_role: "Recruiter",
  contact_email: "jane@example.com",
  contact_phone: "+49 30 1234567",
  contact_url: "https://linkedin.com/in/jane",
  notes: "Referred by Max",
  archived_at: "2026-09-20T08:00:00+00:00",
  created_at: "2026-08-31T10:00:00+00:00",
  updated_at: "2026-09-20T08:00:00+00:00",
};

const fullApplication: Application = {
  id: "00000000-0000-4000-8000-0000000000a1",
  companyName: "Acme",
  positionTitle: "Backend Engineer",
  seniority: "senior",
  city: "Berlin",
  country: "Germany",
  workMode: "hybrid",
  channel: "referral",
  source: "LinkedIn",
  sourceUrl: "https://example.com/jobs/1",
  applicationUrl: "https://example.com/apply/1",
  status: "interview",
  appliedAt: new Date("2026-09-01T00:00:00.000Z"),
  lastContactAt: new Date("2026-09-10T14:30:00.123Z"),
  salary: {
    advertised: { min: 60_000, max: 70_000 },
    estimated: { min: 75_000, max: 80_000 },
    asked: { min: 72_000, max: 74_000 },
    currency: "CHF",
    period: "year",
  },
  contact: {
    name: "Jane Doe",
    role: "Recruiter",
    email: "jane@example.com",
    phone: "+49 30 1234567",
    url: "https://linkedin.com/in/jane",
  },
  notes: "Referred by Max",
  archivedAt: new Date("2026-09-20T08:00:00.000Z"),
};

const emptyRow: ApplicationRow = {
  ...fullRow,
  seniority: null,
  city: null,
  country: null,
  work_mode: null,
  channel: "direct",
  source: null,
  source_url: null,
  application_url: null,
  status: "draft",
  applied_at: null,
  last_contact_at: null,
  salary_advertised_min: null,
  salary_advertised_max: null,
  salary_estimated_min: null,
  salary_estimated_max: null,
  salary_asked_min: null,
  salary_asked_max: null,
  salary_currency: null,
  salary_period: null,
  contact_name: null,
  contact_role: null,
  contact_email: null,
  contact_phone: null,
  contact_url: null,
  notes: null,
  archived_at: null,
};

const fullInput: CreateApplication = {
  companyName: "Acme",
  positionTitle: "Backend Engineer",
  status: "interview",
  appliedAt: new Date("2026-09-01T00:00:00.000Z"),
  seniority: "senior",
  city: "Berlin",
  country: "Germany",
  workMode: "hybrid",
  channel: "referral",
  source: "LinkedIn",
  sourceUrl: "https://example.com/jobs/1",
  applicationUrl: "https://example.com/apply/1",
  salary: fullApplication.salary,
  contact: fullApplication.contact,
  notes: "Referred by Max",
};

const emptyInput: CreateApplication = {
  companyName: "Acme",
  positionTitle: "Backend Engineer",
  status: "draft",
  appliedAt: null,
  seniority: null,
  city: null,
  country: null,
  workMode: null,
  channel: "direct",
  source: null,
  sourceUrl: null,
  applicationUrl: null,
  salary: {
    advertised: { min: null, max: null },
    estimated: { min: null, max: null },
    asked: { min: null, max: null },
    currency: null,
    period: null,
  },
  contact: { name: null, role: null, email: null, phone: null, url: null },
  notes: null,
};

// What the database adds to an insert: the columns toRow leaves to defaults.
function stored(insert: ApplicationInsertRow): ApplicationRow {
  return {
    ...emptyRow,
    ...insert,
    id: fullRow.id,
    last_contact_at: null,
    archived_at: null,
    created_at: fullRow.created_at,
    updated_at: fullRow.updated_at,
  };
}

describe("toDomain", () => {
  it("maps every column to its domain field", () => {
    expect(toDomain(fullRow)).toEqual(fullApplication);
  });

  it("keeps every nullable column null", () => {
    expect(toDomain(emptyRow)).toEqual({
      id: fullRow.id,
      companyName: "Acme",
      positionTitle: "Backend Engineer",
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
      salary: emptyInput.salary,
      contact: emptyInput.contact,
      notes: null,
      archivedAt: null,
    } satisfies Application);
  });

  it("carries no storage artifacts into the domain", () => {
    const application = toDomain(fullRow);

    expect(application).not.toHaveProperty("userId");
    expect(application).not.toHaveProperty("createdAt");
    expect(application).not.toHaveProperty("updatedAt");
    expect(Object.keys(application).filter((key) => key.includes("_"))).toEqual([]);
  });

  it("reads timestamps with an offset as the same instant", () => {
    const application = toDomain({ ...fullRow, applied_at: "2026-09-01T02:00:00+02:00" });

    expect(application.appliedAt).toEqual(new Date("2026-09-01T00:00:00.000Z"));
  });

  it.each([
    ["status", { status: "ghosted" }],
    ["channel", { channel: "headhunter" }],
    ["seniority", { seniority: "principal" }],
    ["work_mode", { work_mode: "onsite" }],
    ["salary_period", { salary_period: "week" }],
  ] as const)("refuses an unknown %s instead of passing it through", (column, override) => {
    expect(() => toDomain({ ...fullRow, ...override })).toThrow(`application.${column}`);
  });
});

describe("toRow", () => {
  it("maps every field to its column, owned by the given user", () => {
    expect(toRow(userId, fullInput)).toEqual({
      user_id: userId,
      company_name: "Acme",
      position_title: "Backend Engineer",
      status: "interview",
      applied_at: "2026-09-01T00:00:00.000Z",
      seniority: "senior",
      city: "Berlin",
      country: "Germany",
      work_mode: "hybrid",
      channel: "referral",
      source: "LinkedIn",
      source_url: "https://example.com/jobs/1",
      application_url: "https://example.com/apply/1",
      salary_advertised_min: 60_000,
      salary_advertised_max: 70_000,
      salary_estimated_min: 75_000,
      salary_estimated_max: 80_000,
      salary_asked_min: 72_000,
      salary_asked_max: 74_000,
      salary_currency: "CHF",
      salary_period: "year",
      contact_name: "Jane Doe",
      contact_role: "Recruiter",
      contact_email: "jane@example.com",
      contact_phone: "+49 30 1234567",
      contact_url: "https://linkedin.com/in/jane",
      notes: "Referred by Max",
    } satisfies ApplicationInsertRow);
  });

  it("writes unknown values as null rather than leaving them to column defaults", () => {
    const row = toRow(userId, emptyInput);

    expect(row.applied_at).toBeNull();
    // salary_currency defaults to EUR in the table; an explicit null must survive.
    expect(row.salary_currency).toBeNull();
    expect(row).toMatchObject({
      seniority: null,
      city: null,
      country: null,
      work_mode: null,
      source: null,
      source_url: null,
      application_url: null,
      salary_advertised_min: null,
      salary_advertised_max: null,
      salary_estimated_min: null,
      salary_estimated_max: null,
      salary_asked_min: null,
      salary_asked_max: null,
      salary_period: null,
      contact_name: null,
      contact_role: null,
      contact_email: null,
      contact_phone: null,
      contact_url: null,
      notes: null,
    });
  });

  it("leaves identity, timestamps and archiving to the database", () => {
    const row = toRow(userId, fullInput);

    for (const column of ["id", "created_at", "updated_at", "last_contact_at", "archived_at"]) {
      expect(row).not.toHaveProperty(column);
    }
  });
});

describe("round trip", () => {
  it.each([
    ["every field set", fullInput],
    ["every optional field null", emptyInput],
  ])("returns what went in with %s", (_, input) => {
    const { id, lastContactAt, archivedAt, ...roundTripped } = toDomain(
      stored(toRow(userId, input)),
    );

    expect(roundTripped).toEqual(input);
    expect(id).toBe(fullRow.id);
    expect(lastContactAt).toBeNull();
    expect(archivedAt).toBeNull();
  });
});
