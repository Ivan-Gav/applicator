import type { Application, ApplicationStatus } from "./model";

const allowedTransitions: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  draft: ["applied", "withdrawn"],
  applied: ["screening", "rejected", "withdrawn"],
  screening: ["interview", "rejected", "withdrawn"],
  interview: ["interview", "offer", "rejected", "withdrawn"],
  offer: ["rejected", "withdrawn"],
  rejected: [],
  withdrawn: [],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Thrown by {@link transition}; carries both ends of the attempted move. */
export class IllegalTransitionError extends Error {
  override readonly name = "IllegalTransitionError";

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
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedTransitions[from].includes(to);
}

/**
 * A status change counts as a contact, so `lastContactAt` is always `at`.
 *
 * @throws {IllegalTransitionError} when {@link canTransition} would return false.
 */
export function transition(application: Application, to: ApplicationStatus, at: Date): Application {
  if (!canTransition(application.status, to)) {
    throw new IllegalTransitionError(application.status, to);
  }

  return {
    ...application,
    status: to,
    appliedAt: to === "applied" ? at : application.appliedAt,
    lastContactAt: at,
  };
}

/** `null` for a draft and for an application in a final status. */
export function daysWithoutResponse(application: Application, now: Date): number | null {
  if (!hasAllowedTransitions(application.status)) {
    return null;
  }

  const since = application.lastContactAt ?? application.appliedAt;
  if (since === null) {
    return null;
  }

  const elapsedDays = Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY);
  return Math.max(0, elapsedDays);
}

function hasAllowedTransitions(status: ApplicationStatus): boolean {
  return allowedTransitions[status].length > 0;
}
