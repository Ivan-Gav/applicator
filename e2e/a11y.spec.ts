import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { routes, signInPath } from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { messages } from "@/ui/messages";
import { authStateFile } from "./support/auth";

const publicPages = [
  { name: "home page", path: routes.home },
  { name: "sign-in page", path: signInPath() },
  {
    name: "sign-in page with a failure message",
    path: signInPath({ reason: SignInFailureReason.VerifierMissing }),
  },
];

for (const { name, path } of publicPages) {
  test(`${name} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
}

test.describe("with a stored session", () => {
  test.use({ storageState: authStateFile });

  test("home page has no accessibility violations", async ({ page }) => {
    await page.goto(routes.home);
    await expect(page.getByRole("link", { name: messages.home.openApplications })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test("applications page has no accessibility violations", async ({ page }) => {
    await page.goto(routes.applications);
    await expect(
      page.getByRole("heading", { level: 1, name: messages.applications.title }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
