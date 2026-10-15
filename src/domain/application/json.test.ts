import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ApplicationJsonReading,
  JsonReadFailure,
  readApplicationJson,
  readApplicationObject,
} from "./json";

function read(object: unknown): ApplicationJsonReading {
  const outcome = readApplicationJson(JSON.stringify(object));
  if (!outcome.ok) {
    throw new Error(`expected an object, got ${outcome.failure}`);
  }
  return outcome.reading;
}

const fullObject = {
  companyName: "Initech",
  positionTitle: "Platform Engineer",
  seniority: "senior",
  status: "applied",
  appliedAt: "2026-09-01",
  city: "München",
  country: "Germany",
  workMode: "hybrid",
  channel: "agency",
  source: "LinkedIn",
  sourceUrl: "https://example.com/jobs/1",
  applicationUrl: "https://example.com/apply/1",
  notes: "Cover letter drafted.",
  salary: {
    advertised: { min: 60000, max: 70000 },
    estimated: { min: 65000, max: null },
    asked: { min: 72000, max: 72000 },
    currency: "EUR",
    period: "year",
  },
  contact: {
    name: "Jane Doe",
    role: "Recruiter",
    email: "jane@example.com",
    phone: "+49 30 1234567",
    url: "https://example.com/in/jane",
  },
};

