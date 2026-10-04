import { randomUUID } from "node:crypto";
import type { Application, ApplicationStatus, StatusEvent } from "@/domain/application/model";
import type { ApplicationRepository } from "@/domain/application/repository";
import type { CreateApplication, UpdateApplication } from "@/domain/application/schema";

type Stored = { userId: string; application: Application };
type Journalled = { userId: string; applicationId: string; event: StatusEvent };

/** ApplicationRepository over an array, for tests that need no database. */
export class InMemoryApplicationRepository implements ApplicationRepository {
  // Oldest first: insertion order stands in for created_at.
  private readonly stored: Stored[] = [];
  // Stands in for the status_event trigger.
  private readonly journal: Journalled[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  listActive(userId: string): Promise<Application[]> {
    return this.list(userId, (application) => application.archivedAt === null);
  }

  listArchived(userId: string): Promise<Application[]> {
    return this.list(userId, (application) => application.archivedAt !== null);
  }

  find(userId: string, id: string): Promise<Application | null> {
    const entry = this.entry(userId, id);
    return Promise.resolve(entry ? structuredClone(entry.application) : null);
  }

  create(userId: string, input: CreateApplication): Promise<Application> {
    const application: Application = {
      ...structuredClone(input),
      id: randomUUID(),
      statusChangedAt: this.now(),
      lastContactAt: null,
      archivedAt: null,
    };
    this.stored.push({ userId, application });
    this.record(userId, application);
    return Promise.resolve(structuredClone(application));
  }

  update(userId: string, id: string, patch: UpdateApplication): Promise<Application | null> {
    const entry = this.entry(userId, id);
    if (!entry) {
      return Promise.resolve(null);
    }
    const defined = Object.entries(structuredClone(patch)).filter(
      ([, value]) => value !== undefined,
    );
    entry.application = { ...entry.application, ...Object.fromEntries(defined) };
    return Promise.resolve(structuredClone(entry.application));
  }

  recordStatusTransition(
    userId: string,
    from: ApplicationStatus,
    moved: Application,
  ): Promise<boolean> {
    const entry = this.entry(userId, moved.id);
    if (!entry || entry.application.status !== from) {
      return Promise.resolve(false);
    }
    const before = entry.application;
    entry.application = {
      ...before,
      status: moved.status,
      statusChangedAt: moved.statusChangedAt,
      appliedAt: moved.appliedAt,
      lastContactAt: moved.lastContactAt,
    };
    if (
      before.status !== moved.status ||
      before.statusChangedAt.getTime() !== moved.statusChangedAt.getTime()
    ) {
      this.record(userId, entry.application);
    }
    return Promise.resolve(true);
  }

  archive(userId: string, id: string, at: Date): Promise<void> {
    const entry = this.entry(userId, id);
    if (entry && entry.application.archivedAt === null) {
      entry.application = { ...entry.application, archivedAt: at };
    }
    return Promise.resolve();
  }

  unarchive(userId: string, id: string): Promise<void> {
    const entry = this.entry(userId, id);
    if (entry) {
      entry.application = { ...entry.application, archivedAt: null };
    }
    return Promise.resolve();
  }

  delete(userId: string, id: string): Promise<void> {
    const index = this.stored.findIndex(
      (entry) => entry.userId === userId && entry.application.id === id,
    );
    if (index !== -1) {
      this.stored.splice(index, 1);
      for (let i = this.journal.length - 1; i >= 0; i--) {
        if (this.journal[i]?.applicationId === id) {
          this.journal.splice(i, 1);
        }
      }
    }
    return Promise.resolve();
  }

  statusHistory(userId: string, applicationId: string): Promise<StatusEvent[]> {
    return Promise.resolve(
      this.journal
        .filter((entry) => entry.userId === userId && entry.applicationId === applicationId)
        .map((entry) => structuredClone(entry.event))
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()),
    );
  }

  distinctValues(): Promise<string[]> {
    return Promise.reject(new Error("ApplicationRepository.distinctValues is not implemented yet"));
  }

  /** Every stored application with its owner, for assertions on what was written. */
  all(): Stored[] {
    return structuredClone(this.stored);
  }

  private list(userId: string, keep: (application: Application) => boolean) {
    return Promise.resolve(
      this.stored
        .filter((entry) => entry.userId === userId && keep(entry.application))
        .map((entry) => structuredClone(entry.application))
        .reverse(),
    );
  }

  private entry(userId: string, id: string): Stored | undefined {
    return this.stored.find((entry) => entry.userId === userId && entry.application.id === id);
  }

  private record(userId: string, application: Application) {
    this.journal.push({
      userId,
      applicationId: application.id,
      event: { status: application.status, occurredAt: application.statusChangedAt },
    });
  }
}
