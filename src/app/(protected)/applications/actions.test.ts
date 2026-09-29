import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applicationRepositoryForRequest } from "@/adapters/supabase/application.repository";
import { requireUser } from "@/app/auth/_utils/require-user";
import { routes, signInPath } from "@/app/routes";
import { InMemoryApplicationRepository } from "@/test/in-memory-application.repository";
import { createApplication } from "./actions";

vi.mock("@/adapters/supabase/application.repository", () => ({
  applicationRepositoryForRequest: vi.fn(),
}));
vi.mock("@/app/auth/_utils/require-user", () => ({ requireUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// redirect() ends the action by throwing; the mock does the same so that
// nothing after it can run unnoticed.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirected to ${to}`);
  }
}

const sessionUser = {
  id: "00000000-0000-4000-8000-00000000000a",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
};

const valid = { companyName: "Acme", positionTitle: "Engineer", status: "applied" };

let repository: InMemoryApplicationRepository;

beforeEach(() => {
  repository = new InMemoryApplicationRepository();
  vi.mocked(applicationRepositoryForRequest).mockResolvedValue(repository);
  vi.mocked(requireUser).mockResolvedValue(sessionUser);
  vi.mocked(redirect).mockImplementation((to: string) => {
    throw new Redirected(to);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createApplication", () => {
  it("stores a valid application for the signed-in user and returns to the list", async () => {
    await expect(createApplication(valid)).rejects.toEqual(new Redirected(routes.applications));

    const stored = repository.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.userId).toBe(sessionUser.id);
    expect(stored[0]?.application).toMatchObject(valid);
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
    const intruder = "00000000-0000-4000-8000-00000000000b";

    await expect(
      createApplication({ ...valid, userId: intruder, user_id: intruder }),
    ).rejects.toBeInstanceOf(Redirected);

    const [entry] = repository.all();
    expect(entry?.userId).toBe(sessionUser.id);
    expect(entry?.application).not.toHaveProperty("userId");
    expect(entry?.application).not.toHaveProperty("user_id");
    await expect(repository.list(intruder)).resolves.toEqual([]);
  });

  it("stores nothing without a session", async () => {
    vi.mocked(requireUser).mockImplementation(() => {
      throw new Redirected(signInPath());
    });

    await expect(createApplication(valid)).rejects.toEqual(new Redirected(signInPath()));

    expect(applicationRepositoryForRequest).not.toHaveBeenCalled();
    expect(repository.all()).toEqual([]);
  });
});
