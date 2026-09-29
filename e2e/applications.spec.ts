import { expect, test } from "@playwright/test";
import { routes } from "@/app/routes";
import { formatDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { removeApplications } from "./support/applications";
import { applicationsStateFile } from "./support/auth";
import { isAt } from "./support/urls";

const t = messages.applications;

// East of UTC: midnight there is still the previous day in UTC, so a date
// shown without the browser's zone would be off by one.
const timeZone = "Asia/Tokyo";
const appliedOn = formatDay(new Date("2026-08-31T15:00:00.000Z"), timeZone);

test.use({ storageState: applicationsStateFile, timezoneId: timeZone });

test.beforeEach(async ({ page }) => {
  await removeApplications(page.request);
});

test("an application created through the form is listed and survives a reload", async ({
  page,
}) => {
  await page.goto(routes.applications);
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeVisible();

  await page.getByRole("link", { name: t.add }).click();
  await expect(page).toHaveURL(isAt(routes.newApplication));
  await page.getByRole("textbox", { name: t.form.labels.companyName }).fill("Initech");
  await page.getByRole("textbox", { name: t.form.labels.positionTitle }).fill("Platform Engineer");
  await page
    .getByRole("combobox", { name: t.form.labels.status })
    .selectOption({ label: t.status.applied });
  await page.getByLabel(t.form.labels.appliedAt).fill("2026-09-01");
  await page.getByRole("button", { name: t.form.submit }).click();

  await expect(page).toHaveURL(isAt(routes.applications));
  const row = page.getByRole("row").filter({ hasText: "Initech" });
  await expect(row).toContainText("Platform Engineer");
  await expect(row).toContainText(appliedOn);
  await expect(row.getByRole("status", { name: t.status.applied })).toBeVisible();

  // Proves the row came from the database, not from client state.
  await page.reload();
  await expect(row).toContainText("Platform Engineer");
  await expect(row.getByRole("status", { name: t.status.applied })).toBeVisible();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeHidden();
});
