import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { routes, signInPath } from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { messages } from "@/ui/messages";
import { seedApplication } from "./support/applications";
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

const form = messages.applications.form;

test.describe("with a stored session", () => {
  test.use({ storageState: authStateFile });

  test("home page has no accessibility violations", async ({ page }) => {
    await page.goto(routes.home);
    await expect(page.getByRole("link", { name: messages.home.openApplications })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test("applications list has no accessibility violations", async ({ page }) => {
    await seedApplication(page.request, {
      companyName: "Axe Corp",
      positionTitle: "Engineer",
      status: "interview",
      appliedAt: new Date("2026-08-31T22:00:00.000Z"),
      salary: { advertised: { min: 60_000, max: 70_000 }, period: "year" },
    });
    await page.goto(routes.applications);
    await expect(page.getByRole("table", { name: messages.applications.title })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  // With the salary section open, so its inputs are checked too.
  test("new application form has no accessibility violations", async ({ page }) => {
    await page.goto(routes.newApplication);
    await page.getByText(form.salary.title).click();
    await expect(
      page.getByRole("textbox", { name: form.salary.amounts.advertised.from }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test("new application form showing errors has no accessibility violations", async ({ page }) => {
    await page.goto(routes.newApplication);
    await page.getByText(form.salary.title).click();
    await page.getByRole("textbox", { name: form.salary.amounts.advertised.from }).fill("80000");
    await page.getByRole("textbox", { name: form.salary.amounts.advertised.to }).fill("70000");
    await page.getByRole("button", { name: form.submit }).click();
    await expect(page.getByText(form.errors.companyName)).toBeVisible();
    await expect(page.getByText(form.salary.errors.amount)).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
});
