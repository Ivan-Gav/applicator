import { describe, expect, it } from "vitest";
import {
  applicationIdSchema,
  applicationStatusSchema,
  contactSchema,
  createApplicationSchema,
  invalidApplicationFields,
  salaryRangeSchema,
  statusChangeSchema,
  updateApplicationSchema,
} from "./schema";

const required = { companyName: "Acme", positionTitle: "Engineer" };

function issuesAt(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.success ? [] : (result.error?.issues.map((issue) => issue.path.join(".")) ?? []);
}

describe("applicationStatusSchema", () => {
  it.each([
    "draft",
    "applied",
    "screening",
    "assignment",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
  ])("accepts %s", (status) => {
    expect(applicationStatusSchema.parse(status)).toBe(status);
  });

  it("rejects a status outside the allowed set", () => {
    expect(applicationStatusSchema.safeParse("ghosted").success).toBe(false);
  });
});

describe("salaryRangeSchema", () => {
  it("treats both amounts as unknown when omitted", () => {
    expect(salaryRangeSchema.parse({})).toEqual({ min: null, max: null });
  });

  it("accepts an exact figure where min equals max", () => {
    expect(salaryRangeSchema.parse({ min: 70_000, max: 70_000 })).toEqual({
      min: 70_000,
      max: 70_000,
    });
  });

  it("accepts an open-ended range", () => {
    expect(salaryRangeSchema.parse({ min: 60_000 })).toEqual({ min: 60_000, max: null });
    expect(salaryRangeSchema.parse({ max: 80_000 })).toEqual({ min: null, max: 80_000 });
  });

  it("rejects min greater than max", () => {
    const result = salaryRangeSchema.safeParse({ min: 90_000, max: 80_000 });

    expect(result.success).toBe(false);
    expect(issuesAt(result)).toContain("min");
  });

  it("rejects negative and fractional amounts", () => {
    expect(salaryRangeSchema.safeParse({ min: -1 }).success).toBe(false);
    expect(salaryRangeSchema.safeParse({ min: 1000.5 }).success).toBe(false);
  });

  it("rejects amounts beyond a 32-bit integer", () => {
    expect(salaryRangeSchema.safeParse({ max: 2_147_483_648 }).success).toBe(false);
  });

  // The same edges supabase/tests/database/salary_checks.test.sql pins.
  it("accepts zero and the largest 32-bit integer, as the database does", () => {
    expect(salaryRangeSchema.parse({ min: 0, max: 2_147_483_647 })).toEqual({
      min: 0,
      max: 2_147_483_647,
    });
  });
});

describe("contactSchema", () => {
  it("treats every part as unknown when omitted", () => {
    expect(contactSchema.parse({})).toEqual({
      name: null,
      role: null,
      email: null,
      phone: null,
      url: null,
    });
  });

  it("turns blank parts into null and trims the rest", () => {
    expect(contactSchema.parse({ name: "  Jane Doe ", role: "", email: "   " })).toEqual({
      name: "Jane Doe",
      role: null,
      email: null,
      phone: null,
      url: null,
    });
  });

  it("requires a well-formed email", () => {
    expect(contactSchema.parse({ email: "jane@example.com" }).email).toBe("jane@example.com");
    expect(issuesAt(contactSchema.safeParse({ email: "jane at example" }))).toEqual(["email"]);
  });

  it("accepts only http(s) urls", () => {
    expect(contactSchema.parse({ url: "https://linkedin.com/in/jane" }).url).toBe(
      "https://linkedin.com/in/jane",
    );
    expect(issuesAt(contactSchema.safeParse({ url: "linkedin.com/in/jane" }))).toEqual(["url"]);
  });
});

