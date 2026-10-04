import { expect, type Page, test } from "@playwright/test";
import { applicationPath, applicationsPath, ApplicationsView, routes } from "@/app/routes";
import { formatDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { removeApplications, seedApplication } from "./support/applications";
import { applicationsStateFile } from "./support/auth";
import { isAt } from "./support/urls";

const t = messages.applications;

// East of UTC: midnight there is still the previous day in UTC, so a date
// shown without the browser's zone would be off by one.
const timeZone = "Asia/Tokyo";
// Midnight of 1 September in Tokyo.
const firstOfSeptember = new Date("2026-08-31T15:00:00.000Z");
const appliedOn = formatDay(firstOfSeptember, timeZone);

test.use({ storageState: applicationsStateFile, timezoneId: timeZone });
// One user for the whole file, emptied before each test: one at a time.
test.describe.configure({ mode: "default" });

test.beforeEach(async ({ page }) => {
  await removeApplications(page.request);
});

function rowOf(page: Page, company: string) {
  return page.getByRole("row").filter({ hasText: company });
}

function actionButton(page: Page, action: string, company: string, position: string) {
  return page.getByRole("button", {
    name: t.actions.label(action, t.name({ companyName: company, positionTitle: position })),
  });
}

test("an application created through the form is listed, edited on its page, and survives reloads", async ({
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
  await page.getByText(t.form.salary.title).click();
  await page.getByRole("textbox", { name: t.form.salary.amounts.advertised.from }).fill("60000");
  await page.getByRole("textbox", { name: t.form.salary.amounts.advertised.to }).fill("70000");
  await page
    .getByRole("combobox", { name: t.form.salary.period })
    .selectOption({ label: t.salary.period.year });
  await page.getByRole("button", { name: t.form.submit }).click();

  await expect(page).toHaveURL(isAt(routes.applications));
  const row = rowOf(page, "Initech");
  await expect(row).toContainText("Platform Engineer");
  await expect(row).toContainText(appliedOn);
  await expect(row.getByRole("status", { name: t.status.applied })).toBeVisible();

  // Proves the row came from the database, not from client state.
  await page.reload();
  await expect(row).toContainText("Platform Engineer");
  await expect(row.getByRole("status", { name: t.status.applied })).toBeVisible();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeHidden();

  const name = t.name({ companyName: "Initech", positionTitle: "Platform Engineer" });
  await row.getByRole("link", { name: t.actions.label(t.actions.edit, name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: t.form.salary.amounts.advertised.to }),
  ).toHaveValue("70000");
  await page.getByRole("textbox", { name: t.form.labels.city }).fill("Osaka");
  await page.getByRole("button", { name: t.form.saveChanges }).click();
  await expect(page.getByText(t.form.saved)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: t.form.labels.city })).toHaveValue("Osaka");
  await expect(
    page.getByRole("textbox", { name: t.form.salary.amounts.advertised.from }),
  ).toHaveValue("60000");
});

test("a status changed from the list is dated by the server and lands in the history", async ({
  page,
}) => {
  const id = await seedApplication(
    page.request,
    {
      companyName: "Hooli",
      positionTitle: "SRE",
      status: "applied",
      appliedAt: firstOfSeptember,
    },
    firstOfSeptember,
  );
  await page.goto(routes.applications);

  await actionButton(page, t.actions.changeStatus, "Hooli", "SRE").click();
  const dialog = page.getByRole("dialog", { name: t.statusChange.title });
  await expect(dialog.getByRole("option")).toHaveText([
    t.status.screening,
    t.status.rejected,
    t.status.withdrawn,
  ]);
  await dialog
    .getByRole("combobox", { name: t.statusChange.status })
    .selectOption({ label: t.status.screening });
  await dialog.getByRole("button", { name: t.statusChange.submit }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(
    rowOf(page, "Hooli").getByRole("status", { name: t.status.screening }),
  ).toBeVisible();

  await page.goto(applicationPath(id));
  const screenedOn = formatDay(new Date(), timeZone);
  const history = page.getByRole("region", { name: t.page.history });
  await expect(history.getByRole("listitem")).toHaveText([
    `${t.status.applied}${appliedOn}`,
    `${t.status.screening}${screenedOn}`,
  ]);
  await expect(page.getByRole("definition").filter({ hasText: screenedOn })).toBeVisible();
});

test("archiving hides an application until it is restored, and deleting removes it", async ({
  page,
}) => {
  await seedApplication(page.request, { companyName: "Umbrella", positionTitle: "Engineer" });
  await seedApplication(page.request, { companyName: "Vandelay", positionTitle: "Importer" });
  await page.goto(routes.applications);

  await actionButton(page, t.actions.archive, "Umbrella", "Engineer").click();
  await expect(rowOf(page, "Umbrella")).toBeHidden();

  await page.goto(applicationsPath(ApplicationsView.Archived));
  await expect(rowOf(page, "Umbrella")).toBeVisible();
  await expect(rowOf(page, "Vandelay")).toBeHidden();
  await actionButton(page, t.actions.unarchive, "Umbrella", "Engineer").click();
  await expect(page.getByRole("heading", { name: t.emptyArchived.title })).toBeVisible();

  await page.goto(routes.applications);
  await expect(rowOf(page, "Umbrella")).toBeVisible();

  await actionButton(page, t.actions.delete, "Vandelay", "Importer").click();
  const confirm = page.getByRole("alertdialog", { name: t.deleteDialog.title });
  await expect(confirm).toContainText(
    t.deleteDialog.description(t.name({ companyName: "Vandelay", positionTitle: "Importer" })),
  );
  await confirm.getByRole("button", { name: t.deleteDialog.confirm }).click();
  await expect(rowOf(page, "Vandelay")).toBeHidden();

  await page.reload();
  await expect(rowOf(page, "Umbrella")).toBeVisible();
  await expect(rowOf(page, "Vandelay")).toBeHidden();
  await page.goto(applicationsPath(ApplicationsView.Archived));
  await expect(rowOf(page, "Vandelay")).toBeHidden();
});
