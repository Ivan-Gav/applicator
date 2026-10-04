import {
  type Application,
  applicationStatuses,
  type StatusEvent,
  channels,
  salaryPeriods,
  seniorities,
  workModes,
} from "@/domain/application/model";
import type { CreateApplication, UpdateApplication } from "@/domain/application/schema";
import type { Tables, TablesInsert, TablesUpdate } from "./database.types";

export type ApplicationRow = Tables<"application">;
export type ApplicationInsertRow = TablesInsert<"application">;
export type ApplicationUpdateRow = TablesUpdate<"application">;
export type StatusEventRow = Tables<"status_event">;

// The CHECK constraints keep these columns in range; a value outside it means
// the schema and the domain have drifted apart. `column` is table-qualified
// unless it is on application.
function oneOf<T extends string>(allowed: readonly T[], value: string, column: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    const qualified = column.includes(".") ? column : `application.${column}`;
    throw new Error(`${qualified} holds unknown value "${value}"`);
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
    statusChangedAt: new Date(row.status_changed_at),
    appliedAt: dateOrNull(row.applied_at),
    lastContactAt: dateOrNull(row.last_contact_at),
    salary: {
      advertised: { min: row.salary_advertised_min, max: row.salary_advertised_max },
      estimated: { min: row.salary_estimated_min, max: row.salary_estimated_max },
      asked: { min: row.salary_asked_min, max: row.salary_asked_max },
      currency: row.salary_currency,
      period: oneOf(salaryPeriods, row.salary_period, "salary_period"),
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

/** The columns of the fields `patch` carries; absent fields stay as stored. */
export function toUpdateRow(patch: UpdateApplication): ApplicationUpdateRow {
  const { salary, contact } = patch;
  const row: ApplicationUpdateRow = {
    company_name: patch.companyName,
    position_title: patch.positionTitle,
    seniority: patch.seniority,
    city: patch.city,
    country: patch.country,
    work_mode: patch.workMode,
    channel: patch.channel,
    source: patch.source,
    source_url: patch.sourceUrl,
    application_url: patch.applicationUrl,
    notes: patch.notes,
    ...(salary && {
      salary_advertised_min: salary.advertised.min,
      salary_advertised_max: salary.advertised.max,
      salary_estimated_min: salary.estimated.min,
      salary_estimated_max: salary.estimated.max,
      salary_asked_min: salary.asked.min,
      salary_asked_max: salary.asked.max,
      salary_currency: salary.currency,
      salary_period: salary.period,
    }),
    ...(contact && {
      contact_name: contact.name,
      contact_role: contact.role,
      contact_email: contact.email,
      contact_phone: contact.phone,
      contact_url: contact.url,
    }),
  };
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

/** The columns statusTransition() changes. */
export function toStatusTransitionRow(moved: Application): ApplicationUpdateRow {
  return {
    status: moved.status,
    status_changed_at: moved.statusChangedAt.toISOString(),
    applied_at: moved.appliedAt?.toISOString() ?? null,
    last_contact_at: moved.lastContactAt?.toISOString() ?? null,
  };
}

export function statusEventToDomain(row: StatusEventRow): StatusEvent {
  return {
    status: oneOf(applicationStatuses, row.status, "status_event.status"),
    occurredAt: new Date(row.occurred_at),
  };
}
