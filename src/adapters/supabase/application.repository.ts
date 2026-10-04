import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application, ApplicationStatus, StatusEvent } from "@/domain/application/model";
import type { ApplicationRepository } from "@/domain/application/repository";
import type { CreateApplication, UpdateApplication } from "@/domain/application/schema";
import {
  statusEventToDomain,
  toDomain,
  toRow,
  toStatusTransitionRow,
  toUpdateRow,
} from "./application.mapper";
import { createSupabaseServerClient } from "./client";
import type { Database } from "./database.types";

function failure(operation: string, error: { message: string; code?: string }): Error {
  return new Error(`Supabase ${operation} failed: ${error.message}`, { cause: error });
}

/**
 * Queries run with the client's token, so RLS scopes them too; the explicit
 * user filter keeps results identical to implementations without RLS.
 */
export class SupabaseApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  listActive(userId: string): Promise<Application[]> {
    return this.list(userId, false);
  }

  listArchived(userId: string): Promise<Application[]> {
    return this.list(userId, true);
  }

  private async list(userId: string, archived: boolean): Promise<Application[]> {
    const query = this.client.from("application").select().eq("user_id", userId);
    const { data, error } = await (archived
      ? query.not("archived_at", "is", null)
      : query.is("archived_at", null)
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) {
      throw failure("application list", error);
    }
    return data.map(toDomain);
  }

  async find(userId: string, id: string): Promise<Application | null> {
    const { data, error } = await this.client
      .from("application")
      .select()
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw failure("application find", error);
    }
    return data && toDomain(data);
  }

  async create(userId: string, application: CreateApplication): Promise<Application> {
    const { data, error } = await this.client
      .from("application")
      .insert(toRow(userId, application))
      .select()
      .single();
    if (error) {
      throw failure("application insert", error);
    }
    return toDomain(data);
  }

  async update(userId: string, id: string, patch: UpdateApplication): Promise<Application | null> {
    const { data, error } = await this.client
      .from("application")
      .update(toUpdateRow(patch))
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      throw failure("application update", error);
    }
    return data && toDomain(data);
  }

  async recordStatusTransition(
    userId: string,
    from: ApplicationStatus,
    moved: Application,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from("application")
      .update(toStatusTransitionRow(moved))
      .eq("user_id", userId)
      .eq("id", moved.id)
      .eq("status", from)
      .select("id");
    if (error) {
      throw failure("application transition", error);
    }
    return data.length > 0;
  }

  async archive(userId: string, id: string, at: Date): Promise<void> {
    const { error } = await this.client
      .from("application")
      .update({ archived_at: at.toISOString() })
      .eq("user_id", userId)
      .eq("id", id)
      .is("archived_at", null);
    if (error) {
      throw failure("application archive", error);
    }
  }

  async unarchive(userId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("application")
      .update({ archived_at: null })
      .eq("user_id", userId)
      .eq("id", id);
    if (error) {
      throw failure("application unarchive", error);
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const { error } = await this.client
      .from("application")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (error) {
      throw failure("application delete", error);
    }
  }

  async statusHistory(userId: string, applicationId: string): Promise<StatusEvent[]> {
    const { data, error } = await this.client
      .from("status_event")
      .select()
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .order("occurred_at", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      throw failure("status history", error);
    }
    return data.map(statusEventToDomain);
  }

  distinctValues(): Promise<string[]> {
    return Promise.reject(new Error("ApplicationRepository.distinctValues is not implemented yet"));
  }
}

/** A repository acting as the user of the current request. */
export async function applicationRepositoryForRequest(): Promise<ApplicationRepository> {
  return new SupabaseApplicationRepository(await createSupabaseServerClient());
}