describe("readApplicationJson", () => {
  it("accepts every field of a full object as written", () => {
    expect(read(fullObject)).toEqual({ values: fullObject, rejected: [], unknownKeys: [] });
  });

  it("accepts a sparse object, leaving the rest absent", () => {
    expect(read({ companyName: "Acme", positionTitle: "Engineer", city: "Berlin" })).toEqual({
      values: { companyName: "Acme", positionTitle: "Engineer", city: "Berlin" },
      rejected: [],
      unknownKeys: [],
    });
  });

  it("treats null and blank text as absent, not as rejected", () => {
    expect(read({ companyName: "  ", seniority: null, salary: { advertised: {} } })).toEqual({
      values: {},
      rejected: [],
      unknownKeys: [],
    });
  });

  it("cleans text the way the form does", () => {
    expect(read({ companyName: "  Acme  ", source: " Berlin   Tech Meetup " }).values).toEqual({
      companyName: "Acme",
      source: "Berlin Tech Meetup",
    });
  });

  it.each([
    ["status", "Applied", "applied"],
    ["status", "TAKE-HOME", "assignment"],
    ["workMode", "Remote", "remote"],
    ["workMode", "On-site", "on_site"],
    ["workMode", "on site", "on_site"],
    ["seniority", "Mid-Level", "mid"],
    ["seniority", "Sr.", "senior"],
    ["channel", "Referral", "referral"],
  ])("matches %s %j to %j", (field, given, expected) => {
    expect(read({ [field]: given })).toEqual({
      values: { [field]: expected },
      rejected: [],
      unknownKeys: [],
    });
  });

  it.each([
    ["status", "ghosted"],
    ["workMode", "Full-time"],
    ["seniority", "Principal"],
    ["channel", "LinkedIn"],
    ["status", 3],
  ])("rejects %s %j, which names no value of its set", (field, given) => {
    expect(read({ [field]: given })).toEqual({
      values: {},
      rejected: [{ field, value: given }],
      unknownKeys: [],
    });
  });

  it.each([
    ["Monthly", "month"],
    ["per annum", "year"],
    ["p.a.", "year"],
    ["HOURLY", "hour"],
  ])("matches salary period %j to %j", (given, expected) => {
    expect(read({ salary: { period: given } }).values).toEqual({ salary: { period: expected } });
  });

  it.each([
    ["usd", "USD"],
    ["€", "EUR"],
    ["Euro", "EUR"],
    ["£", "GBP"],
  ])("matches currency %j to %j", (given, expected) => {
    expect(read({ salary: { currency: given } }).values).toEqual({
      salary: { currency: expected },
    });
  });

  it.each(["$", "Dollars", "EURO2"])("rejects currency %j, which names no single code", (given) => {
    expect(read({ salary: { currency: given } })).toEqual({
      values: {},
      rejected: [{ field: "salary.currency", value: given }],
      unknownKeys: [],
    });
  });

  it.each([
    ["60,000", 60_000],
    ["60.000", 60_000],
    ["60 000", 60_000],
    ["60k", 60_000],
    ["60000", 60_000],
  ])("reads salary amount %j as %d", (given, expected) => {
    expect(read({ salary: { advertised: { min: given } } }).values).toEqual({
      salary: { advertised: { min: expected, max: null } },
    });
  });

  it("rejects one end of a range alone, keeping the other", () => {
    expect(read({ salary: { advertised: { min: "lots", max: 70000 } } })).toEqual({
      values: { salary: { advertised: { min: null, max: 70_000 } } },
      rejected: [{ field: "salary.advertised.min", value: "lots" }],
      unknownKeys: [],
    });
  });

  it("rejects a range whose minimum is above its maximum", () => {
    const advertised = { min: 80000, max: 70000 };
    expect(read({ salary: { advertised } })).toEqual({
      values: {},
      rejected: [{ field: "salary.advertised", value: advertised }],
      unknownKeys: [],
    });
  });

  it.each([
    ["2026-09-01", "2026-09-01"],
    ["2026-09-01T10:30:00Z", "2026-09-01"],
    ["01.09.2026", "2026-09-01"],
    ["1 September 2026", "2026-09-01"],
    ["Sept 1st, 2026", "2026-09-01"],
    ["13/09/2026", "2026-09-13"],
  ])("reads the applied date %j as %j", (given, expected) => {
    expect(read({ appliedAt: given }).values).toEqual({ appliedAt: expected });
  });

  it.each(["09/01/2026", "yesterday", "2026-02-30", "1.9.26"])(
    "rejects the applied date %j, which names no single real day",
    (given) => {
      expect(read({ appliedAt: given })).toEqual({
        values: {},
        rejected: [{ field: "appliedAt", value: given }],
        unknownKeys: [],
      });
    },
  );

  it("rejects text the schema refuses, such as an address without its scheme", () => {
    expect(
      read({ sourceUrl: "example.com/jobs/1", contact: { email: "jane at example" } }),
    ).toEqual({
      values: {},
      rejected: [
        { field: "sourceUrl", value: "example.com/jobs/1" },
        { field: "contact.email", value: "jane at example" },
      ],
      unknownKeys: [],
    });
  });

  it("rejects a block that is not an object", () => {
    expect(read({ salary: "60k", contact: ["Jane"] }).rejected).toEqual([
      { field: "salary", value: "60k" },
      { field: "contact", value: ["Jane"] },
    ]);
  });

  it("lists keys the format does not know and reads the rest", () => {
    expect(
      read({
        companyName: "Acme",
        employmentType: "Full-time",
        salary: { bonus: 5000, advertised: { min: 1, currency: "EUR" } },
        contact: { linkedin: "jane" },
      }),
    ).toEqual({
      values: { companyName: "Acme", salary: { advertised: { min: 1, max: null } } },
      rejected: [],
      unknownKeys: [
        "employmentType",
        "salary.bonus",
        "salary.advertised.currency",
        "contact.linkedin",
      ],
    });
  });

  it("fills every other field when one value is bad", () => {
    const reading = read({ ...fullObject, workMode: "Full-time" });

    expect(reading.rejected).toEqual([{ field: "workMode", value: "Full-time" }]);
    expect(reading.values).toEqual({ ...fullObject, workMode: undefined });
  });

  it.each([
    ["text that is not JSON", "{ companyName: Acme }", JsonReadFailure.Malformed],
    ["nothing at all", "", JsonReadFailure.Malformed],
    ["a list", '[{ "companyName": "Acme" }]', JsonReadFailure.List],
    ["a single value", '"Acme"', JsonReadFailure.NotAnObject],
    ["null", "null", JsonReadFailure.NotAnObject],
  ])("refuses %s", (_, text, failure) => {
    expect(readApplicationJson(text)).toEqual({ ok: false, failure });
  });
});

describe("readApplicationObject", () => {
  it("reads an object already parsed, as a list import would hand it over", () => {
    expect(readApplicationObject({ companyName: "Acme" }).values).toEqual({ companyName: "Acme" });
  });
});

describe("the format document", () => {
  const document = readFileSync(
    new URL("../../../docs/application-json.md", import.meta.url),
    "utf8",
  );
  const examples = [...document.matchAll(/```json\n([\s\S]*?)```/g)].map(([, json]) => json ?? "");

  it("holds examples", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("has an example that is read whole: %s", (json) => {
    const outcome = readApplicationJson(json);

    expect(outcome).toMatchObject({ ok: true, reading: { rejected: [], unknownKeys: [] } });
    expect(outcome.ok && outcome.reading.values).toEqual(JSON.parse(json));
  });
});
