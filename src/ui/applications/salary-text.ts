import {
  type Salary,
  type SalaryPeriod,
  type SalaryRange,
  SalaryRangeKind,
  salaryPeriods,
} from "@/domain/application/model";
import { salaryRangeShape } from "@/domain/application/rules";
import { messages } from "@/ui/messages";

const t = messages.applications.salary;
const amountFormat = new Intl.NumberFormat("en-GB");

function withUnits(range: string, { currency, period }: Pick<Salary, "currency" | "period">) {
  return t.amount(range, currency, t.period[period]);
}

/** One salary amount as a phrase, e.g. "60,000–70,000 EUR per year". */
export function salaryText(range: SalaryRange, units: Pick<Salary, "currency" | "period">): string {
  const shape = salaryRangeShape(range);
  switch (shape.kind) {
    case SalaryRangeKind.Unknown:
      return t.range.unknown();
    case SalaryRangeKind.Exact:
      return withUnits(t.range.exact({ amount: amountFormat.format(shape.amount) }), units);
    case SalaryRangeKind.Between:
      return withUnits(
        t.range.between({
          min: amountFormat.format(shape.min),
          max: amountFormat.format(shape.max),
        }),
        units,
      );
    case SalaryRangeKind.From:
      return withUnits(t.range.from({ min: amountFormat.format(shape.min) }), units);
    case SalaryRangeKind.UpTo:
      return withUnits(t.range.up_to({ max: amountFormat.format(shape.max) }), units);
  }
}

/**
 * The advertised amount from the salary form's raw values, for the panel's
 * summary line: "70,000–84,000 EUR per year", or "" while it is unknown or
 * not yet a number.
 */
export function advertisedSalaryText([min, max, currency, period]: readonly unknown[]): string {
  const amount = (value: unknown) => (typeof value === "number" ? value : null);
  const range = { min: amount(min), max: amount(max) };
  if (salaryRangeShape(range).kind === SalaryRangeKind.Unknown || !isSalaryPeriod(period)) {
    return "";
  }
  return salaryText(range, {
    currency:
      typeof currency === "string" && currency.trim() !== "" ? currency.toUpperCase() : null,
    period,
  });
}

function isSalaryPeriod(value: unknown): value is SalaryPeriod {
  return salaryPeriods.some((period) => period === value);
}
