import {
  type Application,
  type ApplicationStatus,
  applicationStatuses,
  type SalaryRange,
  SalaryRangeKind,
  type SalaryRangeShape,
} from "./model";

// Where an application usually goes next. A suggestion only: any status may
// follow any other. `interview` repeats, one round each.
const likelyTransitions: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  draft: ["applied", "withdrawn"],
  applied: ["screening", "assignment", "interview", "rejected", "withdrawn"],
  screening: ["assignment", "interview", "rejected", "withdrawn"],
  assignment: ["interview", "offer", "rejected", "withdrawn"],
  interview: ["interview", "offer", "rejected", "withdrawn"],
  offer: ["rejected", "withdrawn"],
  rejected: [],
  withdrawn: [],
};

// The application is over, for now: nothing is awaited from either side.
const closedStatuses: readonly ApplicationStatus[] = ["rejected", "withdrawn"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isLikelyTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return likelyTransitions[from].includes(to);
}

/** The statuses {@link isLikelyTransition} expects after `from`, in process order. */
export function likelyNextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return applicationStatuses.filter((to) => isLikelyTransition(from, to));
}

/** Every status not likely after `from`, in process order; `from` itself is not a move. */
export function otherNextStatuses(from: ApplicationStatus): readonly ApplicationStatus[] {
  return applicationStatuses.filter((to) => to !== from && !isLikelyTransition(from, to));
}

export function isClosedStatus(status: ApplicationStatus): boolean {
  return closedStatuses.includes(status);
}

/**
 * Moves an application to `to`, whatever its status. `at` is when the new
 * status was entered. A status change also counts as a contact, so
 * `lastContactAt` becomes `at` as well. The first move to `applied` dates
 * the application; a later one, such as undoing a mis-click, keeps that date.
 */
export function statusTransition(
  application: Application,
  to: ApplicationStatus,
  at: Date,
): Application {
  return {
    ...application,
    status: to,
    statusChangedAt: at,
    appliedAt: to === "applied" && application.appliedAt === null ? at : application.appliedAt,
    lastContactAt: at,
  };
}

/** `null` for an application never sent and for a closed one. */
export function daysWithoutResponse(application: Application, now: Date): number | null {
  if (isClosedStatus(application.status)) {
    return null;
  }

  const since = application.lastContactAt ?? application.appliedAt;
  if (since === null) {
    return null;
  }

  const elapsedDays = Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY);
  return Math.max(0, elapsedDays);
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
