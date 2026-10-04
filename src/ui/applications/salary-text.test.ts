import { describe, expect, it } from "vitest";
import { messages } from "@/ui/messages";
import { salaryText } from "./salary-text";

const t = messages.applications.salary;
const eurPerYear = { currency: "EUR", period: "year" } as const;
const perYear = (range: string) => t.amount(range, "EUR", t.period.year);

describe("salaryText", () => {
  it.each([
    [{ min: 70_000, max: 70_000 }, perYear(t.range.exact({ amount: "70,000" }))],
    [{ min: 60_000, max: 70_000 }, perYear(t.range.between({ min: "60,000", max: "70,000" }))],
    [{ min: 60_000, max: null }, perYear(t.range.from({ min: "60,000" }))],
    [{ min: null, max: 80_000 }, perYear(t.range.up_to({ max: "80,000" }))],
  ])("reads %j as %j", (range, text) => {
    expect(salaryText(range, eurPerYear)).toBe(text);
  });

  it("says the amount is not stated, without units, when both ends are unknown", () => {
    expect(salaryText({ min: null, max: null }, eurPerYear)).toBe(t.range.unknown());
  });

  it("leaves out a currency that is unknown", () => {
    const range = { min: 45, max: 45 };
    const amount = t.range.exact({ amount: "45" });

    expect(salaryText(range, { currency: null, period: "hour" })).toBe(
      t.amount(amount, null, t.period.hour),
    );
    expect(t.amount(amount, null, t.period.hour)).toBe(`${amount} ${t.period.hour}`);
  });
});
