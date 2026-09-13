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

/**
 * Thrown by {@link transition} when the requested status change is not in the
 * allowed set. Carries both ends of the attempted move so callers can render a
 * precise message without parsing the error text.
 */
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
 * Whether an application in status `from` may move to status `to`.
 *
 * The status graph is one-directional: an application never returns to an
 * earlier stage. `rejected` and `withdrawn` have no way out. `interview` may
 * repeat, so that a second or third round is recorded as its own event.
 *
 * Pure check for UI purposes (enabling buttons); {@link transition} enforces
 * the same rule when the change is actually applied.
 */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return allowedTransitions[from].includes(to);
}

/**
 * Returns a copy of `application` moved to status `to` at time `at`.
 *
 * Besides the status itself the move updates two timestamps: `lastContactAt`
 * is always set to `at`, since a status change is by definition a contact, and
 * `appliedAt` is stamped on the move to `applied` and kept unchanged after that.
 *
 * The input is never mutated. `at` is passed in rather than read from the clock
 * so that an application sent last week can be recorded with its real date.
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

/**
 * Whole days since the last contact, counted at `now`, or `null` when the
 * question does not apply.
 *
 * The reference point is `lastContactAt`, falling back to `appliedAt`. The
 * result is `null` for an application that was never sent (a draft) and for
 * one with no allowed transitions left, where waiting for a response is over. Partial
 * days round down and a reference date in the future counts as zero, so the
 * value is safe to display without further checks.
 */
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
