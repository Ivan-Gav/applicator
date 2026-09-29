import type { SupabaseClient } from "@supabase/supabase-js";
import type { Application } from "@/domain/application/model";
import type { ApplicationRepository } from "@/domain/application/repository";
import type { CreateApplication } from "@/domain/application/schema";
import { toDomain, toRow } from "./application.mapper";
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

  async list(userId: string): Promise<Application[]> {
    const { data, error } = await this.client
      .from("application")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) {
      throw failure("application list", error);
    }
    return data.map(toDomain);
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

  distinctValues(): Promise<string[]> {
    return Promise.reject(new Error("ApplicationRepository.distinctValues is not implemented yet"));
  }
}

/** A repository acting as the user of the current request. */
export async function applicationRepositoryForRequest(): Promise<ApplicationRepository> {
  return new SupabaseApplicationRepository(await createSupabaseServerClient());
}
