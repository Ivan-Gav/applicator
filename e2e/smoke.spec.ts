import { expect, test } from "@playwright/test";
import { routes } from "@/app/routes";
import { messages } from "@/ui/messages";

test.describe("home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.home);
  });

  test("shows the project name", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: messages.app.name })).toBeVisible();
  });

  test("renders the primary button", async ({ page }) => {
    await expect(page.getByRole("button", { name: messages.home.getStarted })).toBeVisible();
  });
});
