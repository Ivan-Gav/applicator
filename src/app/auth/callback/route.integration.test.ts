import { randomUUID } from "node:crypto";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLink } from "@/adapters/supabase/auth";
import {
  authOtpPath,
  authTokenPath,
  callbackParam,
  supabaseErrorCode,
} from "@/adapters/supabase/auth.constants";
import {
  fakeAnonKey,
  fakeSupabaseUrl,
  sessionCookies,
  supabaseUser,
  userEndpoint,
} from "@/adapters/supabase/proxy-session.fixtures";
import { magicLinkCallbackPath, routes, signInPath } from "@/app/routes";
import { MagicLinkRequestStatus, SignInFailureReason } from "@/domain/user/model";
import { GET } from "./route";

// The adapter and the Supabase SDK run unmocked; only the network is faked.
// Response bodies match what a local GoTrue returns for the same request.

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const origin = "http://localhost:3000";
const otpEndpoint = new URL(authOtpPath, fakeSupabaseUrl).href;
const tokenEndpoint = new URL(authTokenPath, fakeSupabaseUrl).href;

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", fakeSupabaseUrl);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", fakeAnonKey);
});
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
afterAll(() => server.close());

// cookies() reads the jar of the request being served.
function serving(request: NextRequest): NextRequest {
  vi.mocked(cookies).mockResolvedValue(
    request.cookies as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  return request;
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** The cookies a browser carries back after requesting a link: the PKCE verifier. */
async function cookiesAfterRequestingLink(): Promise<string> {
  server.use(http.post(otpEndpoint, () => HttpResponse.json({})));
  const signIn = serving(new NextRequest(new URL(routes.signIn, origin)));

  const outcome = await sendMagicLink(
    "ivan@example.test",
    new URL(routes.authCallback, origin).href,
  );

  expect(outcome).toEqual({ status: MagicLinkRequestStatus.Sent });
  return signIn.cookies.toString();
}

async function callback(
  params: Record<string, string>,
  { cookie = "", redirectTo }: { cookie?: string; redirectTo?: string } = {},
): Promise<Response> {
  const url = new URL(magicLinkCallbackPath(redirectTo), origin);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return GET(serving(new NextRequest(url, { headers: { cookie } })));
}

function landingOf(response: Response): string {
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.origin).toBe(origin);
  return `${location.pathname}${location.search}`;
}

describe("GET /auth/callback against the Supabase SDK", () => {
  it("refuses a malformed code without asking Supabase", async () => {
    const response = await callback({ [callbackParam.code]: "not-a-real-code" });

    expect(landingOf(response)).toBe(signInPath({ reason: SignInFailureReason.LinkInvalid }));
  });

  it("reports a code Supabase does not know as an invalid link", async () => {
    const cookie = await cookiesAfterRequestingLink();
    const code = randomUUID();
    let exchanged: { auth_code?: string; code_verifier?: string } = {};
    server.use(
      http.post(tokenEndpoint, async ({ request }) => {
        exchanged = (await request.json()) as typeof exchanged;
        return HttpResponse.json(
          {
            code: 404,
            error_code: supabaseErrorCode.flowStateNotFound,
            msg: "invalid flow state, no valid flow state found",
          },
          { status: 404 },
        );
      }),
    );

    const response = await callback({ [callbackParam.code]: code }, { cookie });

    expect(landingOf(response)).toBe(signInPath({ reason: SignInFailureReason.LinkInvalid }));
    expect(exchanged.auth_code).toBe(code);
    expect(exchanged.code_verifier).toBeTruthy();
  });

  it("reports the expired-link error Supabase redirects with", async () => {
    const response = await callback({
      [callbackParam.error]: "access_denied",
      [callbackParam.errorCode]: supabaseErrorCode.otpExpired,
      [callbackParam.errorDescription]: "Email link is invalid or has expired",
    });

    expect(landingOf(response)).toBe(signInPath({ reason: SignInFailureReason.LinkExpired }));
  });

  it("asks for the same browser when the request carries no verifier", async () => {
    const response = await callback({ [callbackParam.code]: randomUUID() });

    expect(landingOf(response)).toBe(signInPath({ reason: SignInFailureReason.VerifierMissing }));
  });

  it("sends a replayed callback with a live session to its destination", async () => {
    server.use(http.get(userEndpoint, () => HttpResponse.json(supabaseUser)));

    const response = await callback(
      { [callbackParam.code]: randomUUID() },
      { cookie: cookieHeader(sessionCookies(3600)), redirectTo: "/applications/42" },
    );

    expect(landingOf(response)).toBe("/applications/42");
  });
});
