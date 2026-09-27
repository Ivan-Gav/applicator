import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authenticate,
  completeSignInFromCallback,
  type SignInCompletion,
} from "@/adapters/supabase/auth";
import { afterSignInRoute, magicLinkCallbackPath, signInPath } from "@/app/routes";
import {
  type Authentication,
  AuthenticationStatus,
  SignInFailureReason,
  type User,
} from "@/domain/user/model";
import { GET } from "./route";

vi.mock("@/adapters/supabase/auth", () => ({
  authenticate: vi.fn(),
  completeSignInFromCallback: vi.fn(),
}));

const origin = "http://localhost:3000";

const user: User = {
  id: "00000000-0000-4000-8000-000000000000",
  email: "ivan@example.test",
  createdAt: new Date("2026-09-01T08:30:00.000Z"),
};

function given(authentication: Authentication, completion: SignInCompletion = { ok: true }) {
  vi.mocked(authenticate).mockResolvedValue(authentication);
  vi.mocked(completeSignInFromCallback).mockResolvedValue(completion);
}

async function landingOf(redirectTo?: string): Promise<string> {
  const response = await GET(new NextRequest(new URL(magicLinkCallbackPath(redirectTo), origin)));
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.origin).toBe(origin);
  return `${location.pathname}${location.search}`;
}

const signedOut: Authentication = { status: AuthenticationStatus.SignedOut };

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("lands on the default destination without redirectTo", async () => {
    given(signedOut);

    await expect(landingOf()).resolves.toBe(afterSignInRoute);
  });

  it("lands on the requested destination", async () => {
    given(signedOut);

    await expect(landingOf("/applications?status=offer")).resolves.toBe(
      "/applications?status=offer",
    );
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "/%2Fevil.com"])(
    "refuses the foreign destination %j",
    async (redirectTo) => {
      given(signedOut);

      await expect(landingOf(redirectTo)).resolves.toBe(afterSignInRoute);
    },
  );

  it("honours the destination when the link is reopened with a live session", async () => {
    given({ status: AuthenticationStatus.SignedIn, user });

    await expect(landingOf("/applications/42")).resolves.toBe("/applications/42");
    expect(completeSignInFromCallback).not.toHaveBeenCalled();
  });

  it("keeps the destination on the way back to sign-in after a failure", async () => {
    given(signedOut, { ok: false, reason: SignInFailureReason.LinkExpired });

    await expect(landingOf("/applications/42")).resolves.toBe(
      signInPath({ reason: SignInFailureReason.LinkExpired, redirectTo: "/applications/42" }),
    );
  });

  it("drops a foreign destination on the way back to sign-in", async () => {
    given(signedOut, { ok: false, reason: SignInFailureReason.LinkInvalid });

    await expect(landingOf("//evil.com")).resolves.toBe(
      signInPath({ reason: SignInFailureReason.LinkInvalid }),
    );
  });
});