describe("createApplicationSchema", () => {
  it("fills every optional field with its default", () => {
    expect(createApplicationSchema.parse(required)).toEqual({
      companyName: "Acme",
      positionTitle: "Engineer",
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
        currency: "EUR",
        period: "year",
      },
      contact: { name: null, role: null, email: null, phone: null, url: null },
      notes: null,
    });
  });

  it("requires a company name and a position title", () => {
    expect(issuesAt(createApplicationSchema.safeParse({}))).toEqual([
      "companyName",
      "positionTitle",
    ]);
  });

  it.each(["companyName", "positionTitle"] as const)(
    "trims %s and rejects one made of whitespace",
    (field) => {
      expect(createApplicationSchema.parse({ ...required, [field]: "  Padded  " })[field]).toBe(
        "Padded",
      );
      expect(issuesAt(createApplicationSchema.safeParse({ ...required, [field]: "   " }))).toEqual([
        field,
      ]);
    },
  );

  it.each(["companyName", "positionTitle"] as const)(
    "rejects %s longer than 200 characters",
    (field) => {
      const result = createApplicationSchema.safeParse({ ...required, [field]: "x".repeat(201) });

      expect(issuesAt(result)).toEqual([field]);
    },
  );

  it("turns blank text fields into null", () => {
    const result = createApplicationSchema.parse({
      ...required,
      city: "",
      country: "   ",
      source: "",
      sourceUrl: "",
      notes: "",
    });

    expect(result.city).toBeNull();
    expect(result.country).toBeNull();
    expect(result.source).toBeNull();
    expect(result.sourceUrl).toBeNull();
    expect(result.notes).toBeNull();
  });

  it("trims the source so autocomplete sees one spelling per value", () => {
    expect(createApplicationSchema.parse({ ...required, source: " LinkedIn " }).source).toBe(
      "LinkedIn",
    );
  });

  it.each(["junior", "mid", "senior", "lead"] as const)("accepts seniority %s", (seniority) => {
    expect(createApplicationSchema.parse({ ...required, seniority }).seniority).toBe(seniority);
  });

  it.each(["on_site", "hybrid", "remote"] as const)("accepts work mode %s", (workMode) => {
    expect(createApplicationSchema.parse({ ...required, workMode }).workMode).toBe(workMode);
  });

  it.each(["direct", "agency", "referral"] as const)("accepts channel %s", (channel) => {
    expect(createApplicationSchema.parse({ ...required, channel }).channel).toBe(channel);
  });

  it("rejects values outside the enumerations", () => {
    const result = createApplicationSchema.safeParse({
      ...required,
      seniority: "principal",
      workMode: "onsite",
      channel: "headhunter",
      salary: { period: "week" },
    });

    expect(issuesAt(result)).toEqual(["seniority", "workMode", "channel", "salary.period"]);
  });

  it("requires a salary period, per year unless given", () => {
    expect(createApplicationSchema.parse({ ...required, salary: {} }).salary.period).toBe("year");
    expect(
      issuesAt(createApplicationSchema.safeParse({ ...required, salary: { period: null } })),
    ).toEqual(["salary.period"]);
  });

  it("accepts only http(s) urls", () => {
    const ok = createApplicationSchema.parse({
      ...required,
      sourceUrl: "https://example.com/jobs/1",
      applicationUrl: "http://example.com/apply",
    });
    expect(ok.sourceUrl).toBe("https://example.com/jobs/1");
    expect(ok.applicationUrl).toBe("http://example.com/apply");

    const bad = createApplicationSchema.safeParse({
      ...required,
      sourceUrl: "example.com/jobs/1",
      applicationUrl: "javascript:alert(1)",
    });
    expect(issuesAt(bad)).toEqual(["sourceUrl", "applicationUrl"]);
  });

  it("normalises the currency code to upper case and requires three letters", () => {
    const parsed = createApplicationSchema.parse({
      ...required,
      salary: { currency: "chf", period: "month" },
    });
    expect(parsed.salary.currency).toBe("CHF");
    expect(parsed.salary.period).toBe("month");

    expect(
      issuesAt(createApplicationSchema.safeParse({ ...required, salary: { currency: "€" } })),
    ).toEqual(["salary.currency"]);
    expect(
      issuesAt(createApplicationSchema.safeParse({ ...required, salary: { currency: "EURO" } })),
    ).toEqual(["salary.currency"]);
    expect(
      issuesAt(createApplicationSchema.safeParse({ ...required, salary: { currency: "€€€" } })),
    ).toEqual(["salary.currency"]);
  });

  it("allows an unknown currency", () => {
    const parsed = createApplicationSchema.parse({
      ...required,
      salary: { currency: null },
    });

    expect(parsed.salary.currency).toBeNull();
  });

  it("validates each salary range independently", () => {
    const result = createApplicationSchema.safeParse({
      ...required,
      salary: {
        advertised: { min: 50_000, max: 60_000 },
        estimated: { min: 90_000, max: 80_000 },
        asked: { min: 70_000, max: 65_000 },
        currency: "EUR",
        period: "year",
      },
    });

    expect(issuesAt(result)).toEqual(["salary.estimated.min", "salary.asked.min"]);
  });

  it("reports contact problems under their own path", () => {
    const result = createApplicationSchema.safeParse({
      ...required,
      contact: { email: "not-an-email", url: "ftp://example.com" },
    });

    expect(issuesAt(result)).toEqual(["contact.email", "contact.url"]);
  });

  it.each([
    "draft",
    "applied",
    "screening",
    "assignment",
    "interview",
    "offer",
    "rejected",
    "withdrawn",
  ] as const)("accepts %s as the starting status", (status) => {
    expect(createApplicationSchema.parse({ ...required, status }).status).toBe(status);
  });

  it("rejects a starting status outside the allowed set", () => {
    expect(issuesAt(createApplicationSchema.safeParse({ ...required, status: "ghosted" }))).toEqual(
      ["status"],
    );
  });

  it("accepts the applied date as an instant", () => {
    const appliedAt = new Date("2026-08-31T22:00:00.000Z");

    expect(createApplicationSchema.parse({ ...required, appliedAt }).appliedAt).toEqual(appliedAt);
  });

  it("treats a missing applied date as unknown", () => {
    expect(createApplicationSchema.parse({ ...required, appliedAt: null }).appliedAt).toBeNull();
    expect(createApplicationSchema.parse(required).appliedAt).toBeNull();
  });

  it.each(["2026-09-01", "", "yesterday", new Date("not a date")])(
    "rejects the applied date %j, which is not an instant",
    (appliedAt) => {
      expect(issuesAt(createApplicationSchema.safeParse({ ...required, appliedAt }))).toEqual([
        "appliedAt",
      ]);
    },
  );

  it("does not accept the timestamps only transitions and archiving set", () => {
    const parsed = createApplicationSchema.parse({
      ...required,
      lastContactAt: new Date(),
      archivedAt: new Date(),
    });

    expect(parsed).not.toHaveProperty("lastContactAt");
    expect(parsed).not.toHaveProperty("archivedAt");
  });

  it("drops fields it does not know, such as an owner", () => {
    const parsed = createApplicationSchema.parse({ ...required, userId: "someone", user_id: "x" });

    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("user_id");
  });
});

