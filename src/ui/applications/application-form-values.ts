import type { ApplicationJsonReading } from "@/domain/application/json";
import {
  type Application,
  type Contact,
  defaultSalaryPeriod,
  type SalaryRange,
} from "@/domain/application/model";
import type { CreateApplicationInput } from "@/domain/application/schema";
import { startOfLocalDay } from "@/lib/date";

const unknownRange: SalaryRange = { min: null, max: null };

// Text inputs hold "" for an unknown value; the schema turns it back into null.
const text = (value: string | null) => value ?? "";

function contactValues(contact: Contact | null): CreateApplicationInput["contact"] {
  return {
    name: text(contact?.name ?? null),
    role: text(contact?.role ?? null),
    email: text(contact?.email ?? null),
    phone: text(contact?.phone ?? null),
    url: text(contact?.url ?? null),
  };
}

/** What the form starts with: blank for a new application, else its stored values. */
export function applicationFormValues(application?: Application): CreateApplicationInput {
  if (!application) {
    return {
      companyName: "",
      positionTitle: "",
      seniority: null,
      status: "draft",
      appliedAt: null,
      city: "",
      country: "",
      workMode: null,
      channel: "direct",
      source: "",
      sourceUrl: "",
      applicationUrl: "",
      notes: "",
      salary: {
        advertised: unknownRange,
        estimated: unknownRange,
        asked: unknownRange,
        currency: "EUR",
        period: defaultSalaryPeriod,
      },
      contact: contactValues(null),
    };
  }
  return {
    companyName: application.companyName,
    positionTitle: application.positionTitle,
    seniority: application.seniority,
    status: application.status,
    appliedAt: application.appliedAt,
    city: text(application.city),
    country: text(application.country),
    workMode: application.workMode,
    channel: application.channel,
    source: text(application.source),
    sourceUrl: text(application.sourceUrl),
    applicationUrl: text(application.applicationUrl),
    notes: text(application.notes),
    salary: {
      advertised: application.salary.advertised,
      estimated: application.salary.estimated,
      asked: application.salary.asked,
      currency: text(application.salary.currency),
      period: application.salary.period,
    },
    contact: contactValues(application.contact),
  };
}

/** Whether any part of the contact is known, so its section starts open. */
export function hasContact(contact: Contact): boolean {
  return Object.values(contact).some((value) => value !== null);
}

/** Whether any salary detail beyond the default currency and period is known. */
export function hasSalary({
  advertised,
  estimated,
  asked,
  period,
}: Application["salary"]): boolean {
  return (
    [advertised, estimated, asked].some(({ min, max }) => min !== null || max !== null) ||
    period !== defaultSalaryPeriod
  );
}

/**
 * A new form filled in from a JSON reading: each accepted value in its field,
 * everything else as a new form starts. A rejected currency leaves the field
 * empty rather than at the default. A day applied starts in this runtime's
 * time zone, as one picked in the form does.
 */
export function formValuesFromJson({
  values,
  rejected,
}: ApplicationJsonReading): CreateApplicationInput {
  const blank = applicationFormValues();
  const { appliedAt, salary, contact, ...plain } = values;
  const filledSalary = { ...blank.salary, ...salary };
  if (rejected.some(({ field }) => field === "salary.currency")) {
    filledSalary.currency = "";
  }
  return {
    ...blank,
    ...plain,
    appliedAt: appliedAt === undefined ? null : startOfLocalDay(appliedAt),
    salary: filledSalary,
    contact: { ...blank.contact, ...contact },
  };
}
