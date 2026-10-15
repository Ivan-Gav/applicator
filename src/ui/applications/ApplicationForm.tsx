"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type {
  ApplicationJsonReading,
  JsonApplicationField,
  RejectedValue,
} from "@/domain/application/json";
import {
  type Application,
  applicationStatuses,
  channels,
  seniorities,
  workModes,
} from "@/domain/application/model";
import {
  type ApplicationRejection,
  type CreateApplication,
  type CreateApplicationInput,
  createApplicationSchema,
} from "@/domain/application/schema";
import { localDay, startOfLocalDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/ui/kit/alert";
import { Button } from "@/ui/kit/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/ui/kit/field";
import { Input } from "@/ui/kit/input";
import { NativeSelect, NativeSelectOption } from "@/ui/kit/native-select";
import { awaitingHydrationClass, useHydrated } from "@/ui/hooks/use-hydrated";
import { Textarea } from "@/ui/kit/textarea";
import { messages } from "@/ui/messages";
import type { SuggestionSearch } from "@/ui/SuggestionField";
import { CityField } from "./CityField";
import { ContactFields } from "./ContactFields";
import { JsonPaste } from "./JsonPaste";
import { LeaveEmptyButton } from "./LeaveEmptyButton";
import { SalaryFields } from "./SalaryFields";
import { SourceField } from "./SourceField";
import {
  type ApplicationFormField,
  isApplicationFormField,
  isSalaryFormField,
} from "./application-form-fields";
import {
  applicationFormValues,
  formValuesFromJson,
  hasContact,
  hasSalary,
} from "./application-form-values";
import {
  changeConcerns,
  firstPastedValueControl,
  pastedValueControl,
  pastedValueError,
  rejectedWithin,
} from "./pasted-values";
import { advertisedSalaryText } from "./salary-text";

export type ApplicationFormProps = {
  /**
   * Stores the input. Resolves with the rejected fields, none once an edit is
   * saved; a new application navigates away instead.
   */
  save: (input: CreateApplication) => Promise<ApplicationRejection>;
  backHref: string;
  /** Where the city field looks cities up. */
  citySearch: SuggestionSearch;
  /** Where the source field looks sources up. */
  sourceSearch: SuggestionSearch;
  /** The application to edit; without it the form creates a new one. */
  application?: Application;
  /** Where the JSON format is described; a new application given one can be filled in from JSON. */
  jsonFormatHref?: string;
};

const t = messages.applications.form;
// Web addresses read better in a fixed-width face.
const mono = "font-mono text-[13px] md:text-[13px]";
const actionButton = "rounded-[3px] px-3.5 font-semibold";

// An unselected option submits "", which the enum fields do not accept.
const blankAsNull = (value: unknown) => (value === "" ? null : value);

// The picked day starts in the browser's time zone. What is not a real day
// stays a string, for the schema to reject.
const dayAsInstant = (value: unknown) =>
  value === "" ? null : typeof value === "string" ? (startOfLocalDay(value) ?? value) : value;

// What the date input shows for the form value: a picked day, or text the schema will reject.
const dayShown = (value: unknown) =>
  value instanceof Date ? localDay(value) : typeof value === "string" ? value : "";

export function ApplicationForm({
  save,
  backHref,
  citySearch,
  sourceSearch,
  application,
  jsonFormatHref,
}: ApplicationFormProps) {
  const editing = application !== undefined;
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<CreateApplicationInput, unknown, CreateApplication>({
    resolver: zodResolver(createApplicationSchema),
    defaultValues: applicationFormValues(application),
  });
  const [salaryOpen, setSalaryOpen] = useState(application ? hasSalary(application.salary) : false);
  const [contactOpen, setContactOpen] = useState(
    application ? hasContact(application.contact) : false,
  );
  // Pasted values that fit no field; each is shown until its field is changed.
  const [pasteRejected, setPasteRejected] = useState<readonly RejectedValue[]>([]);
  // Whether a save was refused for the marks; said only while some remain.
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const { errors, isSubmitting, isDirty } = form.formState;
  const pending = saving || isSubmitting;
  // An edit with nothing changed has nothing to save.
  const unchanged = editing && !isDirty;
  const salaryPasteRejected = rejectedWithin(pasteRejected, "salary");
  const contactPasteRejected = rejectedWithin(pasteRejected, "contact");
  const salaryShown = salaryOpen || errors.salary !== undefined || salaryPasteRejected.length > 0;
  const contactShown =
    contactOpen || errors.contact !== undefined || contactPasteRejected.length > 0;
  const contactNameAndRole = useWatch({
    control: form.control,
    name: ["contact.name", "contact.role"],
  });
  const salarySummary = advertisedSalaryText(
    useWatch({
      control: form.control,
      name: ["salary.advertised.min", "salary.advertised.max", "salary.currency", "salary.period"],
    }),
  );
  const contactSummary = t.contact.summary(
    contactNameAndRole.filter(
      (part): part is string => typeof part === "string" && part.trim() !== "",
    ),
  );

  useEffect(() => {
    return form.subscribe({
      formState: { values: true },
      callback: ({ name }) => {
        if (name !== undefined) {
          // The same array when nothing goes, so a keystroke re-renders nothing.
          setPasteRejected((rejected) => {
            const kept = rejected.filter(({ field }) => !changeConcerns(name, field));
            return kept.length === rejected.length ? rejected : kept;
          });
        }
      },
    });
  }, [form]);

  function fillInFromJson(reading: ApplicationJsonReading) {
    const next = formValuesFromJson(reading);
    for (const key of Object.keys(next) as (keyof CreateApplicationInput)[]) {
      form.setValue(key, next[key], { shouldDirty: true });
    }
    // After the values: setting them counts as changing them, which clears their marks.
    setPasteRejected(reading.rejected);
    if (reading.values.salary) {
      setSalaryOpen(true);
    }
    if (reading.values.contact) {
      setContactOpen(true);
    }
  }

  // Drops the marks of `fields`, accepting them empty, and returns focus to the first one's control.
  function leaveEmpty(fields: readonly JsonApplicationField[]) {
    setPasteRejected((rejected) => rejected.filter(({ field }) => !fields.includes(field)));
    const [first] = fields;
    if (first !== undefined) {
      form.setFocus(pastedValueControl(first));
    }
  }

  function showRejection({ invalidFields }: ApplicationRejection) {
    const shown = [
      ...invalidFields.filter(isApplicationFormField),
      ...invalidFields.filter(isSalaryFormField),
    ];
    for (const field of shown) {
      form.setError(field, { type: "server" });
    }
    if (shown.length < invalidFields.length) {
      setFailure(t.rejected);
    }
  }

  const submit = form.handleSubmit(
    (values) => {
      setFailure(null);
      // A marked field must be changed or left empty on purpose before anything is saved.
      const marked = firstPastedValueControl(pasteRejected);
      setPasteBlocked(marked !== undefined);
      if (marked !== undefined) {
        form.setFocus(marked);
        return;
      }
      const submitted = form.getValues();
      startSaving(async () => {
        try {
          const rejection = await save(values);
          showRejection(rejection);
          if (editing && rejection.invalidFields.length === 0) {
            // What was saved becomes the baseline; edits typed meanwhile stay.
            form.reset(submitted, { keepValues: true });
            toast.success(t.saved);
          }
        } catch (error) {
          // A successful save of a new application redirects, and Next.js
          // delivers that redirect here as a thrown error.
          // unstable_rethrow hands these back to Next.js; only real failures pass.
          unstable_rethrow(error);
          setFailure(t.saveFailed);
        }
      });
    },
    (invalid) => {
      setPasteBlocked(pasteRejected.length > 0);
      // Open before react-hook-form moves focus to the first error, which it
      // cannot do inside a closed <details>.
      flushSync(() => {
        if (invalid.salary) {
          setSalaryOpen(true);
        }
        if (invalid.contact) {
          setContactOpen(true);
        }
      });
    },
  );

  const isInvalid = (field: ApplicationFormField) =>
    errors[field] !== undefined || pasteRejected.some((rejection) => rejection.field === field);

  function describedBy(field: ApplicationFormField, hintId?: string) {
    const ids = [isInvalid(field) ? `${field}-error` : undefined, hintId].filter(Boolean);
    return {
      "aria-invalid": isInvalid(field) ? true : undefined,
      "aria-describedby": ids.length > 0 ? ids.join(" ") : undefined,
    } as const;
  }

  // Always this form's own wording, never the schema's message; then what was pasted.
  function error(field: ApplicationFormField) {
    const pasted = pasteRejected.filter((rejection) => rejection.field === field);
    return (
      <>
        <FieldError
          id={`${field}-error`}
          errors={
            isInvalid(field) ? [{ message: t.errors[field] }, ...pasted.map(pastedValueError)] : []
          }
        />
        {pasted.length > 0 && (
          <LeaveEmptyButton field={t.labels[field]} onClick={() => leaveEmpty([field])} />
        )}
      </>
    );
  }

  const invalidMark = (field: ApplicationFormField) => (isInvalid(field) ? true : undefined);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4.5">
      {!editing && jsonFormatHref !== undefined && (
        <JsonPaste onRead={fillInFromJson} formatHref={jsonFormatHref} />
      )}

      <Field data-invalid={invalidMark("companyName")}>
        <FieldLabel htmlFor="companyName">{t.labels.companyName}</FieldLabel>
        <Input
          id="companyName"
          autoComplete="organization"
          {...describedBy("companyName")}
          {...form.register("companyName")}
        />
        {error("companyName")}
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr]">
        <Field data-invalid={invalidMark("positionTitle")}>
          <FieldLabel htmlFor="positionTitle">{t.labels.positionTitle}</FieldLabel>
          <Input
            id="positionTitle"
            autoComplete="organization-title"
            {...describedBy("positionTitle")}
            {...form.register("positionTitle")}
          />
          {error("positionTitle")}
        </Field>

        <Field data-invalid={invalidMark("seniority")}>
          <FieldLabel htmlFor="seniority">{t.labels.seniority}</FieldLabel>
          <NativeSelect
            id="seniority"
            className="w-full"
            {...describedBy("seniority")}
            {...form.register("seniority", { setValueAs: blankAsNull })}
          >
            <NativeSelectOption value="">{t.seniorityUnset}</NativeSelectOption>
            {seniorities.map((seniority) => (
              <NativeSelectOption key={seniority} value={seniority}>
                {messages.applications.seniority[seniority]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("seniority")}
        </Field>
      </div>

      {!editing && (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field data-invalid={invalidMark("status")}>
            <FieldLabel htmlFor="status">{t.labels.status}</FieldLabel>
            <NativeSelect
              id="status"
              className="w-full"
              {...describedBy("status")}
              {...form.register("status")}
            >
              {applicationStatuses.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {messages.applications.status[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {error("status")}
          </Field>

          <Field data-invalid={invalidMark("appliedAt")}>
            <FieldLabel htmlFor="appliedAt">{t.labels.appliedAt}</FieldLabel>
            <Controller
              control={form.control}
              name="appliedAt"
              render={({ field }) => (
                <Input
                  id="appliedAt"
                  type="date"
                  ref={field.ref}
                  name={field.name}
                  value={dayShown(field.value)}
                  onChange={(event) => field.onChange(dayAsInstant(event.target.value))}
                  onBlur={field.onBlur}
                  {...describedBy("appliedAt")}
                />
              )}
            />
            {error("appliedAt")}
          </Field>
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field data-invalid={invalidMark("city")}>
          <FieldLabel htmlFor="city">{t.labels.city}</FieldLabel>
          <Controller
            control={form.control}
            name="city"
            render={({ field }) => (
              <CityField
                id="city"
                ref={field.ref}
                value={typeof field.value === "string" ? field.value : ""}
                search={citySearch}
                onChange={field.onChange}
                onPick={(city, country) => {
                  field.onChange(city);
                  form.setValue("country", country, {
                    shouldDirty: true,
                    shouldValidate: form.formState.isSubmitted,
                  });
                }}
                onBlur={field.onBlur}
                {...describedBy("city", "city-hint")}
              />
            )}
          />
          <FieldDescription id="city-hint">{t.city.hint}</FieldDescription>
          {error("city")}
        </Field>

        <Field data-invalid={invalidMark("country")}>
          <FieldLabel htmlFor="country">{t.labels.country}</FieldLabel>
          <Input
            id="country"
            autoComplete="country-name"
            {...describedBy("country")}
            {...form.register("country")}
          />
          {error("country")}
        </Field>

        <Field data-invalid={invalidMark("workMode")}>
          <FieldLabel htmlFor="workMode">{t.labels.workMode}</FieldLabel>
          <NativeSelect
            id="workMode"
            className="w-full"
            {...describedBy("workMode")}
            {...form.register("workMode", { setValueAs: blankAsNull })}
          >
            <NativeSelectOption value="">{t.workModeUnset}</NativeSelectOption>
            {workModes.map((workMode) => (
              <NativeSelectOption key={workMode} value={workMode}>
                {messages.applications.workMode[workMode]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("workMode")}
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field data-invalid={invalidMark("channel")}>
          <FieldLabel htmlFor="channel">{t.labels.channel}</FieldLabel>
          <NativeSelect
            id="channel"
            className="w-full"
            {...describedBy("channel")}
            {...form.register("channel")}
          >
            {channels.map((channel) => (
              <NativeSelectOption key={channel} value={channel}>
                {messages.applications.channel[channel]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {error("channel")}
        </Field>

        <Field data-invalid={invalidMark("source")}>
          <FieldLabel htmlFor="source">{t.labels.source}</FieldLabel>
          <Controller
            control={form.control}
            name="source"
            render={({ field }) => (
              <SourceField
                id="source"
                ref={field.ref}
                value={typeof field.value === "string" ? field.value : ""}
                search={sourceSearch}
                onChange={field.onChange}
                onBlur={field.onBlur}
                {...describedBy("source", "source-hint")}
              />
            )}
          />
          <FieldDescription id="source-hint">{t.source.hint}</FieldDescription>
          {error("source")}
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field data-invalid={invalidMark("sourceUrl")}>
          <FieldLabel htmlFor="sourceUrl">{t.labels.sourceUrl}</FieldLabel>
          <Input
            id="sourceUrl"
            type="url"
            inputMode="url"
            className={mono}
            {...describedBy("sourceUrl")}
            {...form.register("sourceUrl")}
          />
          {error("sourceUrl")}
        </Field>

        <Field data-invalid={invalidMark("applicationUrl")}>
          <FieldLabel htmlFor="applicationUrl">{t.labels.applicationUrl}</FieldLabel>
          <Input
            id="applicationUrl"
            type="url"
            inputMode="url"
            className={mono}
            {...describedBy("applicationUrl")}
            {...form.register("applicationUrl")}
          />
          {error("applicationUrl")}
        </Field>
      </div>

      <Field data-invalid={invalidMark("notes")}>
        <FieldLabel htmlFor="notes">{t.labels.notes}</FieldLabel>
        <Textarea id="notes" rows={4} {...describedBy("notes")} {...form.register("notes")} />
        {error("notes")}
      </Field>

      <SalaryFields
        register={form.register}
        pasteRejected={salaryPasteRejected}
        onLeaveEmpty={leaveEmpty}
        summary={salarySummary}
        errors={errors.salary}
        open={salaryShown}
        onOpenChange={setSalaryOpen}
      />

      <ContactFields
        register={form.register}
        pasteRejected={contactPasteRejected}
        onLeaveEmpty={leaveEmpty}
        summary={contactSummary}
        errors={errors.contact}
        open={contactShown}
        onOpenChange={setContactOpen}
      />

      {pasteBlocked && pasteRejected.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="text-foreground">{t.paste.unresolved}</p>
          </AlertDescription>
        </Alert>
      )}

      {failure && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="text-foreground">{failure}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <Button
          type="submit"
          size="lg"
          disabled={pending || unchanged || !hydrated}
          className={cn(actionButton, !hydrated && awaitingHydrationClass)}
        >
          {pending ? t.saving : editing ? t.saveChanges : t.submit}
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className={cn(actionButton, "border-input bg-transparent dark:bg-transparent")}
        >
          <Link href={backHref}>{messages.applications.back}</Link>
        </Button>
      </div>
    </form>
  );
}
