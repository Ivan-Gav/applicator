import { expect, test } from "@playwright/test";
import { routes, signInPath } from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { authStateFile, sharedUser } from "./support/auth";
import { plantForgedSession } from "./support/session";

function redirectTarget(response: { headers(): Record<string, string>; url(): string }): string {
  const location = new URL(response.headers().location ?? "", response.url());
  return `${location.pathname}${location.search}`;
}

test("a protected route handler returns data for a stored session", async ({ browser }) => {
  const context = await browser.newContext({ storageState: authStateFile });

  const response = await context.request.get(routes.apiMe);

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ email: sharedUser.email });
  await context.close();
});

test("a protected route handler refuses a request with no session", async ({ request }) => {
  const response = await request.get(routes.apiMe, { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(redirectTarget(response)).toBe(signInPath({ redirectTo: routes.apiMe }));
});

test("a protected route handler refuses a forged session cookie", async ({ browser, baseURL }) => {
  // The proxy never verifies the token, so a forged cookie that has not
  // expired reaches the handler.
  const context = await browser.newContext();
  await plantForgedSession(context, baseURL, 3600);

  const response = await context.request.get(routes.apiMe, { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(redirectTarget(response)).toBe(signInPath({ redirectTo: routes.apiMe }));
  await context.close();
});

test("a protected route handler says why when the session expired", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  await plantForgedSession(context, baseURL, -60);

  const response = await context.request.get(routes.apiMe, { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(redirectTarget(response)).toBe(
    signInPath({ reason: SignInFailureReason.SessionExpired, redirectTo: routes.apiMe }),
  );
  await context.close();
});
