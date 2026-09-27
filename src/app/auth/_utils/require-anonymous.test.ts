import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "@/adapters/supabase/auth";
import { afterSignInRoute, requestedPathHeader, signInPath } from "@/app/routes";
import { type Authentication, AuthenticationStatus, type User } from "@/domain/user/model";
import { requireAnonymous } from "./require-anonymous";

vi.mock("@/adapters/supabase/auth", () => ({ authenticate: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  // The real redirect() throws to abort rendering; so does this one.
  redirect: vi.fn(() => {
    throw new Error("redirected");
  }),
}));

const user: User = {
  id: "00000000-0000-4000-8000-000000000000",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T08:30:00.000Z"),
};

const signedIn: Authentication = { status: AuthenticationStatus.SignedIn, user };

function given(authentication: Authentication, requested?: string) {
  vi.mocked(authenticate).mockResolvedValue(authentication);
  vi.mocked(headers).mockResolvedValue(
    new Headers(requested === undefined ? {} : { [requestedPathHeader]: requested }),
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireAnonymous", () => {
  it("lets a signed-out visitor through", async () => {
    given({ status: AuthenticationStatus.SignedOut }, signInPath());

    await expect(requireAnonymous()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("lets a visitor through while Supabase is unreachable", async () => {
    given({ status: AuthenticationStatus.Unavailable }, signInPath());

    await expect(requireAnonymous()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-in user to the default destination", async () => {
    given(signedIn, signInPath());

    await expect(requireAnonymous()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(afterSignInRoute);
  });

  it("sends a signed-in user to the destination the URL asks for", async () => {
    given(signedIn, signInPath({ redirectTo: "/applications?status=offer" }));

    await expect(requireAnonymous()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/applications?status=offer");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com"])(
    "refuses the foreign destination %j",
    async (redirectTo) => {
      given(signedIn, signInPath({ redirectTo }));

      await expect(requireAnonymous()).rejects.toThrow("redirected");
      expect(redirect).toHaveBeenCalledWith(afterSignInRoute);
    },
  );

  it("sends a signed-in user to the default when the requested path is unknown", async () => {
    given(signedIn);

    await expect(requireAnonymous()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(afterSignInRoute);
  });
});
