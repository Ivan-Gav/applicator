import { describe, expect, it } from "vitest";
import type { ApplicationJsonReading } from "@/domain/application/json";
import { applicationFormValues, formValuesFromJson } from "./application-form-values";

function reading(overrides: Partial<ApplicationJsonReading>): ApplicationJsonReading {
  return { values: {}, rejected: [], unknownKeys: [], ...overrides };
}

describe("formValuesFromJson", () => {
  const blank = applicationFormValues();

  it("is a new form with each accepted value in its field", () => {
    const filled = formValuesFromJson(
      reading({
        values: {
          companyName: "Initech",
          workMode: "remote",
          salary: { advertised: { min: 60_000, max: null }, period: "month" },
          contact: { name: "Jane Doe" },
        },
      }),
    );

    expect(filled).toEqual({
      ...blank,
      companyName: "Initech",
      workMode: "remote",
      salary: { ...blank.salary, advertised: { min: 60_000, max: null }, period: "month" },
      contact: { ...blank.contact, name: "Jane Doe" },
    });
  });

  it("starts the applied day at midnight in this runtime's time zone", () => {
    const filled = formValuesFromJson(reading({ values: { appliedAt: "2026-09-01" } }));

    expect(filled.appliedAt).toEqual(new Date(2026, 8, 1));
  });

  it("leaves a field whose value was rejected as a new form starts it", () => {
    const filled = formValuesFromJson(
      reading({
        values: { companyName: "Initech" },
        rejected: [
          { field: "workMode", value: "Full-time" },
          { field: "status", value: "ghosted" },
          { field: "appliedAt", value: "09/01/2026" },
        ],
      }),
    );

    expect(filled).toEqual({ ...blank, companyName: "Initech" });
  });

  it("leaves a rejected currency empty rather than at the default", () => {
    const filled = formValuesFromJson(
      reading({ rejected: [{ field: "salary.currency", value: "$" }] }),
    );

    expect(filled.salary?.currency).toBe("");
  });
});
