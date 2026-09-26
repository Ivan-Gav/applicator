import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "@/adapters/supabase/auth";
import { signInPath, signInReasonHeader } from "@/app/routes";
import {
  type Authentication,
  AuthenticationStatus,
  SignInFailureReason,
  type User,
} from "@/domain/user/model";
import { AuthUnavailableError, isAuthUnavailable } from "./auth-unavailable-error";
import { requireUser } from "./require-user";

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

function given(authentication: Authentication, requestHeaders: Record<string, string> = {}) {
  vi.mocked(authenticate).mockResolvedValue(authentication);
  vi.mocked(headers).mockResolvedValue(new Headers(requestHeaders));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("returns the signed-in user", async () => {
    given({ status: AuthenticationStatus.SignedIn, user });

    await expect(requireUser()).resolves.toEqual(user);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in without a reason", async () => {
    given({ status: AuthenticationStatus.SignedOut });

    await expect(requireUser()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(signInPath());
  });

  it("says the session expired when the proxy found it so", async () => {
    given(
      { status: AuthenticationStatus.SignedOut },
      { [signInReasonHeader]: SignInFailureReason.SessionExpired },
    );

    await expect(requireUser()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(signInPath(SignInFailureReason.SessionExpired));
  });

  it("ignores a reason it does not know", async () => {
    given({ status: AuthenticationStatus.SignedOut }, { [signInReasonHeader]: "<script>" });

    await expect(requireUser()).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith(signInPath());
  });

  it("does not treat an outage as signed out", async () => {
    given({ status: AuthenticationStatus.Unavailable });

    const error: unknown = await requireUser().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AuthUnavailableError);
    expect(isAuthUnavailable(error as AuthUnavailableError)).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
  });
});
