import type { Application, ApplicationStatus, StatusEvent } from "./model";
import type { CreateApplication, UpdateApplication } from "./schema";

/**
 * Every method acts only on the given user's applications; another user's
 * application behaves as if it did not exist.
 */
export interface ApplicationRepository {
  /** Applications not archived, most recently created first. */
  listActive(userId: string): Promise<Application[]>;

  /** Archived applications, most recently created first. */
  listArchived(userId: string): Promise<Application[]>;

  find(userId: string, id: string): Promise<Application | null>;

  create(userId: string, application: CreateApplication): Promise<Application>;

  /** `null` when there is no such application. */
  update(userId: string, id: string, patch: UpdateApplication): Promise<Application | null>;

  /**
   * Stores the status, `statusChangedAt`, `appliedAt` and `lastContactAt` of
   * `moved`, a result of statusTransition(), only while the stored status is still
   * `from`. Returns whether it was stored.
   */
  recordStatusTransition(
    userId: string,
    from: ApplicationStatus,
    moved: Application,
  ): Promise<boolean>;

  archive(userId: string, id: string, at: Date): Promise<void>;

  unarchive(userId: string, id: string): Promise<void>;

  delete(userId: string, id: string): Promise<void>;

  /** Every status the application has held, oldest first. */
  statusHistory(userId: string, applicationId: string): Promise<StatusEvent[]>;

  // Backs autocomplete: company and source are free text, not lookup tables.
  distinctValues(userId: string, field: "companyName" | "source"): Promise<string[]>;
}
