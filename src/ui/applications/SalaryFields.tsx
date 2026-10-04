"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { salaryAmounts, salaryPeriods } from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { Field, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { messages } from "@/ui/messages";

export type SalaryFieldsProps = {
  register: UseFormRegister<CreateApplicationInput>;
  errors: FieldErrors<CreateApplicationInput>["salary"];
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

export function SalaryFields({ register, errors, open, onOpenChange }: SalaryFieldsProps) {
  const currencyInvalid = errors?.currency !== undefined;
  const periodInvalid = errors?.period !== undefined;

  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className="rounded-lg border px-4 py-3"
    >
      <summary className="cursor-pointer font-medium">{t.title}</summary>
      <div className="mt-4 flex flex-col gap-5">
        <p id={hintId} className="text-sm text-muted-foreground">
          {t.hint}
        </p>

        {salaryAmounts.map((amount) => {
          const invalid = errors?.[amount] !== undefined;
          const errorId = `salary-${amount}-error`;
          return (
            <div key={amount} className="flex flex-col gap-2">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["min", "max"] as const).map((end) => {
                  const id = `salary-${amount}-${end}`;
                  return (
                    <Field key={end} data-invalid={invalid ? true : undefined}>
                      <FieldLabel htmlFor={id}>
                        {end === "min" ? t.amounts[amount].from : t.amounts[amount].to}
                      </FieldLabel>
                      <Input
                        id={id}
                        inputMode="numeric"
                        autoComplete="off"
                        {...describedBy(invalid, errorId, true)}
                        {...register(`salary.${amount}.${end}`, {
                          setValueAs: amountValue,
                          // The schema pins a reversed range to min, so a fixed max must recheck it.
                          deps: end === "max" ? `salary.${amount}.min` : undefined,
                        })}
                      />
                    </Field>
                  );
                })}
              </div>
              <FieldError id={errorId} errors={invalid ? [{ message: t.errors.amount }] : []} />
            </div>
          );
        })}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={currencyInvalid ? true : undefined}>
            <FieldLabel htmlFor="salary-currency">{t.currency}</FieldLabel>
            <Input
              id="salary-currency"
              maxLength={3}
              autoComplete="off"
              className="uppercase"
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
