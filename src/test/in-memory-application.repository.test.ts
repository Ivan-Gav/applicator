import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationRepository } from "@/domain/application/repository";
import {
  type CreateApplication,
  type CreateApplicationInput,
  createApplicationSchema,
} from "@/domain/application/schema";
import { InMemoryApplicationRepository } from "./in-memory-application.repository";

const alice = "00000000-0000-4000-8000-00000000000a";
const bob = "00000000-0000-4000-8000-00000000000b";

function input(overrides: Partial<CreateApplicationInput> = {}): CreateApplication {
  return createApplicationSchema.parse({
    companyName: "Acme",
    positionTitle: "Engineer",
    ...overrides,
  });
}

let repository: ApplicationRepository;

beforeEach(() => {
  repository = new InMemoryApplicationRepository();
});

describe("InMemoryApplicationRepository", () => {
  it("returns the created application with an id and every field as given", async () => {
    const given = input({
      status: "interview",
      appliedAt: new Date("2026-08-31T22:00:00.000Z"),
      city: "Berlin",
    });

    const { id, lastContactAt, archivedAt, ...created } = await repository.create(alice, given);

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toEqual(given);
    expect(lastContactAt).toBeNull();
    expect(archivedAt).toBeNull();
  });

  it("lists a created application exactly as create returned it", async () => {
    const created = await repository.create(alice, input());

    await expect(repository.list(alice)).resolves.toEqual([created]);
  });

  it("lists the most recently created application first", async () => {
    const older = await repository.create(alice, input({ companyName: "Older" }));
    const newer = await repository.create(alice, input({ companyName: "Newer" }));

    const ids = (await repository.list(alice)).map(({ id }) => id);

    expect(ids).toEqual([newer.id, older.id]);
  });

  it("lists only the user's own applications", async () => {
    const alices = await repository.create(alice, input());
    const bobs = await repository.create(bob, input());

    await expect(repository.list(alice)).resolves.toEqual([alices]);
    await expect(repository.list(bob)).resolves.toEqual([bobs]);
  });

  it("lists nothing for a user who has created nothing", async () => {
    await expect(repository.list(alice)).resolves.toEqual([]);
  });

  it("refuses distinctValues loudly until it is implemented", async () => {
    await expect(repository.distinctValues(alice, "companyName")).rejects.toThrow(
      "not implemented",
    );
  });
});
