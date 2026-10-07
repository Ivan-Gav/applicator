import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  ApplicationsView,
  applicationPath,
  applicationsPath,
  routes,
  signInPath,
} from "@/app/routes";
import { SignInFailureReason } from "@/domain/user/model";
import { messages } from "@/ui/messages";
import { removeApplicationsById, seedApplication as seedFor } from "./support/applications";
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

const t = messages.applications;
const form = t.form;

// The shared user keeps what earlier runs seeded; a fresh name finds this run's row.
function uniqueCompany(name: string) {
  return `${name} ${randomUUID().slice(0, 8)}`;
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("with a stored session", () => {
  test.use({ storageState: authStateFile });

  // The user is shared with parallel tests, so each removes only what it seeded.
  let seeded: string[] = [];
  const seedApplication: typeof seedFor = async (...args) => {
    const id = await seedFor(...args);
    seeded.push(id);
    return id;
  };

  test.afterEach(async () => {
    await removeApplicationsById(seeded);
    seeded = [];
  });

  test("home page has no accessibility violations", async ({ page }) => {
    await page.goto(routes.home);
    await expect(page.getByRole("link", { name: messages.home.openApplications })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });

  test("applications list has no accessibility violations", async ({ page }) => {
    await seedApplication(page.request, {
      companyName: uniqueCompany("Axe Corp"),
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

  test.describe("in the dark theme", () => {
    test.use({ colorScheme: "dark" });

    test("applications list has no accessibility violations", async ({ page }) => {
      await seedApplication(page.request, {
        companyName: uniqueCompany("Dark Corp"),
        positionTitle: "Engineer",
        status: "interview",
        appliedAt: new Date("2026-08-31T22:00:00.000Z"),
      });
      await page.goto(routes.applications);
      await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
      await expect(page.getByRole("table", { name: t.title })).toBeVisible();

      await expectNoViolations(page);
    });

    test("application page has no accessibility violations", async ({ page }) => {
      const id = await seedApplication(page.request, {
        companyName: uniqueCompany("Dark Page Corp"),
        positionTitle: "Engineer",
        status: "screening",
        salary: { advertised: { min: 60_000, max: 70_000 }, period: "year" },
      });
      await page.goto(applicationPath(id));
      await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
      await expect(page.getByRole("region", { name: t.page.history })).toBeVisible();

      await expectNoViolations(page);
    });
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

  test("archived applications have no accessibility violations", async ({ page }) => {
    const companyName = uniqueCompany("Archived Corp");
    await seedApplication(page.request, {
      companyName,
      positionTitle: "Engineer",
      status: "rejected",
    });
    await page.goto(routes.applications);
    const name = t.name({ companyName, positionTitle: "Engineer" });
    const archive = page.getByRole("button", { name: t.actions.label(t.actions.archive, name) });
    await archive.click();
    await expect(archive).toBeHidden();
    await page.goto(applicationsPath(ApplicationsView.Archived));
    await expect(
      page.getByRole("button", { name: t.actions.label(t.actions.unarchive, name) }),
    ).toBeVisible();

    await expectNoViolations(page);
  });

  for (const { action, dialog } of [
    { action: t.actions.changeStatus, dialog: { role: "dialog", name: t.statusChange.title } },
    { action: t.actions.delete, dialog: { role: "alertdialog", name: t.deleteDialog.title } },
  ] as const) {
    test(`${action} dialog has no accessibility violations`, async ({ page }) => {
      const companyName = uniqueCompany("Dialog Corp");
      await seedApplication(page.request, {
        companyName,
        positionTitle: "Engineer",
        status: "applied",
      });
      await page.goto(routes.applications);
      await page
        .getByRole("button", {
          name: t.actions.label(action, t.name({ companyName, positionTitle: "Engineer" })),
        })
        .click();
      await expect(page.getByRole(dialog.role, { name: dialog.name })).toBeVisible();

      await expectNoViolations(page);
    });
  }

  // With the salary and contact sections open, as stored values open them.
  test("application page has no accessibility violations", async ({ page }) => {
    const id = await seedApplication(page.request, {
      companyName: uniqueCompany("Page Corp"),
      positionTitle: "Engineer",
      status: "interview",
      appliedAt: new Date("2026-08-31T22:00:00.000Z"),
      salary: { advertised: { min: 60_000, max: 70_000 }, period: "year" },
      contact: { name: "Jane Doe", email: "jane@example.com" },
    });
    await page.goto(applicationPath(id));
    await expect(page.getByRole("region", { name: t.page.history })).toBeVisible();
    await expect(page.getByRole("textbox", { name: form.contact.labels.email })).toBeVisible();

    await expectNoViolations(page);
  });

  test("application page showing errors has no accessibility violations", async ({ page }) => {
    const application = { companyName: uniqueCompany("Error Corp"), positionTitle: "Engineer" };
    const id = await seedApplication(page.request, application);
    await page.goto(applicationPath(id));
    // Typing before hydration would be overwritten by it. Saving stays disabled
    // until something changes, so the status action is the sign of hydration.
    await expect(
      page.getByRole("button", {
        name: t.actions.label(t.statusChange.title, t.name(application)),
      }),
    ).toBeEnabled();
    await page.getByRole("textbox", { name: form.labels.companyName }).fill("");
    await page.getByRole("textbox", { name: form.labels.sourceUrl }).fill("nope");
    await page.getByRole("button", { name: form.saveChanges }).click();
    await expect(page.getByText(form.errors.companyName)).toBeVisible();
    await expect(page.getByText(form.errors.sourceUrl)).toBeVisible();

    await expectNoViolations(page);
  });
});
