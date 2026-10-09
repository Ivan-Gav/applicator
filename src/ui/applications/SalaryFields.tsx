"use client";

import { Fragment } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { salaryAmounts, salaryPeriods } from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";
import { panel, panelSummary } from "./panel";

export type SalaryFieldsProps = {
  register: UseFormRegister<CreateApplicationInput>;
  errors: FieldErrors<CreateApplicationInput>["salary"];
  /** Shown at the end of the title line, e.g. "60,000–70,000 EUR per year"; empty for none. */
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const t = messages.applications.form.salary;
const hintId = "salary-hint";

// Digits become a number, blank becomes unknown; anything else stays text for
// the schema to reject.
function amountValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

function describedBy(invalid: boolean, errorId: string, withHint = false) {
  const ids = [invalid ? errorId : undefined, withHint ? hintId : undefined].filter(Boolean);
  return {
    "aria-invalid": invalid ? true : undefined,
    "aria-describedby": ids.length > 0 ? ids.join(" ") : undefined,
  } as const;
}

export function SalaryFields({ register, errors, summary, open, onOpenChange }: SalaryFieldsProps) {
  const currencyInvalid = errors?.currency !== undefined;
  const periodInvalid = errors?.period !== undefined;

  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className={panel}
    >
      <summary className={panelSummary}>
        <span>{t.title}</span>
        {summary && (
          <span className="font-mono text-[13px] font-normal text-muted-foreground">{summary}</span>
        )}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {t.hint}
        </p>

        {/* A row per amount: its label, then the from and to boxes, which carry their own names. */}
        <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-x-2.5 gap-y-2">
          {salaryAmounts.map((amount) => {
            const invalid = errors?.[amount] !== undefined;
            const errorId = `salary-${amount}-error`;
            return (
              <Fragment key={amount}>
                <span aria-hidden className="text-[13px] font-semibold">
                  {t.rows[amount]}
                </span>
                {(["min", "max"] as const).map((end) => (
                  <Input
                    key={end}
                    id={`salary-${amount}-${end}`}
                    aria-label={end === "min" ? t.amounts[amount].from : t.amounts[amount].to}
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    {...describedBy(invalid, errorId, true)}
                    {...register(`salary.${amount}.${end}`, {
                      setValueAs: amountValue,
                      // The schema pins a reversed range to min, so a fixed max must recheck it.
                      deps: end === "max" ? `salary.${amount}.min` : undefined,
                    })}
                  />
                ))}
                {invalid && (
                  <FieldError
                    id={errorId}
                    className="col-span-3"
                    errors={[{ message: t.errors.amount }]}
                  />
                )}
              </Fragment>
            );
          })}
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-2.5">
          <Field data-invalid={currencyInvalid ? true : undefined}>
            <FieldLabel htmlFor="salary-currency">{t.currency}</FieldLabel>
            <Input
              id="salary-currency"
              maxLength={3}
              autoComplete="off"
              className="font-mono uppercase"
              {...describedBy(currencyInvalid, "salary-currency-error")}
              {...register("salary.currency")}
            />
            <FieldError
              id="salary-currency-error"
              errors={currencyInvalid ? [{ message: t.errors.currency }] : []}
            />
          </Field>

          <Field data-invalid={periodInvalid ? true : undefined}>
            <FieldLabel htmlFor="salary-period">{t.period}</FieldLabel>
            <NativeSelect
              id="salary-period"
              className="w-full"
              {...describedBy(periodInvalid, "salary-period-error")}
              {...register("salary.period")}
            >
              {salaryPeriods.map((period) => (
                <NativeSelectOption key={period} value={period}>
                  {messages.applications.salary.period[period]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError
              id="salary-period-error"
              errors={periodInvalid ? [{ message: t.errors.period }] : []}
            />
          </Field>
        </div>
      </div>
    </details>
  );
}
