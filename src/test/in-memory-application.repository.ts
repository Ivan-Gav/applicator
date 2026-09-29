import { randomUUID } from "node:crypto";
import type { Application } from "@/domain/application/model";
import type { ApplicationRepository } from "@/domain/application/repository";
import type { CreateApplication } from "@/domain/application/schema";

type Stored = { userId: string; application: Application };

/** ApplicationRepository over an array, for tests that need no database. */
export class InMemoryApplicationRepository implements ApplicationRepository {
  // Oldest first: insertion order stands in for created_at.
  private readonly stored: Stored[] = [];

  list(userId: string): Promise<Application[]> {
    return Promise.resolve(
      this.stored
        .filter((entry) => entry.userId === userId)
        .map((entry) => structuredClone(entry.application))
        .reverse(),
    );
  }

  create(userId: string, input: CreateApplication): Promise<Application> {
    const application: Application = {
      ...structuredClone(input),
      id: randomUUID(),
      lastContactAt: null,
      archivedAt: null,
    };
    this.stored.push({ userId, application });
    return Promise.resolve(structuredClone(application));
  }

  distinctValues(): Promise<string[]> {
    return Promise.reject(new Error("ApplicationRepository.distinctValues is not implemented yet"));
  }

  /** Every stored application with its owner, for assertions on what was written. */
  all(): Stored[] {
    return structuredClone(this.stored);
  }
}