describe("updateApplicationSchema", () => {
  it("keeps untouched fields absent instead of resetting them to defaults", () => {
    expect(updateApplicationSchema.parse({ notes: "Called back" })).toEqual({
      notes: "Called back",
    });
  });

  it("rejects an empty patch", () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
    expect(updateApplicationSchema.safeParse({ notes: undefined }).success).toBe(false);
  });

  it("allows clearing a field explicitly", () => {
    expect(updateApplicationSchema.parse({ source: null, city: "" })).toEqual({
      source: null,
      city: null,
    });
  });

  it("does not allow clearing the company name", () => {
    expect(issuesAt(updateApplicationSchema.safeParse({ companyName: "" }))).toEqual([
      "companyName",
    ]);
  });

  it("applies the same field rules as creation", () => {
    const result = updateApplicationSchema.safeParse({
      positionTitle: " ",
      channel: "headhunter",
      applicationUrl: "ftp://example.com",
    });

    expect(issuesAt(result)).toEqual(["positionTitle", "channel", "applicationUrl"]);
  });

  it("replaces the salary block as a whole", () => {
    const parsed = updateApplicationSchema.parse({
      salary: { advertised: { min: 55_000 }, currency: "eur", period: "year" },
    });

    expect(parsed.salary).toEqual({
      advertised: { min: 55_000, max: null },
      estimated: { min: null, max: null },
      asked: { min: null, max: null },
      currency: "EUR",
      period: "year",
    });
  });

  it("replaces the contact block as a whole", () => {
    const parsed = updateApplicationSchema.parse({
      contact: { name: "Jane Doe", email: "jane@example.com" },
    });

    expect(parsed.contact).toEqual({
      name: "Jane Doe",
      role: null,
      email: "jane@example.com",
      phone: null,
      url: null,
    });
  });

  it("does not accept status or transition timestamps", () => {
    const parsed = updateApplicationSchema.parse({ positionTitle: "E", status: "offer" });

    expect(parsed).not.toHaveProperty("status");
  });
});

