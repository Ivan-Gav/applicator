import {
  type Application,
  applicationStatuses,
  channels,
  salaryPeriods,
  seniorities,
  workModes,
} from "@/domain/application/model";
import type { CreateApplication } from "@/domain/application/schema";
import type { Tables, TablesInsert } from "./database.types";

export type ApplicationRow = Tables<"application">;
export type ApplicationInsertRow = TablesInsert<"application">;

// The CHECK constraints keep these columns in range; a value outside it means
// the schema and the domain have drifted apart.
function oneOf<T extends string>(allowed: readonly T[], value: string, column: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`application.${column} holds unknown value "${value}"`);
  }
  return value as T;
}

function oneOfOrNull<T extends string>(
  allowed: readonly T[],
  value: string | null,
  column: string,
): T | null {
  return value === null ? null : oneOf(allowed, value, column);
}

function dateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

export function toDomain(row: ApplicationRow): Application {
  return {
    id: row.id,
    companyName: row.company_name,
    positionTitle: row.position_title,
    seniority: oneOfOrNull(seniorities, row.seniority, "seniority"),
    city: row.city,
    country: row.country,
    workMode: oneOfOrNull(workModes, row.work_mode, "work_mode"),
    channel: oneOf(channels, row.channel, "channel"),
    source: row.source,
    sourceUrl: row.source_url,
    applicationUrl: row.application_url,
    status: oneOf(applicationStatuses, row.status, "status"),
    appliedAt: dateOrNull(row.applied_at),
    lastContactAt: dateOrNull(row.last_contact_at),
    salary: {
      advertised: { min: row.salary_advertised_min, max: row.salary_advertised_max },
      estimated: { min: row.salary_estimated_min, max: row.salary_estimated_max },
      asked: { min: row.salary_asked_min, max: row.salary_asked_max },
      currency: row.salary_currency,
      period: oneOfOrNull(salaryPeriods, row.salary_period, "salary_period"),
    },
    contact: {
      name: row.contact_name,
      role: row.contact_role,
      email: row.contact_email,
      phone: row.contact_phone,
      url: row.contact_url,
    },
    notes: row.notes,
    archivedAt: dateOrNull(row.archived_at),
  };
}

export function toRow(userId: string, application: CreateApplication): ApplicationInsertRow {
  return {
    user_id: userId,
    company_name: application.companyName,
    position_title: application.positionTitle,
    status: application.status,
    applied_at: application.appliedAt?.toISOString() ?? null,
    seniority: application.seniority,
    city: application.city,
    country: application.country,
    work_mode: application.workMode,
    channel: application.channel,
    source: application.source,
    source_url: application.sourceUrl,
    application_url: application.applicationUrl,
    salary_advertised_min: application.salary.advertised.min,
    salary_advertised_max: application.salary.advertised.max,
    salary_estimated_min: application.salary.estimated.min,
    salary_estimated_max: application.salary.estimated.max,
    salary_asked_min: application.salary.asked.min,
    salary_asked_max: application.salary.asked.max,
    salary_currency: application.salary.currency,
    salary_period: application.salary.period,
    contact_name: application.contact.name,
    contact_role: application.contact.role,
    contact_email: application.contact.email,
    contact_phone: application.contact.phone,
    contact_url: application.contact.url,
    notes: application.notes,
  };
}
