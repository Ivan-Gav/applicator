import type { Application } from "./model";
import type { CreateApplication } from "./schema";

export interface ApplicationRepository {
  /** Every application the user owns, most recently created first. */
  list(userId: string): Promise<Application[]>;

  create(userId: string, application: CreateApplication): Promise<Application>;

  // Backs autocomplete: company and source are free text, not lookup tables.
  distinctValues(userId: string, field: "companyName" | "source"): Promise<string[]>;
}