describe("invalidApplicationFields", () => {
  function fieldsOf(input: unknown) {
    const result = createApplicationSchema.safeParse(input);
    if (result.success) {
      throw new Error("expected the input to be rejected");
    }
    return invalidApplicationFields(result.error);
  }

  it("names each rejected top-level field", () => {
    expect(fieldsOf({ positionTitle: "Engineer", applicationUrl: "nope" })).toEqual([
      "companyName",
      "applicationUrl",
    ]);
  });

  it("names a nested block once, however many of its parts failed", () => {
    expect(
      fieldsOf({ ...required, contact: { email: "not-an-email", url: "ftp://example.com" } }),
    ).toEqual(["contact"]);
  });

  it("names the salary part a failure concerns, each once", () => {
    expect(
      fieldsOf({
        ...required,
        salary: {
          advertised: { min: 80_000, max: 70_000 },
          estimated: { min: -1, max: 1.5 },
          currency: "€",
        },
      }),
    ).toEqual(["salary.advertised", "salary.estimated", "salary.currency"]);
  });

  it("names the whole salary block when it is not a block at all", () => {
    expect(fieldsOf({ ...required, salary: "a lot" })).toEqual(["salary"]);
  });

  it("names nothing for a failure outside any field", () => {
    expect(fieldsOf("not an object")).toEqual([]);
  });

  it("names the fields of a rejected update the same way", () => {
    const result = updateApplicationSchema.safeParse({
      positionTitle: " ",
      salary: { asked: { min: 2, max: 1 } },
    });
    if (result.success) {
      throw new Error("expected the update to be rejected");
    }

    expect(invalidApplicationFields(result.error)).toEqual(["positionTitle", "salary.asked"]);
  });
});

describe("applicationIdSchema", () => {
  it("accepts a uuid", () => {
    expect(applicationIdSchema.parse("00000000-0000-4000-8000-0000000000a1")).toBe(
      "00000000-0000-4000-8000-0000000000a1",
    );
  });

  it.each(["", "1", "not-a-uuid", "00000000-0000-4000-8000-0000000000a1; drop table"])(
    "rejects %j, which the database could not take as an id",
    (id) => {
      expect(applicationIdSchema.safeParse(id).success).toBe(false);
    },
  );
});

describe("statusChangeSchema", () => {
  it("takes a status", () => {
    expect(statusChangeSchema.parse({ status: "screening" })).toEqual({ status: "screening" });
  });

  it("drops a date or a note: a change is dated when stored and carries nothing else", () => {
    expect(statusChangeSchema.parse({ status: "screening", at: new Date(), note: "Why" })).toEqual({
      status: "screening",
    });
  });

  it.each([
    ["an unknown status", { status: "ghosted" }],
    ["a missing status", {}],
  ])("rejects %s", (_, input) => {
    expect(issuesAt(statusChangeSchema.safeParse(input))).toEqual(["status"]);
  });
});
