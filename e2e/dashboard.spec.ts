import { expect, type Page, test } from "@playwright/test";
import { dashboardPath, routes } from "@/app/routes";
import { ChartSeries, ChartStep, defaultDashboardQuery } from "@/domain/application/dashboard";
import { longWaitDays } from "@/domain/application/list";
import { messages } from "@/ui/messages";
import {
  archiveApplicationById,
  moveApplication,
  removeApplications,
  seedApplication,
} from "./support/applications";
import { dashboardStateFile } from "./support/auth";
import { isAt } from "./support/urls";

const t = messages.dashboard;

test.use({ storageState: dashboardStateFile });
// One user for the whole file, emptied before each test: one at a time.
test.describe.configure({ mode: "default" });

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Four sent, one draft, one archived. Answered after 5 days (then interviewed
 * twice) and after 7 days; one waits past the long-wait mark; the archived
 * one was answered after 3 days.
 */
async function seedSearch(page: Page) {
  const sent = (companyName: string, days: number) =>
    seedApplication(
      page.request,
      { companyName, positionTitle: "Engineer", status: "applied", appliedAt: daysAgo(days) },
      daysAgo(days),
    );

  const interviewed = await sent("Interviewed", 50);
  await moveApplication(interviewed, "screening", daysAgo(45));
  await moveApplication(interviewed, "interview", daysAgo(40));
  await moveApplication(interviewed, "interview", daysAgo(30));
  const rejected = await sent("Rejected", 20);
  await moveApplication(rejected, "rejected", daysAgo(13));
  await sent("Fresh", 10);
  await sent("Silent", longWaitDays + 20);
  await seedApplication(page.request, { companyName: "Draft", positionTitle: "Engineer" });
  const archived = await sent("Archived", 15);
  await moveApplication(archived, "rejected", daysAgo(12));
  await archiveApplicationById(archived, daysAgo(11));
}

function card(page: Page, title: string) {
  return page.getByRole("region", { name: title });
}

test.beforeEach(async ({ page }) => {
  await removeApplications(page.request);
});

test("the dashboard shows the headline numbers of the seeded search, from the header's link", async ({
  page,
}) => {
  await seedSearch(page);
  await page.goto(routes.applications);

  await page
    .getByRole("navigation", { name: messages.nav.label })
    .getByRole("link", {
      name: messages.nav.dashboard,
    })
    .click();

  await expect(page).toHaveURL(isAt(routes.dashboard));
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeAttached();
  await expect(card(page, t.summary.title)).toContainText(t.summary.sentAndDrafts(4, 1));
  const firstResponse = card(page, t.firstResponse.title);
  await expect(firstResponse.getByText("6", { exact: true })).toBeVisible();
  await expect(firstResponse).toContainText(t.firstResponse.answers(2));
  await expect(
    page.getByRole("img", {
      name: t.overTime.description(ChartStep.Week, [
        { label: t.overTime.series[ChartSeries.Sent], total: 4 },
        { label: t.overTime.series[ChartSeries.Interviews], total: 2 },
        { label: t.overTime.series[ChartSeries.Rejections], total: 1 },
      ]),
    }),
  ).toBeVisible();
  const waiting = card(page, t.waiting.title);
  await expect(waiting.getByRole("link")).toHaveCount(3);
  await expect(
    waiting.getByRole("link", {
      name: t.waiting.rowLabel({ companyName: "Silent", positionTitle: "Engineer" }),
    }),
  ).toBeVisible();
});

test("counting the archive is kept in the URL and survives a reload", async ({ page }) => {
  await seedSearch(page);
  await page.goto(routes.dashboard);
  const summary = card(page, t.summary.title);
  await expect(summary).toContainText(t.summary.sentAndDrafts(4, 1));

  await page.getByRole("checkbox", { name: t.period.includeArchived }).check();

  await expect(summary).toContainText(t.summary.sentAndDrafts(5, 1));
  await expect(page).toHaveURL(
    isAt(dashboardPath({ ...defaultDashboardQuery, includeArchived: true })),
  );
  await page.reload();
  await expect(summary).toContainText(t.summary.sentAndDrafts(5, 1));
  await expect(card(page, t.firstResponse.title)).toContainText(t.firstResponse.answers(3));
});
