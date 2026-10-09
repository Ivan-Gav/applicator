import { expect, type Page, test } from "@playwright/test";
import {
  applicationPath,
  applicationsPageSize,
  applicationsPath,
  ApplicationsView,
  routes,
} from "@/app/routes";
import { ApplicationSort, defaultListQuery, SortDirection } from "@/domain/application/list";
import { likelyNextStatuses, otherNextStatuses } from "@/domain/application/rules";
import type { ApplicationStatus } from "@/domain/application/model";
import { formatDay } from "@/lib/date";
import { messages } from "@/ui/messages";
import { removeApplications, seedApplication, seedApplications } from "./support/applications";
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

// The tag of an application in an open status, which is the menu that changes it.
function statusTag(page: Page, status: ApplicationStatus, company: string, position: string) {
  return page.getByRole("button", {
    name: t.statusChange.trigger(
      t.status[status],
      t.name({ companyName: company, positionTitle: position }),
    ),
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
  await expect(statusTag(page, "applied", "Initech", "Platform Engineer")).toBeVisible();

  // Proves the row came from the database, not from client state.
  await page.reload();
  await expect(row).toContainText("Platform Engineer");
  await expect(statusTag(page, "applied", "Initech", "Platform Engineer")).toBeVisible();
  await expect(page.getByRole("heading", { name: t.empty.title })).toBeHidden();

  const name = t.name({ companyName: "Initech", positionTitle: "Platform Engineer" });
  await row.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Initech" })).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`^${name}`));
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

  await statusTag(page, "applied", "Hooli", "SRE").click();
  const menu = page.getByRole("menu");
  // The likely moves first, then every other status.
  await expect(menu.getByRole("menuitem")).toHaveText(
    [...likelyNextStatuses("applied"), ...otherNextStatuses("applied")].map((to) => t.status[to]),
  );
  await menu.getByRole("menuitem", { name: t.status.screening }).click();
  await expect(statusTag(page, "screening", "Hooli", "SRE")).toBeVisible();

  await page.reload();
  await expect(statusTag(page, "screening", "Hooli", "SRE")).toBeVisible();

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

test("a click outside the status menu or the delete dialog only closes it", async ({ page }) => {
  await seedApplication(page.request, {
    companyName: "Soylent",
    positionTitle: "Chef",
    status: "applied",
  });
  await page.goto(routes.applications);
  const rowLink = rowOf(page, "Soylent").getByRole("link");
  // Taken while nothing covers the row: an open dialog hides it from role queries.
  const box = await rowLink.boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box!;
  // A click where the row's own link lies: whatever covers it must take the click.
  const clickOnRowLink = () => page.mouse.click(x + width / 2, y + height / 2);

  await statusTag(page, "applied", "Soylent", "Chef").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await clickOnRowLink();
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(page).toHaveURL(isAt(routes.applications));

  await actionButton(page, t.actions.delete, "Soylent", "Chef").click();
  const confirm = page.getByRole("alertdialog", { name: t.deleteDialog.title });
  await expect(confirm).toBeVisible();
  await clickOnRowLink();
  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(isAt(routes.applications));
  await expect(rowLink).toBeVisible();
});

test("the list shows a page at a time, and the server applies what the URL asks for", async ({
  page,
}) => {
  const day = 24 * 60 * 60 * 1000;
  // One more than a page, applied a day apart: "Company 50" is the newest.
  await seedApplications(
    page.request,
    Array.from({ length: applicationsPageSize + 1 }, (_, index) => ({
      companyName: `Company ${String(index).padStart(2, "0")}`,
      positionTitle: "Engineer",
      status: "applied",
      appliedAt: new Date(firstOfSeptember.getTime() + index * day),
    })),
  );
  const rows = page.getByRole("table", { name: t.title }).getByRole("row");
  const showMore = page.getByRole("link", { name: t.showMore });

  await page.goto(routes.applications);
  await expect(rows).toHaveCount(applicationsPageSize + 1);
  await expect(rows.nth(1)).toContainText("Company 50");

  await showMore.click();
  await expect(page).toHaveURL(
    isAt(applicationsPath(ApplicationsView.Active, defaultListQuery, 2 * applicationsPageSize)),
  );
  await expect(rows).toHaveCount(applicationsPageSize + 2);
  await expect(rows.last()).toContainText("Company 00");
  await expect(showMore).toBeHidden();

  await page.goto(
    applicationsPath(ApplicationsView.Active, { ...defaultListQuery, search: "company 07" }),
  );
  await page.reload();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("Company 07");

  await page.goto(
    applicationsPath(ApplicationsView.Active, { ...defaultListQuery, search: "nowhere" }),
  );
  await expect(page.getByRole("heading", { name: t.nothingMatches.title })).toBeVisible();
});

test("search, filters and order live in the URL and survive a reload", async ({ page }) => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  await seedApplications(page.request, [
    {
      companyName: "Initech",
      positionTitle: "SRE",
      status: "applied",
      appliedAt: new Date(now - 5 * day),
    },
    {
      companyName: "Globex",
      positionTitle: "Engineer",
      status: "interview",
      appliedAt: new Date(now - 9 * day),
    },
    {
      companyName: "Acme",
      positionTitle: "Engineer",
      status: "applied",
      appliedAt: new Date(now - 60 * day),
    },
    {
      companyName: "Hooli",
      positionTitle: "Engineer",
      status: "rejected",
      appliedAt: new Date(now - 30 * day),
    },
  ]);
  // Each row's one link reads company, then position.
  const companies = () =>
    page.getByRole("table", { name: t.title }).getByRole("cell").getByRole("link");
  const startingWith = (names: string[]) => names.map((name) => new RegExp(`^${name}`));
  await page.goto(routes.applications);

  // Searching as one types, then clearing it.
  await page.getByRole("searchbox", { name: t.search.label }).fill("glo");
  await expect(page).toHaveURL(
    isAt(applicationsPath(ApplicationsView.Active, { ...defaultListQuery, search: "glo" })),
  );
  await expect(companies()).toHaveText(startingWith(["Globex"]));
  await page.getByRole("link", { name: t.filters.clear }).click();
  await expect(page.getByRole("searchbox", { name: t.search.label })).toHaveValue("");
  await expect(companies()).toHaveCount(4);

  // A status filter and an order, both kept in the URL.
  const applied = page.getByRole("button", { name: `${t.status.applied} 2` });
  await applied.click();
  await expect(applied).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: t.columns.company }).click();
  const filteredAndOrdered = applicationsPath(ApplicationsView.Active, {
    ...defaultListQuery,
    statuses: ["applied"],
    sort: ApplicationSort.Company,
    direction: SortDirection.Ascending,
  });
  await expect(page).toHaveURL(isAt(filteredAndOrdered));
  await expect(companies()).toHaveText(startingWith(["Acme", "Initech"]));

  await page.reload();
  await expect(applied).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("columnheader", { name: t.columns.company })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(companies()).toHaveText(startingWith(["Acme", "Initech"]));
  await expect(page.getByText(t.countFiltered(2, 4))).toBeVisible();

  // Clearing the filters keeps the order.
  await page.getByRole("link", { name: t.filters.clear }).click();
  await expect(companies()).toHaveText(startingWith(["Acme", "Globex", "Hooli", "Initech"]));
});
