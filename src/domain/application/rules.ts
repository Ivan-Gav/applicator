import {
  type Application,
  type ApplicationStatus,
  applicationStatuses,
  type SalaryRange,
  SalaryRangeKind,
  type SalaryRangeShape,
} from "./model";

const allowedStatusTransitions: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> =
  {
    draft: ["applied", "withdrawn"],
    applied: ["screening", "rejected", "withdrawn"],
    screening: ["interview", "rejected", "withdrawn"],
    interview: ["interview", "offer", "rejected", "withdrawn"],
    offer: ["rejected", "withdrawn"],
    rejected: [],
    withdrawn: [],
  };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Thrown by {@link statusTransition}; carries both ends of the attempted move. */
export class IllegalStatusTransitionError extends Error {
  override readonly name = "IllegalStatusTransitionError";

  constructor(
    readonly from: ApplicationStatus,
    readonly to: ApplicationStatus,
  ) {
    super(`Cannot transition application from "${from}" to "${to}"`);
  }
}

/**
 * The status graph never returns to an earlier stage. `interview` may repeat,
 * so each round is its own event.
 */
export function isStatusTransitionAllowed(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedStatusTransitions[from].includes(to);
}

/** The statuses {@link isStatusTransitionAllowed} allows from `from`, in process order. */
export function nextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return applicationStatuses.filter((to) => isStatusTransitionAllowed(from, to));
}

/**
 * `at` is when the new status was entered. A status change also counts as a
 * contact, so `lastContactAt` becomes `at` as well.
 *
 * @throws {IllegalStatusTransitionError} when {@link isStatusTransitionAllowed} would return false.
 */
export function statusTransition(
  application: Application,
  to: ApplicationStatus,
  at: Date,
): Application {
  if (!isStatusTransitionAllowed(application.status, to)) {
    throw new IllegalStatusTransitionError(application.status, to);
  }

  return {
    ...application,
    status: to,
    statusChangedAt: at,
    appliedAt: to === "applied" ? at : application.appliedAt,
    lastContactAt: at,
  };
}

/** `null` for a draft and for an application in a final status. */
export function daysWithoutResponse(application: Application, now: Date): number | null {
  if (!hasAllowedStatusTransitions(application.status)) {
    return null;
  }

  const since = application.lastContactAt ?? application.appliedAt;
  if (since === null) {
    return null;
  }

  const elapsedDays = Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY);
  return Math.max(0, elapsedDays);
}

function hasAllowedStatusTransitions(status: ApplicationStatus): boolean {
  return allowedStatusTransitions[status].length > 0;
}

export function salaryRangeShape({ min, max }: SalaryRange): SalaryRangeShape {
  if (min === null) {
    return max === null ? { kind: SalaryRangeKind.Unknown } : { kind: SalaryRangeKind.UpTo, max };
  }
  if (max === null) {
    return { kind: SalaryRangeKind.From, min };
  }
  return min === max
    ? { kind: SalaryRangeKind.Exact, amount: min }
    : { kind: SalaryRangeKind.Between, min, max };
}
