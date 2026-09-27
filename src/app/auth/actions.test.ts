import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLink } from "@/adapters/supabase/auth";
import { magicLinkCallbackPath, redirectToParam, routes } from "@/app/routes";
import { MagicLinkRequestStatus } from "@/domain/user/model";
import { requestMagicLink } from "./actions";

vi.mock("@/adapters/supabase/auth", () => ({
  authenticate: vi.fn(),
  sendMagicLink: vi.fn(),
  signOutCurrentSession: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const origin = "http://localhost:3000";
const email = "ivan@example.test";

function sentCallbackUrl(): URL {
  const [, callbackUrl] = vi.mocked(sendMagicLink).mock.calls[0] ?? [];
  return new URL(callbackUrl ?? "");
}

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ origin }));
  vi.mocked(sendMagicLink).mockResolvedValue({ status: MagicLinkRequestStatus.Sent });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("requestMagicLink", () => {
  it("sends a link to the callback on the requesting origin", async () => {
    await expect(requestMagicLink(null, { email })).resolves.toEqual({
      status: MagicLinkRequestStatus.Sent,
    });

    expect(sendMagicLink).toHaveBeenCalledWith(email, `${origin}${routes.authCallback}`);
  });

  it("carries a same-site destination into the link", async () => {
    await requestMagicLink("/applications?status=offer", { email });

    expect(sentCallbackUrl().origin).toBe(origin);
    expect(sentCallbackUrl().pathname).toBe(routes.authCallback);
    expect(sentCallbackUrl().searchParams.get(redirectToParam)).toBe("/applications?status=offer");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "/%2Fevil.com",
    "javascript:alert(1)",
    42,
  ])(
    "refuses the foreign destination %j, leaving the callback on its default",
    async (redirectTo) => {
      await requestMagicLink(redirectTo, { email });

      expect(sendMagicLink).toHaveBeenCalledWith(email, `${origin}${magicLinkCallbackPath()}`);
    },
  );

  it("sends nothing for an invalid address", async () => {
    await expect(requestMagicLink("/applications", { email: "not-an-address" })).resolves.toEqual({
      status: MagicLinkRequestStatus.InvalidEmail,
    });

    expect(sendMagicLink).not.toHaveBeenCalled();
  });
});
