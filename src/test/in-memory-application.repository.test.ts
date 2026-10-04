import { beforeEach, describe, expect, it } from "vitest";
import type { ApplicationRepository } from "@/domain/application/repository";
import { statusTransition } from "@/domain/application/rules";
import {
  type CreateApplication,
  type CreateApplicationInput,
  createApplicationSchema,
} from "@/domain/application/schema";
import { InMemoryApplicationRepository } from "./in-memory-application.repository";

const alice = "00000000-0000-4000-8000-00000000000a";
const bob = "00000000-0000-4000-8000-00000000000b";
const createdAt = new Date("2026-09-01T10:00:00.000Z");
const friday = new Date("2026-09-04T22:00:00.000Z");
const monday = new Date("2026-09-07T22:00:00.000Z");

function input(overrides: Partial<CreateApplicationInput> = {}): CreateApplication {
  return createApplicationSchema.parse({
    companyName: "Acme",
    positionTitle: "Engineer",
    ...overrides,
  });
}

let repository: InMemoryApplicationRepository;

beforeEach(() => {
  repository = new InMemoryApplicationRepository(() => createdAt);
});

describe("InMemoryApplicationRepository", () => {
  it("returns the created application with an id and every field as given", async () => {
    const given = input({
      status: "interview",
      appliedAt: new Date("2026-08-31T22:00:00.000Z"),
      city: "Berlin",
    });

    const { id, statusChangedAt, lastContactAt, archivedAt, ...created } = await repository.create(
      alice,
      given,
    );

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created).toEqual(given);
    expect(statusChangedAt).toEqual(createdAt);
    expect(lastContactAt).toBeNull();
    expect(archivedAt).toBeNull();
  });

  it("lists a created application exactly as create returned it", async () => {
    const created = await repository.create(alice, input());

    await expect(repository.listActive(alice)).resolves.toEqual([created]);
  });

  it("lists the most recently created application first", async () => {
    const older = await repository.create(alice, input({ companyName: "Older" }));
    const newer = await repository.create(alice, input({ companyName: "Newer" }));

    const ids = (await repository.listActive(alice)).map(({ id }) => id);

    expect(ids).toEqual([newer.id, older.id]);
  });

  it("lists only the user's own applications", async () => {
    const alices = await repository.create(alice, input());
    const bobs = await repository.create(bob, input());

    await expect(repository.listActive(alice)).resolves.toEqual([alices]);
    await expect(repository.listActive(bob)).resolves.toEqual([bobs]);
  });

  it("lists nothing for a user who has created nothing", async () => {
    await expect(repository.listActive(alice)).resolves.toEqual([]);
    await expect(repository.listArchived(alice)).resolves.toEqual([]);
  });

  it("finds an application by id, and nothing of another user's", async () => {
    const created = await repository.create(alice, input());

    await expect(repository.find(alice, created.id)).resolves.toEqual(created);
    await expect(repository.find(bob, created.id)).resolves.toBeNull();
    await expect(
      repository.find(alice, "00000000-0000-4000-8000-0000000000ff"),
    ).resolves.toBeNull();
  });

  it("refuses distinctValues loudly until it is implemented", async () => {
    const contract: ApplicationRepository = repository;

    await expect(contract.distinctValues(alice, "companyName")).rejects.toThrow("not implemented");
  });
});

describe("update", () => {
  it("changes only the fields the patch carries", async () => {
    const created = await repository.create(alice, input({ city: "Berlin", notes: "First" }));

    const updated = await repository.update(alice, created.id, { notes: "Second" });

    expect(updated).toEqual({ ...created, notes: "Second" });
    await expect(repository.find(alice, created.id)).resolves.toEqual(updated);
  });

  it("does not touch another user's application", async () => {
    const created = await repository.create(alice, input({ notes: "Mine" }));

    await expect(repository.update(bob, created.id, { notes: "Yours" })).resolves.toBeNull();
    expect((await repository.find(alice, created.id))?.notes).toBe("Mine");
  });
});

