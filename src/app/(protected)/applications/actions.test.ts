import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes, signInPath } from "@/app/routes";
import { type Application, StatusChangeFailure } from "@/domain/application/model";
import { statusTransition } from "@/domain/application/rules";
import { createApplicationSchema } from "@/domain/application/schema";
import { InMemoryApplicationRepository } from "@/test/in-memory-application.repository";
import {
  archiveApplication,
  changeApplicationStatus,
  createApplication,
  deleteApplication,
  unarchiveApplication,
  updateApplication,
} from "./actions";

vi.mock("@/adapters/supabase/application.repository", () => ({
  applicationRepositoryForRequest: vi.fn(),
}));
vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

// redirect() and notFound() end the action by throwing; the mocks do the same
// so that nothing after them can run unnoticed.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}
class NotFound extends Error {}

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};
const intruder = "00000000-0000-4000-8000-00000000000b";
const missingId = "00000000-0000-4000-8000-0000000000ff";
const createdAt = new Date("2026-09-01T10:00:00.000Z");
const friday = new Date("2026-09-04T22:00:00.000Z");

const valid = { companyName: "Acme", positionTitle: "Engineer", status: "applied" };

let repository: InMemoryApplicationRepository;

beforeEach(() => {
  repository = new InMemoryApplicationRepository(() => createdAt);
  vi.mocked(applicationRepositoryForRequest).mockResolvedValue(repository);
  vi.mocked(requireUser).mockResolvedValue(sessionUser);
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new Redirected(to);
  });
  vi.mocked(notFound).mockImplementation(() => {
    throw new NotFound();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

function seed(overrides: Record<string, unknown> = {}, owner = sessionUser.id) {
  return repository.create(owner, createApplicationSchema.parse({ ...valid, ...overrides }));
}

function stored(id: string) {
  return repository.find(sessionUser.id, id);
}

function signedOut() {
  vi.mocked(requireUser).mockImplementation(() => {
    throw new Redirected(signInPath());
  });
}

describe("createApplication", () => {
  it("stores a valid application for the signed-in user and returns to the list", async () => {
    await expect(createApplication(valid)).rejects.toEqual(new Redirected(routes.applications));

    const entries = repository.all();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.userId).toBe(sessionUser.id);
    expect(entries[0]?.application).toMatchObject(valid);
    expect(revalidatePath).toHaveBeenCalledWith(routes.applications);
  });

  it("returns the invalid fields and stores nothing", async () => {
    await expect(
      createApplication({ companyName: " ", positionTitle: "Engineer", applicationUrl: "nope" }),
    ).resolves.toEqual({ invalidFields: ["companyName", "applicationUrl"] });

    expect(repository.all()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("takes the owner from the session, never from the submitted data", async () => {
    await expect(
      createApplication({ ...valid, userId: intruder, user_id: intruder }),
    ).rejects.toBeInstanceOf(Redirected);

    const [entry] = repository.all();
    expect(entry?.userId).toBe(sessionUser.id);
    expect(entry?.application).not.toHaveProperty("userId");
    expect(entry?.application).not.toHaveProperty("user_id");
    await expect(repository.listActive(intruder)).resolves.toEqual([]);
  });

  it("stores nothing without a session", async () => {
    signedOut();

    await expect(createApplication(valid)).rejects.toEqual(new Redirected(signInPath()));

    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
    expect(repository.all()).toEqual([]);
  });
});

describe("updateApplication", () => {
  it("stores the changed fields and refreshes the list and the page", async () => {
    const created = await seed({ city: "Berlin" });

    await expect(
      updateApplication(created.id, { ...valid, positionTitle: "Lead Engineer", city: "" }),
    ).resolves.toEqual({ invalidFields: [] });

    expect(await stored(created.id)).toEqual({
      ...created,
      positionTitle: "Lead Engineer",
      city: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith(routes.applications, "layout");
  });

  it("returns the invalid fields and changes nothing", async () => {
    const created = await seed();

    await expect(
      updateApplication(created.id, { companyName: "", sourceUrl: "nope" }),
    ).resolves.toEqual({ invalidFields: ["companyName", "sourceUrl"] });

    expect(await stored(created.id)).toEqual(created);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores status and dates in the input: they change only through transitions", async () => {
    const created = await seed({ status: "applied" });

    await updateApplication(created.id, {
      ...valid,
      status: "offer",
      appliedAt: friday,
      lastContactAt: friday,
      archivedAt: friday,
    });

    expect(await stored(created.id)).toEqual(created);
  });

  it.each([
    ["an unknown id", missingId],
    ["an id that is not one", "not-a-uuid"],
  ])("responds with not-found for %s", async (_, id) => {
    await expect(updateApplication(id, valid)).rejects.toBeInstanceOf(NotFound);
  });

  it("does not touch another user's application", async () => {
    const theirs = await seed({ notes: "Theirs" }, intruder);

    await expect(updateApplication(theirs.id, { notes: "Mine" })).rejects.toBeInstanceOf(NotFound);

    expect((await repository.find(intruder, theirs.id))?.notes).toBe("Theirs");
  });

  it("changes nothing without a session", async () => {
    const created = await seed();
    signedOut();

    await expect(updateApplication(created.id, { notes: "x" })).rejects.toBeInstanceOf(Redirected);

    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
  });
});

describe("changeApplicationStatus", () => {
  // The server's clock dates every change.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: friday });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves a legal step, dated now, and records it as contact", async () => {
    const created = await seed({ status: "applied" });

    await expect(changeApplicationStatus(created.id, { status: "screening" })).resolves.toBeNull();

    expect(await stored(created.id)).toEqual(statusTransition(created, "screening", friday));
    expect((await stored(created.id))?.lastContactAt).toEqual(friday);
    expect(await repository.statusHistory(sessionUser.id, created.id)).toEqual([
      { status: "applied", occurredAt: created.statusChangedAt },
      { status: "screening", occurredAt: friday },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith(routes.applications, "layout");
  });

  it("dates the change itself, whatever date the caller sends", async () => {
    const created = await seed({ status: "applied" });

    await changeApplicationStatus(created.id, {
      status: "screening",
      at: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect((await stored(created.id))?.statusChangedAt).toEqual(friday);
    expect((await stored(created.id))?.lastContactAt).toEqual(friday);
  });

  // What a request that bypasses the UI can send: any status for any record.
  it.each([
    ["applied", "offer"],
    ["applied", "draft"],
    ["offer", "interview"],
    ["rejected", "applied"],
    ["withdrawn", "interview"],
  ] as const)("refuses %s -> %s and stores nothing", async (from, to) => {
    const created = await seed({ status: from });

    await expect(changeApplicationStatus(created.id, { status: to })).resolves.toBe(
      StatusChangeFailure.Illegal,
    );

    expect(await stored(created.id)).toEqual(created);
    expect(await repository.statusHistory(sessionUser.id, created.id)).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("judges the move against the stored status, not what the caller claims", async () => {
    const created = await seed({ status: "applied" });

    await expect(
      changeApplicationStatus(created.id, { status: "offer", from: "interview" }),
    ).resolves.toBe(StatusChangeFailure.Illegal);

    expect((await stored(created.id))?.status).toBe("applied");
  });

  it.each([
    ["an unknown status", { status: "ghosted" }],
    ["a missing status", {}],
    ["no input", undefined],
  ])("refuses %s as invalid", async (_, input) => {
    const created = await seed({ status: "applied" });

    await expect(changeApplicationStatus(created.id, input)).resolves.toBe(
      StatusChangeFailure.Invalid,
    );

    expect(await stored(created.id)).toEqual(created);
  });

  it("refuses an id that is not one as invalid", async () => {
    await expect(changeApplicationStatus("not-a-uuid", { status: "screening" })).resolves.toBe(
      StatusChangeFailure.Invalid,
    );
  });

  it("calls an unknown application outdated", async () => {
    await expect(changeApplicationStatus(missingId, { status: "screening" })).resolves.toBe(
      StatusChangeFailure.Outdated,
    );
  });

  it("does not move another user's application", async () => {
    const theirs = await seed({ status: "applied" }, intruder);

    await expect(changeApplicationStatus(theirs.id, { status: "screening" })).resolves.toBe(
      StatusChangeFailure.Outdated,
    );

    expect((await repository.find(intruder, theirs.id))?.status).toBe("applied");
  });

  it("calls the move outdated when the status changed after it was read", async () => {
    const created = await seed({ status: "applied" });
    const find = repository.find.bind(repository);
    // Another tab rejects the application between the read and the write.
    vi.spyOn(repository, "find").mockImplementationOnce(async (userId, id) => {
      const current = (await find(userId, id)) as Application;
      await repository.recordStatusTransition(
        userId,
        "applied",
        statusTransition(current, "rejected", friday),
      );
      return current;
    });

    await expect(changeApplicationStatus(created.id, { status: "screening" })).resolves.toBe(
      StatusChangeFailure.Outdated,
    );

    expect((await stored(created.id))?.status).toBe("rejected");
  });

  it("changes nothing without a session", async () => {
    const created = await seed({ status: "applied" });
    signedOut();

    await expect(
      changeApplicationStatus(created.id, { status: "screening" }),
    ).rejects.toBeInstanceOf(Redirected);

    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
  });
});

describe("archiveApplication and unarchiveApplication", () => {
  it("hides an application from the active list and brings it back, status untouched", async () => {
    const created = await seed({ status: "interview" });

    await archiveApplication(created.id);

    await expect(repository.listActive(sessionUser.id)).resolves.toEqual([]);
    const [archived] = await repository.listArchived(sessionUser.id);
    expect(archived?.archivedAt).toBeInstanceOf(Date);
    expect(archived?.status).toBe("interview");
    expect(revalidatePath).toHaveBeenCalledWith(routes.applications, "layout");

    await unarchiveApplication(created.id);

    await expect(repository.listActive(sessionUser.id)).resolves.toEqual([created]);
  });

  it("does not archive another user's application", async () => {
    const theirs = await seed({}, intruder);

    await archiveApplication(theirs.id);

    await expect(repository.listActive(intruder)).resolves.toEqual([theirs]);
  });

  it("ignores an id that is not one", async () => {
    await expect(archiveApplication("not-a-uuid")).resolves.toBeUndefined();
    await expect(unarchiveApplication("not-a-uuid")).resolves.toBeUndefined();
    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
  });

  it.each([
    ["archive", archiveApplication],
    ["unarchive", unarchiveApplication],
  ])("does not %s without a session", async (_, action) => {
    const created = await seed();
    signedOut();

    await expect(action(created.id)).rejects.toBeInstanceOf(Redirected);

    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
  });
});

describe("deleteApplication", () => {
  it("removes the application", async () => {
    const created = await seed();

    await deleteApplication(created.id);

    await expect(stored(created.id)).resolves.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith(routes.applications, "layout");
  });

  it("does not delete another user's application", async () => {
    const theirs = await seed({}, intruder);

    await deleteApplication(theirs.id);

    await expect(repository.find(intruder, theirs.id)).resolves.toEqual(theirs);
  });

  it("deletes nothing without a session", async () => {
    const created = await seed();
    signedOut();

    await expect(deleteApplication(created.id)).rejects.toBeInstanceOf(Redirected);

    await expect(stored(created.id)).resolves.toEqual(created);
  });
});
