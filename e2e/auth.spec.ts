import { expect, type Page, test } from "@playwright/test";
import { afterSignInRoute, routes, signInPath } from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { messages } from "@/ui/messages";
import {
  authStateFile,
  expiredSessionUser,
  formUser,
  magicLinkCallbackUrl,
  signInWithMagicLink,
  signOutUser,
} from "./support/auth";
import { forgedSessionCookieName, plantForgedSession } from "./support/session";
import { isAt } from "./support/urls";

const t = messages.signIn;

// Next.js adds its own role="alert" live region for route announcements.
function failureAlert(page: Page) {
  return page.getByRole("alert", { name: t.failureTitle });
}

test.describe("with a stored session", () => {
  test.use({ storageState: authStateFile });

  test("shows the applications page", async ({ page }) => {
    await page.goto(routes.applications);

    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: messages.nav.signOut })).toBeVisible();
  });

  test("sends the sign-in page on to the applications page", async ({ page }) => {
    await page.goto(signInPath());

    await expect(page).toHaveURL(isAt(afterSignInRoute));
    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();
  });
});

test.describe("without a session", () => {
  test("sends the applications page to sign-in, remembering where it was going", async ({
    page,
  }) => {
    await page.goto(routes.applications);

    await expect(page).toHaveURL(isAt(signInPath({ redirectTo: routes.applications })));
    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  });

  test("requests a link from the form and arrives signed in", async ({ page }) => {
    await page.goto(signInPath());
    await page.getByRole("textbox", { name: t.emailLabel }).fill(formUser.email);
    await page.getByRole("button", { name: t.submit }).click();

    await expect(page.getByRole("heading", { level: 1, name: t.inbox.title })).toBeVisible();
    await expect(page.getByText(formUser.email)).toBeVisible();

    await page.goto(await magicLinkCallbackUrl(formUser.email));

    await expect(page).toHaveURL(isAt(afterSignInRoute));
    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();
    await expect(page.getByText(formUser.email)).toBeVisible();
  });

  test("signing out ends the session for the next request", async ({ page }) => {
    // Own session: signing out revokes it server-side, and the shared
    // storageState must keep working.
    await signInWithMagicLink(page, signOutUser.email);

    await page.getByRole("button", { name: messages.nav.signOut }).click();
    await expect(page).toHaveURL(isAt(signInPath()));

    await page.goto(routes.applications);
    await expect(page).toHaveURL(isAt(signInPath({ redirectTo: routes.applications })));
    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  });
});

// An expired access token with an unknown refresh token: how a revoked or
// long-idle session looks to the proxy.
test.describe("with an expired session", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await plantForgedSession(context, baseURL, -60);
  });

  test("sends the applications page to sign-in, saying why", async ({ page, context }) => {
    await page.goto(routes.applications);

    await expect(page).toHaveURL(
      isAt(
        signInPath({
          reason: SignInFailureReason.SessionExpired,
          redirectTo: routes.applications,
        }),
      ),
    );
    await expect(failureAlert(page)).toContainText(t.failure[SignInFailureReason.SessionExpired]);
    // Checked by value, not by name: when a page redirects after the proxy has
    // set a cookie, Next.js repeats that cookie on the redirect without its
    // Max-Age, so the browser keeps an empty one behind.
    const sessionCookie = (await context.cookies()).find(
      (cookie) => cookie.name === forgedSessionCookieName(),
    );
    expect(sessionCookie?.value ?? "").toBe("");
  });

  test("still signs in through a magic link", async ({ page }) => {
    await signInWithMagicLink(page, expiredSessionUser.email);

    await expect(page.getByText(expiredSessionUser.email)).toBeVisible();
  });
});
