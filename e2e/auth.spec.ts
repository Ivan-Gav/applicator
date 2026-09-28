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

// Next.js adds its own live region with role="alert" for route announcements,
// so the failure message is addressed by its accessible name.
function failureAlert(page: Page) {
  return page.getByRole("alert", { name: t.failureTitle });
}

// The first two specs deliberately bypass the sign-in form. A test should go
// through the UI only for the thing it is actually testing: here that is
// route protection, so the session comes from the setup project's storageState
// and the form is exercised exactly once, in the spec dedicated to it.
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

    // Tests never read a mailbox: the link comes from the admin API instead.
    await page.goto(await magicLinkCallbackUrl(formUser.email));

    await expect(page).toHaveURL(isAt(afterSignInRoute));
    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();
    await expect(page.getByText(formUser.email)).toBeVisible();
  });

  test("signing out ends the session for the next request", async ({ page }) => {
    // Own session on purpose: signing out revokes it server-side, and the
    // shared storageState must keep working for the other specs.
    await signInWithMagicLink(page, signOutUser.email);

    await page.getByRole("button", { name: messages.nav.signOut }).click();
    await expect(page).toHaveURL(isAt(signInPath()));

    // The important assertion: a direct request afterwards must bounce, which
    // proves the cookies are gone rather than that a redirect happened once.
    await page.goto(routes.applications);
    await expect(page).toHaveURL(isAt(signInPath({ redirectTo: routes.applications })));
    await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  });
});

// A session Supabase refuses to renew: an expired access token with a refresh
// token it does not know, which is what a revoked or long-idle session looks
// like to the proxy.
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
    // The callback is the only request that can replace a dead session.
    await signInWithMagicLink(page, expiredSessionUser.email);

    await expect(page.getByText(expiredSessionUser.email)).toBeVisible();
  });
});