describe("recordStatusTransition", () => {
  it("stores the moved status and dates, and journals the move at its instant", async () => {
    const created = await repository.create(alice, input({ status: "applied" }));
    const moved = statusTransition(created, "screening", friday);

    await expect(repository.recordStatusTransition(alice, "applied", moved)).resolves.toBe(true);

    await expect(repository.find(alice, created.id)).resolves.toEqual(moved);
    await expect(repository.statusHistory(alice, created.id)).resolves.toEqual([
      { status: "applied", occurredAt: createdAt },
      { status: "screening", occurredAt: friday },
    ]);
  });

  it("stores only the transition's fields, whatever else the moved copy holds", async () => {
    const created = await repository.create(alice, input({ status: "applied", notes: "Kept" }));
    const moved = { ...statusTransition(created, "screening", friday), notes: "Smuggled" };

    await repository.recordStatusTransition(alice, "applied", moved);

    expect((await repository.find(alice, created.id))?.notes).toBe("Kept");
  });

  it("stores nothing once the stored status is no longer the one moved from", async () => {
    const created = await repository.create(alice, input({ status: "applied" }));
    await repository.recordStatusTransition(
      alice,
      "applied",
      statusTransition(created, "rejected", friday),
    );

    const late = statusTransition(created, "screening", monday);

    await expect(repository.recordStatusTransition(alice, "applied", late)).resolves.toBe(false);
    expect((await repository.find(alice, created.id))?.status).toBe("rejected");
  });

  it("journals a repeated interview at a new instant as its own round", async () => {
    const created = await repository.create(alice, input({ status: "interview" }));
    const first = statusTransition(created, "interview", friday);
    await repository.recordStatusTransition(alice, "interview", first);
    await repository.recordStatusTransition(
      alice,
      "interview",
      statusTransition(first, "interview", monday),
    );

    const rounds = (await repository.statusHistory(alice, created.id)).map(
      ({ occurredAt }) => occurredAt,
    );
    expect(rounds).toEqual([createdAt, friday, monday]);
  });

  it("does not move another user's application", async () => {
    const created = await repository.create(alice, input({ status: "applied" }));

    await expect(
      repository.recordStatusTransition(
        bob,
        "applied",
        statusTransition(created, "screening", friday),
      ),
    ).resolves.toBe(false);
    expect((await repository.find(alice, created.id))?.status).toBe("applied");
  });
});

describe("archive and unarchive", () => {
  it("moves an application between the active and the archived list", async () => {
    const created = await repository.create(alice, input());

    await repository.archive(alice, created.id, friday);

    await expect(repository.listActive(alice)).resolves.toEqual([]);
    await expect(repository.listArchived(alice)).resolves.toEqual([
      { ...created, archivedAt: friday },
    ]);

    await repository.unarchive(alice, created.id);

    await expect(repository.listActive(alice)).resolves.toEqual([created]);
    await expect(repository.listArchived(alice)).resolves.toEqual([]);
  });

  it("keeps the first archiving time when archived again", async () => {
    const created = await repository.create(alice, input());

    await repository.archive(alice, created.id, friday);
    await repository.archive(alice, created.id, monday);

    expect((await repository.find(alice, created.id))?.archivedAt).toEqual(friday);
  });

  it("leaves the status alone", async () => {
    const created = await repository.create(alice, input({ status: "rejected" }));

    await repository.archive(alice, created.id, friday);

    expect((await repository.find(alice, created.id))?.status).toBe("rejected");
    await expect(repository.statusHistory(alice, created.id)).resolves.toHaveLength(1);
  });

  it("does not archive another user's application", async () => {
    const created = await repository.create(alice, input());

    await repository.archive(bob, created.id, friday);

    await expect(repository.listActive(alice)).resolves.toEqual([created]);
  });
});

describe("delete", () => {
  it("removes the application and its history", async () => {
    const created = await repository.create(alice, input());

    await repository.delete(alice, created.id);

    await expect(repository.find(alice, created.id)).resolves.toBeNull();
    await expect(repository.statusHistory(alice, created.id)).resolves.toEqual([]);
  });

  it("does not delete another user's application", async () => {
    const created = await repository.create(alice, input());

    await repository.delete(bob, created.id);

    await expect(repository.find(alice, created.id)).resolves.toEqual(created);
  });
});

describe("statusHistory", () => {
  it("lists the moves oldest first, by when they happened rather than when recorded", async () => {
    const created = await repository.create(alice, input({ status: "applied" }));
    const screening = statusTransition(created, "screening", monday);
    await repository.recordStatusTransition(alice, "applied", screening);
    // A day picked earlier than the previous move still sorts by its own instant.
    await repository.recordStatusTransition(
      alice,
      "screening",
      statusTransition(screening, "rejected", friday),
    );

    const statuses = (await repository.statusHistory(alice, created.id)).map(
      ({ status }) => status,
    );
    expect(statuses).toEqual(["applied", "rejected", "screening"]);
  });

  it("shows another user nothing", async () => {
    const created = await repository.create(alice, input());

    await expect(repository.statusHistory(bob, created.id)).resolves.toEqual([]);
  });
});
